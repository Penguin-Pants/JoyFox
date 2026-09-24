import type { TriagePlacement } from "../domain/types";
import {
  extractInboxRows,
  type InboxRowExtraction,
} from "../extraction/joyclub";
import { resolveMemberIdentity } from "../identity/member-identity";
import type { ProfileFacts } from "../qualification/facts";
import { PLACEMENT_TEXT } from "../rules/contact-rule";
import { selectorRegistry, verifiedSelector } from "../selectors/registry";
import {
  MAX_MEMBERS_PER_REQUEST,
  type MemberTriage,
} from "../triage/triage-service";
import { factsKey, observedFromInboxRow } from "./observed-facts";
import type { TriageClient } from "./triage-client";
import { button, element, explanation, UI_ATTRIBUTE } from "./triage-ui";

/**
 * The `data-joyfox-ui` values the inbox itself creates. Teardown removes only
 * these: removing another feature's UI (the member strip, the note editor,
 * the template picker) would make it mount again on the next mutation, in a
 * loop.
 */
const INBOX_UI: readonly string[] = ["triage-bar", "badge"];

/** The triage views (owner's decision, 2026-09-23). */
export type TriageView =
  | "default"
  | "qualified"
  | "needs-review"
  | "quarantined"
  | "all";

/**
 * Whether JoyClub's conversation list is on screen: `shown`, `hidden` (kept
 * in the page but not visible) or `missing`.
 */
export type InboxListState = "shown" | "hidden" | "missing";

export function inboxListState(document: Document): InboxListState {
  const root = selectorRegistry.inbox.root;
  if (!root || selectorRegistry.inbox.status !== "verified") return "missing";
  const list = document.querySelector<HTMLElement>(root);
  if (!list) return "missing";
  const check = (list as { checkVisibility?: () => boolean }).checkVisibility;
  const visible =
    typeof check === "function"
      ? check.call(list)
      : list.ownerDocument.defaultView?.getComputedStyle(list).display !==
        "none";
  return visible ? "shown" : "hidden";
}

/**
 * Whether inbox triage belongs on the page: whenever the conversation list is
 * on screen, whatever the URL. The owner's live checks (2026-09-23) showed
 * the list beside an open conversation, and the tab bar still vanished after
 * sending a reply there, so the URL is not a reliable signal for the list.
 * A list JoyClub keeps in the page but hides does not count.
 */
export function inboxListShown(document: Document): boolean {
  return inboxListState(document) === "shown";
}

export const VIEW_ATTRIBUTE = "data-joyfox-view";
export const ROW_ATTRIBUTE = "data-joyfox-row";
export const PLACEMENT_ATTRIBUTE = "data-joyfox-placement";
/**
 * Set on a row's slot (see `rowSlot`) with the row's placement, or "" while
 * the row is checked. The stylesheet hides the slot, not only the row.
 */
export const SLOT_ATTRIBUTE = "data-joyfox-slot";

/**
 * The element that holds one row in the list: the row itself, or the
 * highest wrapper around it that holds nothing else. JoyClub wraps each row
 * in two plain `div`s that keep the row's height when the row is hidden
 * (owner evidence, 2026-09-24, `01-inbox.md`). Hiding the slot closes the
 * gap, so the rows of a view sit together at the top. Found by structure,
 * not by class name, and never the list itself.
 */
export function rowSlot(row: Element, list: Element): Element {
  let slot = row;
  for (
    let parent = slot.parentElement;
    parent && parent !== list && parent.children.length === 1;
    parent = slot.parentElement
  )
    slot = parent;
  return slot;
}

const VIEW_TEXT: Record<TriageView, string> = {
  default: "Inbox",
  qualified: "Qualified",
  "needs-review": "Needs Review",
  quarantined: "Quarantined",
  all: "Show all",
};

interface RowState {
  row: Element;
  key?: string;
  memberId?: string;
  observed?: Partial<ProfileFacts>;
  /** Display only: shown in the details panel, never stored or logged. */
  name?: string;
}

const UNIDENTIFIED_REASON =
  "JoyFox could not read this sender's profile number, so it could not check your rule. The row stays visible.";

/**
 * M2 inbox triage. Rows are grouped by filtering in place: a JoyFox view
 * attribute on the list and a placement attribute on each row, which the
 * extension stylesheet uses to hide rows outside the chosen view. No JoyClub
 * node is moved, removed or changed otherwise, so JoyClub's own list keeps
 * rendering normally, and `teardown` restores it exactly.
 *
 * The default view shows everything except Quarantined. A row not yet
 * evaluated is never hidden from the default view, and any failure leaves
 * the list untouched.
 *
 * Every write to the page is compared with the current value first. The
 * navigation coordinator reacts to JoyFox's own mutations too, so an update
 * that always wrote would never settle.
 */
export class InboxTriage {
  readonly #results = new Map<string, MemberTriage>();
  #status: "pending" | "ok" | "off" = "pending";
  #inFlight = false;
  #generation = 0;
  #view: TriageView = "default";
  #selected?: string;
  #detailsKey = "";
  #writeQueue: Promise<void> = Promise.resolve();
  #active = false;
  #day?: string;
  /** The account the current answers were computed for; writes name it. */
  #accountId?: string;

  constructor(
    private readonly document: Document,
    private readonly client: TriageClient,
    private readonly now: () => Date = () => new Date(),
  ) {}

  get view(): TriageView {
    return this.#view;
  }

  /**
   * The page is the inbox: re-read it and apply placements. Safe to call on
   * every mutation.
   */
  update(): void {
    // Re-entering the inbox asks again: placements can depend on the date
    // (account age), and nothing else may have changed meanwhile.
    if (!this.#active) this.#forget();
    this.#active = true;
    this.#refresh();
  }

  /**
   * The page is no longer the inbox. JoyClub may keep the inbox list in the
   * page on other routes, so nothing may re-apply triage until `update` is
   * called again, not even a late answer or a change in another tab.
   */
  leave(): void {
    this.#active = false;
    this.teardown();
  }

  /** Drop every answer so the next refresh asks again. */
  #forget(): void {
    this.#generation += 1;
    this.#results.clear();
    this.#status = "pending";
    this.#inFlight = false;
    this.#detailsKey = "";
  }

  #refresh(): void {
    if (!this.#active) return;
    // An account-age condition can change its result when the date changes,
    // with no change on the page, so answers last one UTC day at most.
    const day = this.now().toISOString().slice(0, 10);
    if (day !== this.#day) {
      if (this.#day !== undefined) this.#forget();
      this.#day = day;
    }
    const list = this.#list();
    if (!list || this.#status === "off") {
      this.teardown();
      return;
    }
    const rows = this.#rows();
    this.#requestMissing(rows);
    if (this.#status !== "ok") return;
    this.#ensureBar(list);
    setAttribute(list, VIEW_ATTRIBUTE, this.#view);
    const counts: Record<TriagePlacement, number> = {
      qualified: 0,
      "needs-review": 0,
      quarantined: 0,
    };
    const slots = new Set<Element>();
    for (const state of rows) {
      const placement = this.#placementFor(state);
      setAttribute(state.row, ROW_ATTRIBUTE, "");
      if (placement) {
        setAttribute(state.row, PLACEMENT_ATTRIBUTE, placement);
        counts[placement] += 1;
      } else state.row.removeAttribute(PLACEMENT_ATTRIBUTE);
      const slot = rowSlot(state.row, list);
      slots.add(slot);
      setAttribute(slot, SLOT_ATTRIBUTE, placement ?? "");
      this.#ensureBadge(state, placement);
    }
    // A wrapper that no longer holds exactly one row (more rows loaded, or
    // JoyClub reused it) must not keep an old placement: it could hide rows.
    for (const node of Array.from(
      this.document.querySelectorAll(`[${SLOT_ATTRIBUTE}]`),
    ))
      if (!slots.has(node)) node.removeAttribute(SLOT_ATTRIBUTE);
    this.#renderCounts(counts);
    this.#renderDetails(rows);
  }

  /** Forget every result, for example after the rule or a placement changed. */
  invalidate(): void {
    this.#forget();
    this.#refresh();
  }

  /**
   * The active account changed. Everything shown belongs to the previous
   * account, so it is removed at once, before the new account's answer
   * arrives: no stale control can send a write under the new account.
   */
  accountChanged(): void {
    this.teardown();
    this.invalidate();
  }

  /**
   * Remove every trace of the inbox triage (`INBOX_UI`). UI that other
   * features own stays in place.
   */
  teardown(): void {
    for (const node of Array.from(
      this.document.querySelectorAll(`[${UI_ATTRIBUTE}]`),
    ))
      if (INBOX_UI.includes(node.getAttribute(UI_ATTRIBUTE) ?? ""))
        node.remove();
    for (const node of Array.from(
      this.document.querySelectorAll(`[${ROW_ATTRIBUTE}]`),
    )) {
      node.removeAttribute(ROW_ATTRIBUTE);
      node.removeAttribute(PLACEMENT_ATTRIBUTE);
    }
    for (const node of Array.from(
      this.document.querySelectorAll(`[${SLOT_ATTRIBUTE}]`),
    ))
      node.removeAttribute(SLOT_ATTRIBUTE);
    for (const node of Array.from(
      this.document.querySelectorAll(`[${VIEW_ATTRIBUTE}]`),
    ))
      node.removeAttribute(VIEW_ATTRIBUTE);
    this.#detailsKey = "";
    this.#selected = undefined;
  }

  setView(view: TriageView): void {
    this.#view = view;
    this.#refresh();
  }

  #list(): Element | null {
    const root = selectorRegistry.inbox.root;
    return root && selectorRegistry.inbox.status === "verified"
      ? this.document.querySelector(root)
      : null;
  }

  #rows(): RowState[] {
    return extractInboxRows(this.document, this.document.URL).map(
      (row: InboxRowExtraction) => {
        const identity = resolveMemberIdentity({
          page: "inbox",
          field: "memberId",
          extraction: row.memberId,
        });
        const name =
          row.senderName.status === "found" ? row.senderName.value : undefined;
        if (identity.status !== "resolved") return { row: row.row, name };
        const memberId = identity.memberId;
        const observed = observedFromInboxRow(row);
        return {
          row: row.row,
          memberId,
          observed,
          name,
          key: `${memberId}|${factsKey(observed)}`,
        };
      },
    );
  }

  #requestMissing(rows: readonly RowState[]): void {
    if (this.#inFlight) return;
    const pending = new Map<
      string,
      { memberId: string; observed: Partial<ProfileFacts> }
    >();
    for (const state of rows)
      if (state.key && state.memberId && !this.#results.has(state.key))
        pending.set(state.key, {
          memberId: state.memberId,
          observed: state.observed ?? {},
        });
    if (pending.size === 0) {
      // With no row to ask about (an empty or still-loading list, or only
      // unidentified rows), one empty request still decides whether triage
      // is on, so the tab bar shows for an enabled rule.
      if (this.#status === "pending") this.#probe();
      return;
    }
    const batch = Array.from(pending.entries()).slice(
      0,
      MAX_MEMBERS_PER_REQUEST,
    );
    this.#send(
      batch.map(([, value]) => value),
      batch.map(([key]) => key),
    );
  }

  /** Ask with an empty list, only to learn whether a rule is on. */
  #probe(): void {
    this.#send([], []);
  }

  #send(
    members: Array<{ memberId: string; observed: Partial<ProfileFacts> }>,
    keys: string[],
  ): void {
    const generation = this.#generation;
    this.#inFlight = true;
    this.client
      .evaluate(members)
      .then((response) => {
        if (generation !== this.#generation) return;
        this.#inFlight = false;
        if (response.status !== "ok") {
          this.#status = "off";
          this.teardown();
          return;
        }
        this.#accountId = response.accountId;
        response.results.forEach((result, index) => {
          const key = keys[index];
          if (key) this.#results.set(key, result);
        });
        this.#status = "ok";
        this.#refresh();
      })
      .catch(() => {
        if (generation !== this.#generation) return;
        // Fail open: without an answer, nothing is hidden or labeled.
        this.#inFlight = false;
        this.#status = "off";
        this.teardown();
      });
  }

  #placementFor(state: RowState): TriagePlacement | undefined {
    if (!state.memberId) return "needs-review";
    return state.key ? this.#results.get(state.key)?.placement : undefined;
  }

  #ensureBar(list: Element): void {
    const existing = this.document.querySelector(
      `[${UI_ATTRIBUTE}="triage-bar"]`,
    );
    if (existing && existing.nextElementSibling === list) return;
    existing?.remove();
    const bar = element(this.document, "div", "joyfox-triage");
    bar.setAttribute(UI_ATTRIBUTE, "triage-bar");
    bar.setAttribute("role", "region");
    bar.setAttribute("aria-label", "JoyFox triage");
    const group = element(this.document, "div", "joyfox-triage__views");
    group.setAttribute("role", "group");
    group.setAttribute("aria-label", "Show messages");
    for (const view of Object.keys(VIEW_TEXT) as TriageView[]) {
      const tab = button(
        this.document,
        "joyfox-button joyfox-triage__view",
        VIEW_TEXT[view],
        () => this.setView(view),
      );
      tab.dataset.view = view;
      group.append(tab);
    }
    // The explanation sits behind a small "?" so the bar stays one line.
    const about = element(this.document, "details", "joyfox-triage__about");
    const summary = element(this.document, "summary", "joyfox-button", "?");
    summary.setAttribute("aria-label", "About these views");
    summary.title = "About these views";
    about.append(
      summary,
      element(
        this.document,
        "p",
        "joyfox-note",
        "Inbox hides Quarantined rows from this view only. Nothing is deleted, and JoyFox changes nothing on JoyClub.",
      ),
    );
    group.append(about);
    bar.append(group);
    const details = element(this.document, "div", "joyfox-triage__details");
    details.hidden = true;
    bar.append(details);
    list.before(bar);
  }

  #renderCounts(counts: Record<TriagePlacement, number>): void {
    for (const tab of Array.from(
      this.document.querySelectorAll<HTMLButtonElement>(
        `[${UI_ATTRIBUTE}="triage-bar"] .joyfox-triage__view`,
      ),
    )) {
      const view = tab.dataset.view as TriageView;
      const label =
        view === "default" || view === "all"
          ? VIEW_TEXT[view]
          : `${VIEW_TEXT[view]} (${counts[view]})`;
      setText(tab, label);
      setAttribute(tab, "aria-pressed", String(view === this.#view));
    }
  }

  #ensureBadge(state: RowState, placement: TriagePlacement | undefined): void {
    const text = placement ? PLACEMENT_TEXT[placement] : "Checking";
    let badge = state.row.querySelector<HTMLButtonElement>(
      `[${UI_ATTRIBUTE}="badge"]`,
    );
    if (!badge) {
      const created: HTMLButtonElement = button(
        this.document,
        "joyfox-badge",
        text,
        () => {
          // Read at click time: JoyClub may reuse a row for another sender.
          this.#selected = created.dataset.member ?? "";
          this.#detailsKey = "";
          this.#refresh();
          const details = this.document.querySelector<HTMLElement>(
            `[${UI_ATTRIBUTE}="triage-bar"] .joyfox-triage__details`,
          );
          details?.scrollIntoView?.({ block: "nearest" });
          details?.focus();
        },
      );
      badge = created;
      badge.setAttribute(UI_ATTRIBUTE, "badge");
      const nameSelector = verifiedSelector("inbox", "senderName");
      const name = nameSelector ? state.row.querySelector(nameSelector) : null;
      if (name) name.after(badge);
      else state.row.append(badge);
    }
    setText(badge, text);
    setAttribute(badge, "data-placement", placement ?? "pending");
    setAttribute(badge, "aria-label", `JoyFox: ${text}. Show why.`);
    // The member the badge opens, read on click from the row's current state.
    setAttribute(badge, "data-member", state.memberId ?? "");
  }

  #renderDetails(rows: readonly RowState[]): void {
    const details = this.document.querySelector<HTMLElement>(
      `[${UI_ATTRIBUTE}="triage-bar"] .joyfox-triage__details`,
    );
    if (!details || this.#selected === undefined) return;
    const state = rows.find((row) => (row.memberId ?? "") === this.#selected);
    const result = state?.key ? this.#results.get(state.key) : undefined;
    const key = JSON.stringify([this.#selected, state?.name, result]);
    if (key === this.#detailsKey) return;
    this.#detailsKey = key;
    details.hidden = false;
    details.tabIndex = -1;
    const heading = element(
      this.document,
      "h2",
      "joyfox-triage__heading",
      // The name is shown as JoyClub shows it, never stored or logged.
      state?.name ? `Why: ${state.name}` : "Why this placement",
    );
    const close = button(this.document, "joyfox-button", "Close", () => {
      this.#selected = undefined;
      this.#detailsKey = "";
      details.hidden = true;
      details.replaceChildren();
    });
    if (!state) {
      details.replaceChildren(
        heading,
        element(this.document, "p", "", "This row is no longer shown."),
        close,
      );
      return;
    }
    if (!state.memberId) {
      details.replaceChildren(
        heading,
        element(this.document, "p", "", UNIDENTIFIED_REASON),
        close,
      );
      return;
    }
    if (!result) {
      details.replaceChildren(
        heading,
        element(
          this.document,
          "p",
          "",
          "JoyFox is still checking this sender.",
        ),
        close,
      );
      return;
    }
    const memberId = state.memberId;
    const accountId = this.#accountId;
    details.replaceChildren(
      heading,
      explanation(this.document, result, {
        onOverride: (placement) => {
          // In click order, so a quick second choice never lands first.
          if (!accountId) return;
          this.#writeQueue = this.#writeQueue.then(() =>
            this.client
              .setOverride(accountId, memberId, placement)
              .then(() => this.invalidate())
              .catch(() => this.#showError(details)),
          );
        },
      }),
      close,
    );
  }

  #showError(details: HTMLElement): void {
    details.append(
      element(
        this.document,
        "p",
        "joyfox-error",
        "JoyFox could not save that change. Nothing was changed.",
      ),
    );
  }
}

function setAttribute(node: Element, name: string, value: string): void {
  if (node.getAttribute(name) !== value) node.setAttribute(name, value);
}

function setText(node: Element, text: string): void {
  if (node.textContent !== text) node.textContent = text;
}
