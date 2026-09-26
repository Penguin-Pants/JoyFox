import {
  extractInboxRows,
  memberIdFromProfileHref,
} from "../extraction/joyclub";
import {
  isOwnProfile,
  POSITIVE_LEVELS,
  readPreferences,
  sharedPreferences,
} from "../extraction/preferences";
import { message, type Message } from "../i18n/message";
import { t } from "../i18n/translator";
import type {
  ExtensionMessage,
  ExtensionResponse,
  MessageContract,
} from "../messaging/protocol";
import { request, type MessageSender } from "../messaging/request";
import { verifiedSelector, type PageType } from "../selectors/registry";
import { MAX_COMPATIBILITY_MEMBERS } from "../compatibility/limits";
import { inboxListShown } from "./inbox-triage";
import { pageMember } from "./member-panel";
import { isPlaced, placeInStrip, removeEmptyStrip } from "./member-strip";
import { button, element, UI_ATTRIBUTE } from "./triage-ui";

export type CompatibilityLookup = MessageContract["compat.lookup"]["response"];

export interface CompatibilityClient {
  lookup(memberIds: string[]): Promise<CompatibilityLookup>;
}

export function messageCompatibilityClient(
  sender: MessageSender,
): CompatibilityClient {
  return {
    lookup: (memberIds) => request(sender, "compat.lookup", { memberIds }),
  };
}

export function runtimeCompatibilityClient(): CompatibilityClient {
  return messageCompatibilityClient(
    (message: ExtensionMessage) =>
      browser.runtime.sendMessage(message) as Promise<ExtensionResponse>,
  );
}

/** Set on each of JoyClub's `j-tag` elements that the viewer shares. */
export const SHARED_ATTRIBUTE = "data-joyfox-shared";
/** The section in the member strip on a profile page. */
export const COMPAT_SECTION = "compatibility";
const BADGE = "compat-badge";
const SORT_BAR = "compat-sort";
/** Set on each loaded search result while the sort is on: its new place. */
export const RANK_ATTRIBUTE = "data-joyfox-rank";

type Surface = "search" | "inbox" | "attendees";

interface Card {
  memberId: string;
  /** Where the badge goes. */
  place: (badge: HTMLElement) => void;
  /** The element that holds the badge, to find one already placed. */
  host: Element;
}

type Own =
  | { status: "no-account" }
  | {
      status: "ok";
      accountId: string;
      own: string[] | null;
      ownMemberId: string | null;
    };

/**
 * V1-2, the Compatibility Overlay (PRD 6.2, 8.3, 10.1; ADR 0016 D5). On a
 * profile page it highlights the tags the viewer shares inside JoyClub's own
 * checklist and lists them in words. On search results, inbox rows and
 * event guest lists it shows "N shared" for each member whose profile the
 * viewer opened before, and it can sort the loaded search results by that
 * number. It never shows a percentage, asks JoyClub for nothing and only
 * reads what the pages already show.
 */
export class CompatibilityOverlay {
  #type?: PageType;
  #own?: Own;
  #counts = new Map<string, number | null>();
  #pending = new Set<string>();
  #ownLoading = false;
  /** Set by `invalidate`: the next update asks again for every member shown. */
  #reload = false;
  #error = false;
  #session = 0;
  /** Changed by a language switch, so every badge draws again. */
  #version = 0;
  #rendered = "";
  #sorted = false;

  constructor(
    private readonly document: Document,
    private readonly client: CompatibilityClient,
  ) {}

  update(type: PageType | undefined): void {
    this.#type = type;
    const visible = [
      ...new Set(
        this.#cards().flatMap(([, cards]) =>
          cards.map((card) => card.memberId),
        ),
      ),
    ];
    const reload = this.#reload;
    this.#reload = false;
    if (reload)
      // Counts for members no longer shown would stay stale; forget them.
      for (const id of [...this.#counts.keys()])
        if (!visible.includes(id)) this.#counts.delete(id);
    const wanted = reload
      ? visible
      : visible.filter((id) => !this.#counts.has(id) && !this.#pending.has(id));
    // After a failed lookup, only a change (`invalidate`) asks again, so a
    // failing background is not asked on every page mutation.
    const ownNeeded = !this.#own && !this.#ownLoading && !this.#error;
    if (wanted.length > 0 || reload || ownNeeded) void this.#load(wanted);
    this.#draw();
  }

  /** The page shows none of the surfaces any more. */
  leave(): void {
    this.update(undefined);
  }

  /** Another account's preferences must never stay on screen: clear at once. */
  accountChanged(): void {
    this.#sorted = false;
    this.#reset(true);
  }

  /**
   * A snapshot, a setting or a deletion changed: read everything again. What
   * is shown stays until the new answer replaces it, so a save in another
   * tab does not make every badge blink.
   */
  invalidate(): void {
    this.#reset(false);
  }

  #reset(clear: boolean): void {
    this.#session += 1;
    this.#pending.clear();
    this.#ownLoading = false;
    this.#error = false;
    this.#rendered = "";
    if (clear) {
      this.#own = undefined;
      this.#counts.clear();
      this.#clear(["search", "inbox", "attendees"]);
      this.#removeSection();
    } else this.#reload = true;
    this.update(this.#type);
  }

  localeChanged(): void {
    this.#version += 1;
    this.#rendered = "";
    this.#sortBar()?.remove();
    this.#draw();
  }

  async #load(ids: string[]): Promise<void> {
    const session = this.#session;
    for (const id of ids) this.#pending.add(id);
    if (!this.#own) this.#ownLoading = true;
    const chunks: string[][] = [];
    for (let start = 0; start < ids.length; start += MAX_COMPATIBILITY_MEMBERS)
      chunks.push(ids.slice(start, start + MAX_COMPATIBILITY_MEMBERS));
    if (chunks.length === 0) chunks.push([]);
    for (const chunk of chunks) {
      let answer: CompatibilityLookup;
      try {
        answer = await this.client.lookup(chunk);
      } catch {
        if (session !== this.#session) return;
        // Shown as unknown until the next change, so a failing lookup is
        // not asked again on every page mutation.
        this.#error = true;
        this.#ownLoading = false;
        for (const id of chunk) {
          this.#pending.delete(id);
          this.#counts.set(id, null);
        }
        this.#draw();
        continue;
      }
      if (session !== this.#session) return;
      this.#ownLoading = false;
      if (answer.status === "no-account") this.#own = answer;
      else {
        this.#own = {
          status: "ok",
          accountId: answer.accountId,
          own: answer.own,
          ownMemberId: answer.ownMemberId,
        };
        for (const [id, count] of Object.entries(answer.shared))
          this.#counts.set(id, count);
      }
      for (const id of chunk) {
        this.#pending.delete(id);
        if (!this.#counts.has(id)) this.#counts.set(id, null);
      }
      this.#draw();
    }
  }

  /** The cards each active surface shows, with the members they name. */
  #cards(): Array<[Surface, Card[]]> {
    const surfaces: Array<[Surface, Card[]]> = [];
    if (this.#type === "search") surfaces.push(["search", this.#searchCards()]);
    if (inboxListShown(this.document))
      surfaces.push(["inbox", this.#inboxCards()]);
    if (this.#type === "event")
      surfaces.push(["attendees", this.#attendeeCards()]);
    return surfaces;
  }

  #linkMember(link: Element, source: string): string | undefined {
    const id = memberIdFromProfileHref(
      link.getAttribute("href"),
      this.document.URL,
      source,
    );
    return id.status === "found" ? id.value : undefined;
  }

  #searchCards(): Card[] {
    const linkSelector = verifiedSelector("search", "resultLink");
    const cardSelector = verifiedSelector("search", "resultCard");
    if (!linkSelector) return [];
    const cards: Card[] = [];
    for (const link of Array.from(
      this.document.querySelectorAll(linkSelector),
    )) {
      const memberId = this.#linkMember(link, "search.resultLink");
      if (!memberId) continue;
      const host = (cardSelector && link.querySelector(cardSelector)) || link;
      cards.push({
        memberId,
        host,
        // A light-DOM child with this slot draws over the card's photo
        // (11-search.md, "Badge slots").
        place: (badge) => {
          badge.setAttribute("slot", "badge-top-right");
          host.append(badge);
        },
      });
    }
    return cards;
  }

  #inboxCards(): Card[] {
    const nameSelector = verifiedSelector("inbox", "senderName");
    const cards: Card[] = [];
    for (const row of extractInboxRows(this.document, this.document.URL)) {
      if (row.memberId.status !== "found") continue;
      const host = row.row;
      cards.push({
        memberId: row.memberId.value,
        host,
        place: (badge) => {
          // After the triage badge when there is one, else after the name.
          const after =
            host.querySelector(`[${UI_ATTRIBUTE}="badge"]`) ??
            (nameSelector ? host.querySelector(nameSelector) : null);
          if (after) after.after(badge);
          else host.append(badge);
        },
      });
    }
    return cards;
  }

  #attendeeCards(): Card[] {
    const entrySelector = verifiedSelector("event", "attendeeEntry");
    const nameSelector = verifiedSelector("event", "attendeeName");
    if (!entrySelector) return [];
    const cards: Card[] = [];
    for (const entry of Array.from(
      this.document.querySelectorAll(entrySelector),
    )) {
      const memberId = this.#linkMember(entry, "event.attendeeEntry");
      if (!memberId) continue;
      const name = nameSelector ? entry.querySelector(nameSelector) : null;
      const host = name ?? entry;
      cards.push({ memberId, host, place: (badge) => host.append(badge) });
    }
    return cards;
  }

  /** The shared count JoyFox knows for a member, or `null`. */
  #count(memberId: string): number | null {
    if (this.#own?.status !== "ok" || !this.#own.own) return null;
    return this.#counts.get(memberId) ?? null;
  }

  #draw(): void {
    const shown = this.#cards();
    const active = new Set(shown.map(([surface]) => surface));
    this.#clear(
      (["search", "inbox", "attendees"] as const).filter(
        (surface) => !active.has(surface),
      ),
    );
    for (const [surface, cards] of shown)
      for (const card of cards) this.#badge(surface, card);
    if (this.#type === "search") this.#drawSort(shown);
    else this.#unsort();
    if (this.#type === "profile") this.#drawProfile();
    else this.#removeSection();
  }

  #badge(surface: Surface, card: Card): void {
    const existing = card.host.querySelector(`[${UI_ATTRIBUTE}="${BADGE}"]`);
    const count = this.#count(card.memberId);
    if (count === null) return existing?.remove();
    const version = `${card.memberId}|${count}|${this.#version}`;
    if (existing?.getAttribute("data-joyfox-version") === version) return;
    const badge = element(
      this.document,
      "span",
      "joyfox-badge joyfox-compat-badge",
      t(message("compat.badge", { count })),
    );
    badge.setAttribute(UI_ATTRIBUTE, BADGE);
    badge.setAttribute("data-surface", surface);
    badge.setAttribute("data-joyfox-version", version);
    const label = t(message("compat.badgeLabel", { count }));
    badge.title = label;
    badge.setAttribute("aria-label", label);
    if (existing) existing.replaceWith(badge);
    else card.place(badge);
  }

  #clear(surfaces: readonly Surface[]): void {
    for (const surface of surfaces) {
      for (const node of Array.from(
        this.document.querySelectorAll(
          `[${UI_ATTRIBUTE}="${BADGE}"][data-surface="${surface}"]`,
        ),
      ))
        node.remove();
      if (surface === "search") this.#unsort();
    }
  }

  // --- Profile page -------------------------------------------------------

  #section(): HTMLElement | null {
    return this.document.querySelector<HTMLElement>(
      `[${UI_ATTRIBUTE}="${COMPAT_SECTION}"]`,
    );
  }

  #removeSection(): void {
    this.#section()?.remove();
    removeEmptyStrip(this.document);
    for (const tag of Array.from(
      this.document.querySelectorAll(`[${SHARED_ATTRIBUTE}]`),
    ))
      tag.removeAttribute(SHARED_ATTRIBUTE);
    this.#rendered = "";
  }

  #drawProfile(): void {
    const member = pageMember(this.document, "profile");
    const own = this.#own;
    if (!member || (!own && !this.#error)) return this.#removeSection();
    const reading = readPreferences(this.document);
    let text: Message;
    let labels: string[] = [];
    let highlight = new Set<string>();
    if (this.#error && !own) text = message("compat.readFailed");
    else if (!own || own.status === "no-account")
      text = message("compat.noAccount");
    else if (isOwnProfile(this.document) || own.ownMemberId === member.memberId)
      text =
        reading.status === "found"
          ? message("compat.own", { count: reading.positive.length })
          : message(
              reading.status === "missing"
                ? "compat.missing"
                : "compat.unreadable",
            );
    else if (!own.own) text = message("compat.ownUnknown");
    else if (reading.status === "missing") text = message("compat.missing");
    else if (reading.status === "unreadable")
      text = message("compat.unreadable");
    else {
      labels = sharedPreferences(own.own, reading.positive);
      highlight = new Set(labels);
      text =
        labels.length > 0
          ? message("compat.shared", { count: labels.length })
          : message("compat.none");
    }
    // Only a tag the member lists at a positive level is marked; a couple
    // profile can list the same tag at another level for the other partner.
    const marked = new Set<Element>(
      reading.status === "found"
        ? reading.entries
            .filter(
              (entry) =>
                POSITIVE_LEVELS.has(entry.level) && highlight.has(entry.label),
            )
            .map((entry) => entry.tag)
        : [],
    );
    for (const tag of Array.from(
      this.document.querySelectorAll(`[${SHARED_ATTRIBUTE}]`),
    ))
      if (!marked.has(tag)) tag.removeAttribute(SHARED_ATTRIBUTE);
    for (const tag of marked) tag.setAttribute(SHARED_ATTRIBUTE, "yes");

    const key = JSON.stringify([member.memberId, text, labels, this.#version]);
    const existing = this.#section();
    if (existing && key === this.#rendered && isPlaced(existing, member.anchor))
      return;
    this.#rendered = key;
    const section = element(
      this.document,
      "section",
      "joyfox-panel joyfox-compat",
    );
    section.setAttribute(UI_ATTRIBUTE, COMPAT_SECTION);
    section.setAttribute("data-member", member.memberId);
    section.setAttribute("aria-label", t("compat.heading"));
    section.append(
      element(
        this.document,
        "strong",
        "joyfox-compat__heading",
        t("compat.heading"),
      ),
      element(this.document, "p", "joyfox-compat__text", t(text)),
    );
    if (labels.length > 0) {
      const list = element(this.document, "ul", "joyfox-compat__list");
      for (const label of labels)
        list.append(element(this.document, "li", "", label));
      section.append(list);
    }
    existing?.remove();
    placeInStrip(this.document, member.anchor, section);
  }

  // --- Search sort --------------------------------------------------------

  #sortBar(): HTMLElement | null {
    return this.document.querySelector<HTMLElement>(
      `[${UI_ATTRIBUTE}="${SORT_BAR}"]`,
    );
  }

  /**
   * The element that holds the loaded results, and each result's own item
   * in it: the child of that element that contains the result's link.
   */
  #resultItems(): { container: Element; items: Element[] } | undefined {
    const linkSelector = verifiedSelector("search", "resultLink");
    if (!linkSelector) return undefined;
    const links = Array.from(this.document.querySelectorAll(linkSelector));
    let container = links[0]?.parentElement ?? null;
    while (container && !links.every((link) => container?.contains(link)))
      container = container.parentElement;
    if (!container) return undefined;
    const items: Element[] = [];
    for (const link of links) {
      let item: Element | null = link;
      while (item && item.parentElement !== container)
        item = item.parentElement;
      if (item && !items.includes(item)) items.push(item);
    }
    return { container, items };
  }

  /** CSS `order` moves items only in a flex or grid container. */
  #canSort(container: Element): boolean {
    const display =
      this.document.defaultView?.getComputedStyle(container).display ?? "";
    return /^(inline-)?(flex|grid)$/u.test(display);
  }

  #drawSort(shown: Array<[Surface, Card[]]>): void {
    const listSelector = verifiedSelector("search", "resultList");
    const list = listSelector
      ? this.document.querySelector(listSelector)
      : null;
    if (!list) return this.#unsort();
    const own = this.#own;
    const ready = own?.status === "ok" && own.own !== null;
    const results = this.#resultItems();
    const sortable = results ? this.#canSort(results.container) : false;
    let status: Message | undefined;
    if (own?.status === "no-account") status = message("compat.noAccount");
    else if (own && !ready) status = message("compat.ownUnknown");
    else if (this.#sorted && !sortable)
      status = message("compat.sort.unavailable");
    else if (this.#sorted) status = message("compat.sort.on");
    let bar = this.#sortBar();
    const key = JSON.stringify([this.#sorted, ready, status, this.#version]);
    if (!bar || bar.getAttribute("data-joyfox-version") !== key) {
      const next = element(
        this.document,
        "div",
        "joyfox-panel joyfox-compat-sort",
      );
      next.setAttribute(UI_ATTRIBUTE, SORT_BAR);
      next.setAttribute("data-joyfox-version", key);
      const toggle = button(
        this.document,
        "joyfox-button joyfox-compat-sort__button",
        t("compat.sort.button"),
        () => {
          this.#sorted = !this.#sorted;
          this.#draw();
        },
      );
      toggle.setAttribute("aria-pressed", String(this.#sorted));
      toggle.disabled = !ready;
      const note = element(
        this.document,
        "p",
        "joyfox-note",
        status ? t(status) : "",
      );
      note.setAttribute("role", "status");
      next.append(toggle, note);
      if (bar) bar.replaceWith(next);
      else list.before(next);
      bar = next;
    } else if (!bar.isConnected) list.before(bar);
    if (!this.#sorted || !ready || !results || !sortable)
      return this.#unorder();
    // Known counts first, most shared first; members not known last; ties
    // keep JoyClub's order (the document order, which `order` does not
    // change).
    const counts = new Map(
      (shown.find(([surface]) => surface === "search")?.[1] ?? []).map(
        (card) => [card.host, this.#count(card.memberId)] as const,
      ),
    );
    const countOf = (item: Element) => {
      for (const [host, count] of counts)
        if (item === host || item.contains(host)) return count;
      return null;
    };
    const ranked = results.items
      .map((item, index) => ({ item, index, count: countOf(item) }))
      .sort((a, b) => (b.count ?? -1) - (a.count ?? -1) || a.index - b.index);
    ranked.forEach(({ item }, rank) => {
      if (!(item instanceof HTMLElement)) return;
      // Written only when it changes: `style` is a watched attribute.
      if (item.style.order !== String(rank)) item.style.order = String(rank);
      item.setAttribute(RANK_ATTRIBUTE, String(rank));
    });
  }

  #unorder(): void {
    for (const item of Array.from(
      this.document.querySelectorAll(`[${RANK_ATTRIBUTE}]`),
    )) {
      item.removeAttribute(RANK_ATTRIBUTE);
      if (item instanceof HTMLElement) item.style.removeProperty("order");
    }
  }

  #unsort(): void {
    this.#unorder();
    this.#sortBar()?.remove();
  }
}
