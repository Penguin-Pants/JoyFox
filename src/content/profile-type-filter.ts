import { cardProfileType } from "../extraction/joyclub";
import type { PlainKey } from "../i18n/catalog/en";
import { message } from "../i18n/message";
import { t } from "../i18n/translator";
import { selectorRegistry, verifiedSelector } from "../selectors/registry";
import { FOCUS_KEY, rememberFocus, restoreFocus } from "../ui/focus";
import { element, UI_ATTRIBUTE } from "./triage-ui";

/** Set on JoyClub's grid while a type is ticked; CSS hides what does not match. */
export const TYPE_FILTER_ATTRIBUTE = "data-joyfox-type-filter";
/** Set on each card's slot while filtering: `yes` when its type is ticked. */
export const TYPE_MATCH_ATTRIBUTE = "data-joyfox-type-match";
const MARK = "joyfox-type-unknown";

/**
 * The tab's ticked types, in the page's session storage, shared by the five
 * lists. JoyClub's scripts can read that storage, so it holds only type
 * names (privacy-model.md, "Page session storage").
 */
export const TYPE_FILTER_KEY = "joyfox.profileTypeFilter";

export const CARD_TYPES = ["man", "woman", "couple", "unknown"] as const;
export type CardType = (typeof CARD_TYPES)[number];

const TYPE_LABEL: Record<CardType, PlainKey> = {
  man: "typeFilter.man",
  woman: "typeFilter.woman",
  couple: "typeFilter.couple",
  unknown: "typeFilter.unknown",
};

export type TypeStore = Pick<Storage, "getItem" | "setItem" | "removeItem">;

/** The kept types; anything else, or a broken value, reads as none. */
export function decodeTypes(value: string | null | undefined): Set<CardType> {
  if (!value) return new Set();
  let parsed: unknown;
  try {
    parsed = JSON.parse(value);
  } catch {
    return new Set();
  }
  if (!Array.isArray(parsed)) return new Set();
  return new Set(CARD_TYPES.filter((type) => parsed.includes(type)));
}

/**
 * V1-14: shows only the loaded "My JOY" cards of the ticked profile types
 * (visitors, matches, liked you, you like, you visited). Nothing ticked means
 * no filter. It hides and shows the cards JoyClub already loaded; it never
 * loads more, sends nothing and stores nothing about the members. Cards
 * JoyClub adds while scrolling are checked as they appear. The choice lasts
 * for the tab, across the five lists.
 */
export class ProfileTypeFilter {
  #bar?: HTMLElement;
  #grid?: Element;
  #count?: HTMLElement;
  #hint?: HTMLElement;
  #types = new Set<CardType>();

  constructor(
    private readonly document: Document,
    /** The tab's session storage; tests supply their own. */
    private readonly store: () => TypeStore | undefined = () =>
      document.defaultView?.sessionStorage ?? undefined,
  ) {}

  #readKept(): Set<CardType> {
    try {
      return decodeTypes(this.store()?.getItem(TYPE_FILTER_KEY));
    } catch {
      return new Set();
    }
  }

  #keep(): void {
    try {
      const store = this.store();
      if (this.#types.size === 0) store?.removeItem(TYPE_FILTER_KEY);
      else
        store?.setItem(
          TYPE_FILTER_KEY,
          JSON.stringify(CARD_TYPES.filter((type) => this.#types.has(type))),
        );
    } catch {
      // The choice then lasts only for this page.
    }
  }

  update(): void {
    const rootSelector = selectorOf("root");
    const root = rootSelector
      ? this.document.querySelector(rootSelector)
      : null;
    if (!root) return this.leave();
    const gridSelector = verifiedSelector("my-joy-list", "grid");
    const grid =
      (gridSelector && root.querySelector(gridSelector)) || undefined;
    if (grid !== this.#grid) {
      this.#unmark();
      this.#grid = grid;
    }
    if (!this.#bar) {
      this.#bar = element(
        this.document,
        "div",
        "joyfox-panel joyfox-type-filter",
      );
      this.#bar.setAttribute(UI_ATTRIBUTE, "type-filter");
      this.#types = this.#readKept();
      this.#draw();
    }
    // Before the grid; before the list's area when JoyClub shows no grid.
    if (grid) {
      if (this.#bar.nextElementSibling !== grid) grid.before(this.#bar);
    } else if (root.firstElementChild !== this.#bar) root.prepend(this.#bar);
    this.#apply();
  }

  /** Leaves the tab's choice kept: the next list starts with it. */
  leave(): void {
    this.#unmark();
    this.#bar?.remove();
    this.#bar = undefined;
    this.#grid = undefined;
    this.#count = undefined;
    this.#hint = undefined;
    this.#types = new Set();
  }

  localeChanged(): void {
    if (!this.#bar) return;
    this.#draw();
    this.#apply(true);
  }

  #draw(): void {
    const bar = this.#bar;
    if (!bar) return;
    const document = this.document;
    const focus = rememberFocus(bar);
    bar.replaceChildren();
    const group = element(document, "fieldset", "joyfox-type-filter__group");
    group.append(
      element(
        document,
        "legend",
        "joyfox-type-filter__legend",
        t("typeFilter.legend"),
      ),
    );
    for (const type of CARD_TYPES) {
      const label = element(document, "label", "joyfox-type-filter__option");
      const box = element(document, "input", "joyfox-type-filter__box");
      box.type = "checkbox";
      box.value = type;
      box.checked = this.#types.has(type);
      box.setAttribute(FOCUS_KEY, `type:${type}`);
      box.addEventListener("change", () => {
        if (box.checked) this.#types.add(type);
        else this.#types.delete(type);
        this.#keep();
        this.#apply();
      });
      label.append(box, document.createTextNode(` ${t(TYPE_LABEL[type])}`));
      group.append(label);
    }
    const count = element(document, "span", "joyfox-type-filter__count");
    count.setAttribute("role", "status");
    count.setAttribute("aria-live", "polite");
    const hint = element(document, "span", "joyfox-type-filter__hint");
    bar.append(group, count, hint);
    this.#count = count;
    this.#hint = hint;
    restoreFocus(bar, focus);
  }

  /**
   * Mark every loaded card's slot and show or hide it. Every write happens
   * only on a change: a write is a page mutation, which would start the next
   * pass at once. `redrawMarks` rewrites marks already placed (language).
   */
  #apply(redrawMarks = false): void {
    const grid = this.#grid;
    const filtering = this.#types.size > 0;
    let loaded = 0;
    let shown = 0;
    let unknownHidden = 0;
    const slotSelector = selectorOf("slot");
    const placeholder = selectorOf("placeholder");
    const cardSelector = selectorOf("card");
    if (grid && slotSelector && cardSelector)
      for (const slot of Array.from(grid.querySelectorAll(slotSelector))) {
        // JoyClub's filler cards at the list's end are not members.
        if (placeholder && slot.matches(placeholder)) continue;
        const card = Array.from(slot.children).find((child) =>
          child.matches(cardSelector),
        );
        if (!card) continue;
        loaded += 1;
        const type = cardProfileType(card);
        const match = !filtering || this.#types.has(type);
        if (match) shown += 1;
        else if (type === "unknown") unknownHidden += 1;
        setAttribute(
          slot,
          TYPE_MATCH_ATTRIBUTE,
          filtering ? (match ? "yes" : "no") : null,
        );
        this.#mark(card, filtering && match && type === "unknown", redrawMarks);
      }
    if (grid)
      setAttribute(grid, TYPE_FILTER_ATTRIBUTE, filtering ? "on" : null);
    const parts = filtering
      ? [t(message("typeFilter.count", { shown, loaded }))]
      : [];
    if (filtering && unknownHidden > 0)
      parts.push(
        t(message("typeFilter.unknownHidden", { count: unknownHidden })),
      );
    setText(this.#count, parts.join(" · "));
    // All five lists load more cards as the user scrolls (17-my-joy-lists.md).
    // A list with no cards has nothing to scroll. Whether a list is complete
    // cannot be read: JoyClub shows no end marker, and a full first batch
    // held 39 or 40 cards.
    setText(
      this.#hint,
      filtering && loaded > 0 ? t("typeFilter.scrollHint") : "",
    );
  }

  /** The "Type unknown" label, over the card's photo. */
  #mark(card: Element, wanted: boolean, redraw: boolean): void {
    const existing = Array.from(card.children).find((child) =>
      child.classList.contains(MARK),
    );
    if (!wanted) return existing?.remove();
    const text = t("typeFilter.unknownMark");
    if (existing) {
      if (redraw || existing.textContent !== text) setText(existing, text);
      return;
    }
    const mark = element(this.document, "span", `joyfox-badge ${MARK}`, text);
    mark.setAttribute(UI_ATTRIBUTE, "type-unknown");
    // A light-DOM child in this slot draws over the card's photo
    // (17-my-joy-lists.md, "mark place").
    mark.setAttribute("slot", "badge-top-right");
    card.append(mark);
  }

  #unmark(): void {
    const grid = this.#grid;
    if (!grid) return;
    grid.removeAttribute(TYPE_FILTER_ATTRIBUTE);
    for (const slot of Array.from(
      grid.querySelectorAll(`[${TYPE_MATCH_ATTRIBUTE}]`),
    ))
      slot.removeAttribute(TYPE_MATCH_ATTRIBUTE);
    for (const mark of Array.from(grid.querySelectorAll(`.${MARK}`)))
      mark.remove();
  }
}

const selectorOf = (field: string): string | undefined =>
  field === "root"
    ? selectorRegistry["my-joy-list"].status === "verified"
      ? selectorRegistry["my-joy-list"].root
      : undefined
    : verifiedSelector("my-joy-list", field);

function setAttribute(node: Element, name: string, value: string | null) {
  if (node.getAttribute(name) === value) return;
  if (value === null) node.removeAttribute(name);
  else node.setAttribute(name, value);
}

function setText(node: Element | undefined, text: string) {
  if (node && node.textContent !== text) node.textContent = text;
}
