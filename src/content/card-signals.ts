import { message, type Message } from "../i18n/message";
import { t } from "../i18n/translator";
import type {
  ExtensionMessage,
  ExtensionResponse,
  MessageContract,
} from "../messaging/protocol";
import { request, type MessageSender } from "../messaging/request";
import type { Completeness } from "../signals/completeness";
import {
  MAX_SIGNAL_MEMBERS,
  type MemberSignals,
  type SignalRequest,
} from "../signals/signals-service";
import { verifiedSelector, type PageType } from "../selectors/registry";
import { FOCUS_KEY, rememberFocus, restoreFocus } from "../ui/focus";
import { CardNoteEditor } from "./card-note-editor";
import {
  memberCards,
  resultItems,
  type MemberCard,
  type Surface,
} from "./member-cards";
import { removeEmptyCardLines } from "./card-line";
import type { NotesClient } from "./member-notes";
import { pageMember } from "./member-panel";
import { isPlaced, placeInStrip, removeEmptyStrip } from "./member-strip";
import { factsKey, observedFromProfile } from "./observed-facts";
import { button, element, UI_ATTRIBUTE } from "./triage-ui";

export type SignalsLookup = MessageContract["signals.lookup"]["response"];

export type MemberName = { memberId: string; nickname: string };

export interface SignalsClient {
  lookup(members: SignalRequest[]): Promise<SignalsLookup>;
  /** Keep the nicknames the cards show, for JoyFox's own texts. */
  names?(
    accountId: string,
    names: MemberName[],
  ): Promise<MessageContract["member.names"]["response"]>;
}

export function messageSignalsClient(sender: MessageSender): SignalsClient {
  return {
    lookup: (members) => request(sender, "signals.lookup", { members }),
    names: (accountId, names) =>
      request(sender, "member.names", { accountId, names }),
  };
}

export function runtimeSignalsClient(): SignalsClient {
  return messageSignalsClient(
    (message: ExtensionMessage) =>
      browser.runtime.sendMessage(message) as Promise<ExtensionResponse>,
  );
}

/** Bounded like the background's `MAX_NAMES_PER_REQUEST`. */
const MAX_NAMES_PER_SEND = 200;

/** The signals group on each card. */
export const CARD_SIGNALS = "card-signals";
/** The completeness section in the member strip of a profile page. */
export const COMPLETENESS_SECTION = "completeness";
const FILTER_BAR = "signals-filter";
/** Set on JoyClub's result list while the filter is on. */
export const HIDE_ATTRIBUTE = "data-joyfox-hide-incomplete";
/** Set on each loaded result known to be incomplete. */
export const INCOMPLETE_ATTRIBUTE = "data-joyfox-incomplete";

const STATE_TEXT = {
  complete: "signals.state.complete",
  incomplete: "signals.state.incomplete",
  unknown: "signals.state.unknown",
} as const;

/** "Complete: 5 photos, 120 words, verified", in the language shown. */
export function completenessText(value: Completeness): string {
  const parts = [
    value.photoCount === "unknown"
      ? t("signals.photosUnknown")
      : t(message("signals.photos", { count: value.photoCount })),
    value.profileWordCount === "unknown"
      ? t("signals.wordsUnknown")
      : t(message("signals.words", { count: value.profileWordCount })),
    t(
      value.verification === "unknown"
        ? "signals.verificationUnknown"
        : value.verification
          ? "signals.verified"
          : "signals.notVerified",
    ),
  ];
  return `${t(STATE_TEXT[value.state])}: ${parts.join(", ")}`;
}

/**
 * The trust chip's full text, in the words the member strip uses ("Local
 * trust score: 2."); the chip itself shows a short form.
 */
function trustText(signals: MemberSignals): string {
  return signals.trust === "unknown"
    ? t("trust.score.none")
    : t(message("trust.score.value", { score: signals.trust.score }));
}

const requestKey = (card: SignalRequest) =>
  `${card.memberId}|${factsKey(card.observed)}|${card.noShield === true}`;

/** What one card asks for. A guest-list entry shows no shield (14-events.md). */
const cardRequest = (surface: Surface, card: MemberCard): SignalRequest => ({
  memberId: card.memberId,
  observed: card.observed,
  ...(surface === "attendees" ? { noShield: true } : {}),
});

/**
 * V1-10: the signals JoyFox knows about a member, on every card where
 * JoyClub shows one (PRD 8.3, 8.4): the completeness badge, the local trust
 * score, the note button and the user's own tags. The same values as on the
 * member's profile page, from the same records. The note button opens an
 * editor for the member's note and tags (PRD 6.2). On search results, a
 * filter hides the loaded results known to be incomplete (PRD 8.1); a
 * member JoyFox knows nothing about stays visible, marked unknown. It asks
 * JoyClub for nothing.
 */
export class CardSignals {
  #type?: PageType;
  #data = new Map<string, MemberSignals>();
  #pending = new Set<string>();
  #reload = false;
  #failed = false;
  /** The cards shown when the lookup failed. */
  #failedFor = "";
  #session = 0;
  #version = 0;
  #hide = false;
  #accountId?: string | null;
  #rendered = "";
  readonly #editor: CardNoteEditor;
  /** Where the editor was opened, so focus returns to a card there. */
  #editorSurface?: Surface;
  /** `account|member|nickname` already sent from this tab. */
  readonly #namesSent = new Set<string>();

  constructor(
    private readonly document: Document,
    private readonly client: SignalsClient,
    notes: NotesClient,
  ) {
    this.#editor = new CardNoteEditor(document, notes, (memberId) =>
      this.#noteButton(memberId),
    );
  }

  /** The member's note button now, on a card where the editor opened. */
  #noteButton(memberId: string): HTMLElement | undefined {
    const groups = Array.from(
      this.document.querySelectorAll<HTMLElement>(
        `[${UI_ATTRIBUTE}="${CARD_SIGNALS}"]`,
      ),
    ).filter((group) => group.getAttribute("data-member") === memberId);
    const group =
      groups.find(
        (node) => node.getAttribute("data-surface") === this.#editorSurface,
      ) ?? groups[0];
    return (
      group?.querySelector<HTMLElement>(".joyfox-signals__note") ?? undefined
    );
  }

  update(type: PageType | undefined): void {
    this.#type = type;
    const wanted = this.#requests();
    const reload = this.#reload;
    this.#reload = false;
    const missing = wanted.filter(
      (item) =>
        reload ||
        (!this.#data.has(requestKey(item)) &&
          !this.#pending.has(requestKey(item))),
    );
    // After a failed lookup, a redraw alone does not ask again; another page
    // or another set of cards does.
    const shownKey = JSON.stringify(wanted.map(requestKey).sort());
    if (this.#failed && shownKey !== this.#failedFor) this.#failed = false;
    if (missing.length > 0 && !this.#failed) void this.#load(missing, shownKey);
    this.#draw();
  }

  leave(): void {
    this.update(undefined);
  }

  /** Another account's notes and scores must never stay on screen. */
  accountChanged(): void {
    this.#session += 1;
    this.#data.clear();
    this.#pending.clear();
    this.#failed = false;
    this.#hide = false;
    this.#accountId = undefined;
    this.#editor.close();
    this.#clearAll();
    this.update(this.#type);
  }

  /** A note, tag, outcome or snapshot changed: read again, keep what shows. */
  invalidate(): void {
    this.#session += 1;
    this.#pending.clear();
    this.#failed = false;
    this.#reload = true;
    this.#editor.invalidate();
    this.update(this.#type);
  }

  localeChanged(): void {
    this.#version += 1;
    this.#rendered = "";
    this.#editor.localeChanged();
    this.#draw();
  }

  /** The members the page shows, with what each card shows of them. */
  #requests(): SignalRequest[] {
    const seen = new Map<string, SignalRequest>();
    const add = (item: SignalRequest) => seen.set(requestKey(item), item);
    for (const [surface, cards] of memberCards(this.document, this.#type))
      for (const card of cards) add(cardRequest(surface, card));
    const profile = this.#profile();
    if (profile)
      add({ memberId: profile.memberId, observed: profile.observed });
    return [...seen.values()];
  }

  #profile() {
    if (this.#type !== "profile") return undefined;
    const member = pageMember(this.document, "profile");
    if (!member || member.page !== "profile") return undefined;
    return {
      memberId: member.memberId,
      anchor: member.anchor,
      observed: observedFromProfile(member.extraction),
    };
  }

  async #load(members: SignalRequest[], shownKey: string): Promise<void> {
    const session = this.#session;
    for (const item of members) this.#pending.add(requestKey(item));
    for (let start = 0; start < members.length; start += MAX_SIGNAL_MEMBERS) {
      const chunk = members.slice(start, start + MAX_SIGNAL_MEMBERS);
      let answer: SignalsLookup;
      try {
        answer = await this.client.lookup(chunk);
      } catch {
        if (session !== this.#session) return;
        // Not asked again on every mutation; the next change of the page
        // or of its cards asks again.
        this.#failed = true;
        this.#failedFor = shownKey;
        for (const item of chunk) this.#pending.delete(requestKey(item));
        continue;
      }
      if (session !== this.#session) return;
      if (answer.status === "no-account") {
        this.#accountId = null;
        for (const item of chunk) {
          this.#pending.delete(requestKey(item));
          this.#data.delete(requestKey(item));
        }
      } else {
        this.#accountId = answer.accountId;
        for (const item of chunk) {
          this.#pending.delete(requestKey(item));
          const signals = answer.signals[item.memberId];
          if (signals) this.#data.set(requestKey(item), signals);
        }
      }
      this.#draw();
    }
  }

  #draw(): void {
    const shown = memberCards(this.document, this.#type);
    const active = new Set(shown.map(([surface]) => surface));
    for (const surface of ["search", "inbox", "attendees"] as const)
      if (!active.has(surface)) this.#clear(surface);
    for (const [surface, cards] of shown)
      for (const card of cards) this.#group(surface, card);
    if (this.#type === "search") this.#drawFilter(shown);
    else this.#removeFilter();
    if (this.#type === "profile") this.#drawProfile();
    else this.#removeSection();
    this.#keepNames(shown);
    // An editor for a member no longer on any card stays open: the user
    // closes it. It still edits that member's own records.
  }

  /**
   * Send the nicknames the cards show, each once per account and tab, so
   * JoyFox's own texts can name the member (owner decision, 2026-09-27).
   * Only for the account the cards' signals came from.
   */
  #keepNames(shown: Array<[Surface, MemberCard[]]>): void {
    const accountId = this.#accountId;
    if (!accountId || !this.client.names) return;
    const names = new Map<string, MemberName>();
    for (const [, cards] of shown)
      for (const card of cards) {
        const key = `${accountId}|${card.memberId}|${card.name}`;
        if (card.name && !this.#namesSent.has(key)) {
          this.#namesSent.add(key);
          names.set(card.memberId, {
            memberId: card.memberId,
            nickname: card.name,
          });
        }
      }
    const list = [...names.values()];
    for (let start = 0; start < list.length; start += MAX_NAMES_PER_SEND) {
      const batch = list.slice(start, start + MAX_NAMES_PER_SEND);
      // A failed or refused batch (the account switched meanwhile) is sent
      // again the next time a card shows it.
      const forget = () => {
        for (const { memberId, nickname } of batch)
          this.#namesSent.delete(`${accountId}|${memberId}|${nickname}`);
      };
      void this.client
        .names(accountId, batch)
        .then((answer) => {
          if (answer.status !== "ok") forget();
        })
        .catch(forget);
    }
  }

  #group(surface: Surface, card: MemberCard): void {
    const existing = card.signalsHost.querySelector(
      `[${UI_ATTRIBUTE}="${CARD_SIGNALS}"]`,
    );
    const signals = this.#data.get(requestKey(cardRequest(surface, card)));
    if (!signals || !this.#accountId) return existing?.remove();
    // The nickname too: the note button's editor title uses it.
    const version = JSON.stringify([
      card.memberId,
      card.name,
      signals,
      this.#version,
    ]);
    if (existing?.getAttribute("data-joyfox-version") === version) return;
    const document = this.document;
    const group = element(document, "span", "joyfox-signals");
    group.setAttribute(UI_ATTRIBUTE, CARD_SIGNALS);
    group.setAttribute("data-surface", surface);
    group.setAttribute("data-member", card.memberId);
    group.setAttribute("data-joyfox-version", version);
    // Every card has one short line (card-line.ts): each chip shows a short
    // text, and its tooltip and screen-reader text say it in full.
    const chip = (className: string, full: string, short: string) => {
      const node = element(document, "span", `joyfox-badge ${className}`);
      if (short === full) {
        node.textContent = full;
        return node;
      }
      node.title = full;
      const shown = element(document, "span", "", short);
      shown.setAttribute("aria-hidden", "true");
      node.append(
        shown,
        element(document, "span", "joyfox-visually-hidden", full),
      );
      return node;
    };
    const { completeness } = signals;
    const state = chip(
      "joyfox-signals__completeness",
      completenessText(completeness),
      t(
        completeness.state === "unknown"
          ? "signals.state.unknownShort"
          : STATE_TEXT[completeness.state],
      ),
    );
    state.setAttribute("data-state", completeness.state);
    group.append(
      state,
      chip(
        "joyfox-signals__trust",
        trustText(signals),
        signals.trust === "unknown"
          ? t("signals.trustNoneShort")
          : t(message("signals.trust", { score: signals.trust.score })),
      ),
    );
    // Icon-only, so a card with a note needs no more room; its label says
    // which, and the style repeats it.
    const noteText = t(
      signals.hasNote ? "signals.noteEdit" : "signals.noteAdd",
    );
    const note = button(
      document,
      "joyfox-button joyfox-signals__note",
      "✎",
      () => {
        this.#editorSurface = surface;
        this.#editor.open(card.memberId, note, card.name);
      },
    );
    note.setAttribute(FOCUS_KEY, "note");
    note.title = noteText;
    note.setAttribute("aria-label", noteText);
    note.setAttribute("data-has-note", String(signals.hasNote));
    group.append(note);
    if (signals.tags.length > 0)
      group.append(
        chip(
          "joyfox-signals__tags",
          `${t("signals.tagsLabel")}: ${signals.tags.join(", ")}`,
          t(message("signals.tagCount", { count: signals.tags.length })),
        ),
      );
    if (existing) {
      // A save or another tab's change draws the chips again; a focused
      // note button stays focused.
      const focus = rememberFocus(existing);
      existing.replaceWith(group);
      restoreFocus(group, focus);
    } else card.placeSignals(group);
  }

  #clear(surface: Surface): void {
    for (const node of Array.from(
      this.document.querySelectorAll(
        `[${UI_ATTRIBUTE}="${CARD_SIGNALS}"][data-surface="${surface}"]`,
      ),
    ))
      node.remove();
    if (surface === "search") this.#removeFilter();
    removeEmptyCardLines(this.document);
  }

  #clearAll(): void {
    for (const surface of ["search", "inbox", "attendees"] as const)
      this.#clear(surface);
    this.#removeSection();
  }

  // --- Search filter ------------------------------------------------------

  #filterBar(): HTMLElement | null {
    return this.document.querySelector<HTMLElement>(
      `[${UI_ATTRIBUTE}="${FILTER_BAR}"]`,
    );
  }

  #drawFilter(shown: Array<[Surface, MemberCard[]]>): void {
    const listSelector = verifiedSelector("search", "resultList");
    const list = listSelector
      ? this.document.querySelector(listSelector)
      : null;
    const results = resultItems(this.document);
    if (!list || !results) return this.#removeFilter();
    const cards = shown.find(([surface]) => surface === "search")?.[1] ?? [];
    let hidden = 0;
    for (const item of results.items) {
      const card = cards.find(
        (entry) =>
          item === entry.signalsHost || item.contains(entry.signalsHost),
      );
      const state = card
        ? this.#data.get(requestKey(card))?.completeness.state
        : undefined;
      const incomplete = state === "incomplete";
      if (incomplete) hidden += 1;
      // Written only when it changes, so no mutation loop starts.
      if (incomplete !== (item.getAttribute(INCOMPLETE_ATTRIBUTE) === "yes")) {
        if (incomplete) item.setAttribute(INCOMPLETE_ATTRIBUTE, "yes");
        else item.removeAttribute(INCOMPLETE_ATTRIBUTE);
      }
    }
    if (this.#hide) results.container.setAttribute(HIDE_ATTRIBUTE, "on");
    else results.container.removeAttribute(HIDE_ATTRIBUTE);
    const count: Message | undefined = this.#hide
      ? message("signals.filter.count", {
          hidden,
          loaded: results.items.length,
        })
      : undefined;
    const key = JSON.stringify([this.#hide, count, this.#version]);
    const bar = this.#filterBar();
    if (bar?.getAttribute("data-joyfox-version") === key) {
      if (!bar.isConnected) list.before(bar);
      return;
    }
    const next = element(
      this.document,
      "div",
      "joyfox-panel joyfox-signals-filter",
    );
    next.setAttribute(UI_ATTRIBUTE, FILTER_BAR);
    next.setAttribute("data-joyfox-version", key);
    const toggle = element(this.document, "input", "");
    toggle.type = "checkbox";
    toggle.id = "joyfox-hide-incomplete";
    toggle.checked = this.#hide;
    toggle.addEventListener("change", () => {
      this.#hide = toggle.checked;
      this.#draw();
      this.document.getElementById("joyfox-hide-incomplete")?.focus();
    });
    const label = element(
      this.document,
      "label",
      "joyfox-signals-filter__label",
    );
    label.htmlFor = toggle.id;
    label.append(toggle, " ", t("signals.filter.label"));
    const note = element(
      this.document,
      "p",
      "joyfox-note",
      count ? t(count) : "",
    );
    note.setAttribute("role", "status");
    next.append(label, note);
    if (bar) bar.replaceWith(next);
    else list.before(next);
  }

  #removeFilter(): void {
    this.#filterBar()?.remove();
    for (const node of Array.from(
      this.document.querySelectorAll(`[${HIDE_ATTRIBUTE}]`),
    ))
      node.removeAttribute(HIDE_ATTRIBUTE);
    for (const node of Array.from(
      this.document.querySelectorAll(`[${INCOMPLETE_ATTRIBUTE}]`),
    ))
      node.removeAttribute(INCOMPLETE_ATTRIBUTE);
  }

  // --- Profile page -------------------------------------------------------

  #section(): HTMLElement | null {
    return this.document.querySelector<HTMLElement>(
      `[${UI_ATTRIBUTE}="${COMPLETENESS_SECTION}"]`,
    );
  }

  #removeSection(): void {
    this.#section()?.remove();
    removeEmptyStrip(this.document);
    this.#rendered = "";
  }

  #drawProfile(): void {
    const profile = this.#profile();
    const signals = profile ? this.#data.get(requestKey(profile)) : undefined;
    if (!profile || !signals || !this.#accountId) return this.#removeSection();
    const text = completenessText(signals.completeness);
    const key = JSON.stringify([profile.memberId, text, this.#version]);
    const existing = this.#section();
    if (
      existing &&
      key === this.#rendered &&
      isPlaced(existing, profile.anchor)
    )
      return;
    this.#rendered = key;
    const section = element(
      this.document,
      "section",
      "joyfox-panel joyfox-completeness",
    );
    section.setAttribute(UI_ATTRIBUTE, COMPLETENESS_SECTION);
    // A group inside the member strip, which is the page's one JoyFox region.
    section.setAttribute("role", "group");
    section.setAttribute("aria-label", t("signals.heading"));
    const badge = element(
      this.document,
      "span",
      "joyfox-badge joyfox-signals__completeness",
      text,
    );
    badge.setAttribute("data-state", signals.completeness.state);
    section.append(badge);
    existing?.remove();
    placeInStrip(this.document, profile.anchor, section);
  }
}
