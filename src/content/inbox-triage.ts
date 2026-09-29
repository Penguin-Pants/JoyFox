import type { TriagePlacement } from "../domain/types";
import type { PlainKey } from "../i18n/catalog/en";
import { message, type Message } from "../i18n/message";
import { t } from "../i18n/translator";
import {
  extractInboxRows,
  type InboxRowExtraction,
} from "../extraction/joyclub";
import { resolveMemberIdentity } from "../identity/member-identity";
import type { ProfileFacts } from "../qualification/facts";
import { PLACEMENT_TEXT } from "../rules/contact-rule";
import { MAX_PREVIEW_LENGTH } from "../rules/message-phrase";
import { selectorRegistry } from "../selectors/registry";
import {
  MAX_MEMBERS_PER_REQUEST,
  type MemberTriage,
  type TriageRequestMember,
} from "../triage/triage-service";
import { rememberFocus, restoreFocus } from "../ui/focus";
import { placeInInboxLine, removeEmptyCardLines } from "./card-line";
import { factsKey, observedFromInboxRow } from "./observed-facts";
import type { TriageClient } from "./triage-client";
import {
  button,
  element,
  explanation,
  FOCUS,
  focusFallbacks,
  keyed,
  openSections,
  reopenSections,
  UI_ATTRIBUTE,
  type MarkPlacement,
} from "./triage-ui";

/**
 * The `data-joyfox-ui` values the inbox itself creates. Teardown removes only
 * these: removing another feature's UI (the member strip, the note editor,
 * the template picker) would make it mount again on the next mutation, in a
 * loop.
 */
const INBOX_UI: readonly string[] = ["triage-bar", "triage-setup", "badge"];

/**
 * Why the inbox is not sorted, when the user can change it in the options.
 * Every other reason (a rule turned off, no answer) stays silent (ADR 0006).
 */
type SetupReason = "no-account" | "no-rule";

const SETUP_TEXT: Record<SetupReason, PlainKey> = {
  "no-account": "inbox.setup.no-account",
  "no-rule": "inbox.setup.no-rule",
};

/** The Close button of the "Details" panel, for focus. */
const CLOSE_KEY = "close";

/**
 * The view chosen in this tab, kept across reloads in the tab's session
 * storage (as the saved-search bar keeps its run request).
 */
export const VIEW_STORAGE_KEY = "joyfox.inboxView";

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

const VIEW_TEXT: Record<TriageView, PlainKey> = {
  default: "inbox.view.default",
  qualified: PLACEMENT_TEXT.qualified,
  "needs-review": PLACEMENT_TEXT["needs-review"],
  quarantined: PLACEMENT_TEXT.quarantined,
  all: "inbox.view.all",
};

/** The view stored for this tab, or the default when there is none. */
function storedView(document: Document): TriageView {
  try {
    const value =
      document.defaultView?.sessionStorage.getItem(VIEW_STORAGE_KEY);
    return value && Object.hasOwn(VIEW_TEXT, value)
      ? (value as TriageView)
      : "default";
  } catch {
    // Storage blocked for the page: the default view.
    return "default";
  }
}

function storeView(document: Document, view: TriageView): void {
  try {
    document.defaultView?.sessionStorage.setItem(VIEW_STORAGE_KEY, view);
  } catch {
    // Storage blocked: the view lasts until the page reloads.
  }
}

/** Whether the stylesheet shows a row with this badge placement in `view`. */
function shownInView(placement: string | undefined, view: TriageView): boolean {
  if (view === "all") return true;
  if (view === "default") return placement !== "quarantined";
  return placement === view;
}

interface RowState {
  row: Element;
  key?: string;
  memberId?: string;
  observed?: Partial<ProfileFacts>;
  /**
   * The latest message's preview, sent only to check the rule's phrases
   * (ADR 0013). Never stored or logged.
   */
  preview?: string;
  /** Display only: shown in the details panel, never stored or logged. */
  name?: string;
}

/**
 * M2 inbox triage. Rows are grouped by filtering in place: a JoyFox view
 * attribute on the list and a placement attribute on each row, which the
 * extension stylesheet uses to hide rows outside the chosen view. No JoyClub
 * node is moved, removed or changed otherwise, so JoyClub's own list keeps
 * rendering normally, and `teardown` restores it exactly.
 *
 * The default view shows everything except Junk. A row not yet
 * evaluated is never hidden from the default view, and any failure leaves
 * the list untouched. Without an account or a saved rule, one line in place
 * of the tab bar says so, and no row is hidden or labelled.
 *
 * Every write to the page is compared with the current value first. The
 * navigation coordinator reacts to JoyFox's own mutations too, so an update
 * that always wrote would never settle.
 */
export class InboxTriage {
  readonly #results = new Map<string, MemberTriage>();
  #status: "pending" | "ok" | "off" | SetupReason = "pending";
  #inFlight = false;
  #generation = 0;
  #view: TriageView;
  #selected?: string;
  #detailsKey = "";
  /**
   * The member whose last move failed. The notice stays when the details
   * redraw (for example after a language change) until another choice.
   */
  #failedFor?: string;
  /**
   * The member a Mark sequence runs for. Set at the click, before any
   * request, and kept until the sequence ends, so a double click runs it
   * once (C9).
   */
  #markPending?: string;
  /** What a Mark sequence did and did not do, when it stopped early. */
  #notice?: { memberId: string; text: Message };
  #writeQueue: Promise<void> = Promise.resolve();
  #active = false;
  #day?: string;
  /** The account the current answers were computed for; writes name it. */
  #accountId?: string;

  constructor(
    private readonly document: Document,
    private readonly client: TriageClient,
    private readonly now: () => Date = () => new Date(),
  ) {
    this.#view = storedView(document);
  }

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
    if (this.#status === "no-account" || this.#status === "no-rule") {
      // Remembered like "off", so no request per mutation; only the line.
      this.#ensureSetup(list, this.#status);
      return;
    }
    const rows = this.#rows();
    this.#requestMissing(rows);
    if (this.#status !== "ok") return;
    this.document.querySelector(`[${UI_ATTRIBUTE}="triage-setup"]`)?.remove();
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
    removeEmptyCardLines(this.document);
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
    this.#failedFor = undefined;
    this.#notice = undefined;
  }

  /**
   * The language changed: the bar is drawn again and every badge and the
   * details panel take the new text on the next refresh. The chosen view
   * and the open details stay.
   */
  localeChanged(): void {
    const bar = () =>
      this.document.querySelector(
        `[${UI_ATTRIBUTE}="triage-bar"], [${UI_ATTRIBUTE}="triage-setup"]`,
      );
    const open = openSections(bar());
    const focus = rememberFocus(bar());
    bar()?.remove();
    this.#detailsKey = "";
    this.#refresh();
    const redrawn = bar();
    if (!redrawn) return;
    reopenSections(redrawn, open);
    restoreFocus(redrawn, focus, [...focusFallbacks(focus?.key), CLOSE_KEY]);
  }

  setView(view: TriageView): void {
    this.#view = view;
    storeView(this.document, view);
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
        const preview =
          row.messagePreview.status === "found"
            ? row.messagePreview.value.slice(0, MAX_PREVIEW_LENGTH)
            : undefined;
        return {
          row: row.row,
          memberId,
          observed,
          ...(preview !== undefined ? { preview } : {}),
          name,
          // A new message changes the preview, so the row is asked about
          // again.
          key: JSON.stringify([memberId, factsKey(observed), preview ?? null]),
        };
      },
    );
  }

  #requestMissing(rows: readonly RowState[]): void {
    if (this.#inFlight) return;
    const pending = new Map<string, TriageRequestMember>();
    for (const state of rows)
      if (state.key && state.memberId && !this.#results.has(state.key))
        pending.set(state.key, {
          memberId: state.memberId,
          observed: state.observed ?? {},
          ...(state.preview !== undefined ? { preview: state.preview } : {}),
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

  #send(members: TriageRequestMember[], keys: string[]): void {
    const generation = this.#generation;
    this.#inFlight = true;
    this.client
      .evaluate(members)
      .then((response) => {
        if (generation !== this.#generation) return;
        this.#inFlight = false;
        if (response.status !== "ok") {
          this.teardown();
          if (
            response.status === "no-account" ||
            response.status === "no-rule"
          ) {
            // The user can fix these; say so in one line. Rows stay as they
            // are.
            this.#status = response.status;
            this.#refresh();
          } else this.#status = "off";
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
    bar.setAttribute("aria-label", t("inbox.region"));
    const group = element(this.document, "div", "joyfox-triage__views");
    group.setAttribute("role", "group");
    group.setAttribute("aria-label", t("inbox.views"));
    for (const view of Object.keys(VIEW_TEXT) as TriageView[]) {
      const tab = keyed(
        button(
          this.document,
          "joyfox-button joyfox-triage__view",
          t(VIEW_TEXT[view]),
          () => this.setView(view),
        ),
        `view:${view}`,
      );
      tab.dataset.view = view;
      group.append(tab);
    }
    // The explanation sits behind a small "?" so the bar stays one line.
    const about = element(this.document, "details", "joyfox-triage__about");
    const summary = element(this.document, "summary", "joyfox-button", "?");
    summary.setAttribute("aria-label", t("inbox.about"));
    summary.title = t("inbox.about");
    about.append(
      summary,
      element(this.document, "p", "joyfox-note", t("inbox.aboutText")),
    );
    group.append(about);
    bar.append(group);
    const details = element(this.document, "div", "joyfox-triage__details");
    details.hidden = true;
    bar.append(details);
    list.before(bar);
  }

  /**
   * One line where the tab bar goes, when there is no account or no saved
   * rule, with the way to the options. Written only when it changes.
   */
  #ensureSetup(list: Element, reason: SetupReason): void {
    const existing = this.document.querySelector<HTMLElement>(
      `[${UI_ATTRIBUTE}="triage-setup"]`,
    );
    if (
      existing &&
      existing.nextElementSibling === list &&
      existing.dataset.reason === reason
    )
      return;
    const focus = rememberFocus(existing);
    existing?.remove();
    const bar = element(
      this.document,
      "div",
      "joyfox-triage joyfox-triage--setup",
    );
    bar.setAttribute(UI_ATTRIBUTE, "triage-setup");
    bar.dataset.reason = reason;
    bar.setAttribute("role", "region");
    bar.setAttribute("aria-label", t("inbox.region"));
    bar.append(
      element(this.document, "p", "joyfox-note", t(SETUP_TEXT[reason])),
      keyed(
        button(this.document, "joyfox-button", t("common.openOptions"), () => {
          void this.client.openOptions().catch(() => undefined);
        }),
        FOCUS.openOptions,
      ),
    );
    list.before(bar);
    restoreFocus(bar, focus);
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
          ? t(VIEW_TEXT[view])
          : t("inbox.viewCount", {
              view: message(VIEW_TEXT[view]),
              count: counts[view],
            });
      setText(tab, label);
      setAttribute(tab, "aria-pressed", String(view === this.#view));
    }
  }

  #ensureBadge(state: RowState, placement: TriagePlacement | undefined): void {
    const key = placement ? PLACEMENT_TEXT[placement] : "inbox.checking";
    const text = t(key);
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
          this.#failedFor = undefined;
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
      placeInInboxLine(state.row, badge);
    }
    setText(badge, text);
    setAttribute(badge, "data-placement", placement ?? "pending");
    setAttribute(badge, "aria-label", t("inbox.badge", { text: message(key) }));
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
    const markBusy =
      this.#markPending !== undefined &&
      this.#markPending === (state?.memberId ?? "");
    const key = JSON.stringify([
      this.#selected,
      state?.name,
      result,
      markBusy,
      this.#notice,
    ]);
    if (key === this.#detailsKey) return;
    this.#detailsKey = key;
    details.hidden = false;
    details.tabIndex = -1;
    const heading = element(
      this.document,
      "h2",
      "joyfox-triage__heading",
      // The name is shown as JoyClub shows it, never logged.
      state?.name ? t("inbox.whyNamed", { name: state.name }) : t("inbox.why"),
    );
    const close = keyed(
      button(this.document, "joyfox-button", t("common.close"), () => {
        const member = this.#selected;
        this.#selected = undefined;
        this.#failedFor = undefined;
        this.#detailsKey = "";
        details.hidden = true;
        details.replaceChildren();
        this.#focusAfterClose(member);
      }),
      CLOSE_KEY,
    );
    // Drawn again after a move or a new answer: focus stays on the same
    // control, or on the nearest one left in the panel.
    const focus = rememberFocus(details);
    const redraw = (...body: Node[]) => {
      details.replaceChildren(heading, ...body, close);
      restoreFocus(details, focus, [...focusFallbacks(focus?.key), CLOSE_KEY]);
    };
    if (!state) {
      redraw(element(this.document, "p", "", t("inbox.rowGone")));
      return;
    }
    if (!state.memberId) {
      redraw(element(this.document, "p", "", t("inbox.unidentified")));
      return;
    }
    if (!result) {
      redraw(element(this.document, "p", "", t("inbox.stillChecking")));
      return;
    }
    const memberId = state.memberId;
    const accountId = this.#accountId;
    redraw(
      explanation(this.document, result, {
        onMark: (placement) => this.#mark(memberId, placement),
        markBusy,
        onUseRule: () => {
          // In click order, so a quick second choice never lands first.
          if (!accountId) return;
          this.#writeQueue = this.#writeQueue.then(() =>
            this.client
              .setOverride(accountId, memberId, null)
              .then(() => {
                this.#failedFor = undefined;
                this.invalidate();
              })
              .catch(() => {
                this.#failedFor = memberId;
                this.#showError();
              }),
          );
        },
        onSharedEventOptOut: () => {
          if (!accountId) return;
          this.#writeQueue = this.#writeQueue.then(() =>
            this.client
              .optOutSharedEvent(accountId, memberId)
              .then(() => {
                this.#failedFor = undefined;
                this.invalidate();
              })
              .catch(() => {
                this.#failedFor = memberId;
                this.#showError();
              }),
          );
        },
      }),
    );
    if (this.#failedFor === memberId) this.#showError();
    if (this.#notice?.memberId === memberId)
      this.#showNotice(this.#notice.text);
  }

  /**
   * "Mark qualified" or "Mark as junk" in the row panel (C2, C4, C6): the
   * user's own placement, then one trust outcome, Positive or Negative. No
   * trash: the inbox list opens no conversation (D10). It stops at the
   * first step that fails or is refused.
   */
  #mark(memberId: string, placement: MarkPlacement): void {
    const accountId = this.#accountId;
    if (!accountId || this.#markPending !== undefined) return;
    this.#markPending = memberId;
    this.#failedFor = undefined;
    this.#notice = undefined;
    this.#detailsKey = "";
    this.#refresh();
    this.#writeQueue = this.#writeQueue
      .then(async () => {
        try {
          await this.client.setOverride(accountId, memberId, placement);
        } catch {
          this.#failedFor = memberId;
          return;
        }
        try {
          await this.client.logTrust(
            accountId,
            memberId,
            placement === "qualified" ? "positive" : "negative",
          );
        } catch {
          this.#notice = {
            memberId,
            text: message("mark.trustFailed", {
              placement: message(PLACEMENT_TEXT[placement]),
            }),
          };
        }
      })
      .finally(() => {
        if (this.#markPending === memberId) this.#markPending = undefined;
        // Asked again: the panel shows the new placement, and any notice.
        this.invalidate();
      });
  }

  /** A Mark sequence's notice, in the details shown now. */
  #showNotice(text: Message): void {
    const details = this.document.querySelector<HTMLElement>(
      `[${UI_ATTRIBUTE}="triage-bar"] .joyfox-triage__details`,
    );
    if (!details || details.querySelector(".joyfox-mark-notice")) return;
    details.append(
      element(this.document, "p", "joyfox-error joyfox-mark-notice", t(text)),
    );
  }

  /**
   * After Close, focus goes back to the badge of the row the panel was
   * about, scrolled into view. When the current view hides that row, or it
   * is gone, focus goes to the current view's button.
   */
  #focusAfterClose(member: string | undefined): void {
    const badge = Array.from(
      this.document.querySelectorAll<HTMLElement>(`[${UI_ATTRIBUTE}="badge"]`),
    ).find((node) => member !== undefined && node.dataset.member === member);
    if (badge && shownInView(badge.dataset.placement, this.#view)) {
      badge.scrollIntoView?.({ block: "nearest" });
      badge.focus({ preventScroll: true });
      return;
    }
    this.document
      .querySelector<HTMLElement>(
        `[${UI_ATTRIBUTE}="triage-bar"] .joyfox-triage__view[aria-pressed="true"]`,
      )
      ?.focus();
  }

  /** The failure notice, in the details shown now (a redraw replaces them). */
  #showError(): void {
    const details = this.document.querySelector<HTMLElement>(
      `[${UI_ATTRIBUTE}="triage-bar"] .joyfox-triage__details`,
    );
    if (!details || details.querySelector(".joyfox-error")) return;
    details.append(
      element(this.document, "p", "joyfox-error", t("common.saveFailed")),
    );
  }
}

function setAttribute(node: Element, name: string, value: string): void {
  if (node.getAttribute(name) !== value) node.setAttribute(name, value);
}

function setText(node: Element, text: string): void {
  if (node.textContent !== text) node.textContent = text;
}
