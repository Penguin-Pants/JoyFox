import { parseEventStart } from "../events/event-date";
import {
  ATTENDANCE_VALUES,
  MAX_EVENT_TAGS,
  cleanTags,
  type Attendance,
  type ListingFacts,
  type ListingKind,
} from "../events/listing";
import type { PlainKey } from "../i18n/catalog/en";
import { message, type Message } from "../i18n/message";
import { t } from "../i18n/translator";
import type {
  ExtensionMessage,
  ExtensionResponse,
  ListingSummary,
  MessageContract,
} from "../messaging/protocol";
import { request, type MessageSender } from "../messaging/request";
import { MAX_NOTE_LENGTH, MAX_TAG_LENGTH } from "../notes/limits";
import { selectorRegistry, verifiedSelector } from "../selectors/registry";
import {
  FOCUS_KEY,
  rememberFocus,
  restoreFocus,
  type FocusMemo,
} from "../ui/focus";
import { NOTES_TEXT, noteLength } from "./member-notes";
import { button, element, UI_ATTRIBUTE } from "./triage-ui";

export type ListingGetAnswer = MessageContract["listing.get"]["response"];
export type ListingListAnswer = MessageContract["listing.list"]["response"];
export type ListingSaveRequest = MessageContract["listing.save"]["request"];
export type ListingSaveAnswer = MessageContract["listing.save"]["response"];

/**
 * What the event pages ask of the background. Content scripts run in the
 * page's origin, so event notes are reachable only through messages. Tests
 * supply their own implementation.
 */
export interface ListingClient {
  get(kind: ListingKind, eventId: string): Promise<ListingGetAnswer>;
  list(): Promise<ListingListAnswer>;
  save(request: ListingSaveRequest): Promise<ListingSaveAnswer>;
  openOptions(): Promise<void>;
}

export function messageListingClient(sender: MessageSender): ListingClient {
  return {
    get: (kind, eventId) => request(sender, "listing.get", { kind, eventId }),
    list: () => request(sender, "listing.list", {}),
    save: (payload) => request(sender, "listing.save", payload),
    async openOptions() {
      await request(sender, "options.open", {});
    },
  };
}

export function runtimeListingClient(): ListingClient {
  return messageListingClient(
    (message: ExtensionMessage) =>
      browser.runtime.sendMessage(message) as Promise<ExtensionResponse>,
  );
}

/** Catalog keys of the attendance values, shown in the user's language. */
export const ATTENDANCE_TEXT: Record<Attendance, PlainKey> = {
  unknown: "listing.attendance.unknown",
  interested: "listing.attendance.interested",
  attending: "listing.attendance.attending",
  "not-attending": "listing.attendance.not-attending",
  attended: "listing.attendance.attended",
};

const NOTE_FIELD = "joyfox-listing__note";
const TAG_FIELD = "joyfox-listing__tag-input";

/** Where focus goes when a redraw removed the focused control. */
function fallbacks(memo: FocusMemo | undefined): string[] {
  return memo?.key.startsWith("remove:") ? ["tag", "summary"] : ["summary"];
}

/** "JoyFox: your notes on this event (Attending, 2 tags, a note)". */
function summaryText(
  kind: ListingKind,
  listing: ListingSummary | null,
): string {
  const parts: string[] = [];
  if (listing && listing.attendance !== "unknown")
    parts.push(t(ATTENDANCE_TEXT[listing.attendance]));
  if (listing && listing.tags.length > 0)
    parts.push(t(message("signals.tagCount", { count: listing.tags.length })));
  if (listing?.note) parts.push(t("listing.summary.note"));
  const state = parts.length > 0 ? parts.join(", ") : t("listing.summary.none");
  return t(
    kind === "event"
      ? message("listing.summary.event", { state })
      : message("listing.summary.venue", { state }),
  );
}

/** The number in the page's path, by the verified path of its page type. */
function pathId(kind: ListingKind, pathname: string): string | undefined {
  const definition = selectorRegistry[kind];
  if (definition.status !== "verified" || !definition.path) return undefined;
  return new RegExp(definition.path).exec(pathname)?.[1];
}

const text = (node: Element | null | undefined) =>
  node?.textContent?.replace(/\s+/gu, " ").trim() || undefined;

type Saved = Extract<ListingGetAnswer, { status: "ok" }>;

/**
 * V1-5: the user's private note, tags and attendance on a JoyClub event
 * page, and note and tags on a venue page (PRD 6.3, 9.2). Nothing is sent
 * to JoyClub: JoyClub's own sign-up buttons are never touched. When the user
 * saves, JoyFox also keeps the event's title, start, venue and address from
 * the page, so the personal calendar still shows the event after JoyClub
 * removes it (PRD 6.3).
 *
 * Attendance and tags save at once; the note saves with its button, and
 * text typed there stays across redraws until then. A save names the
 * version it was drawn from, so a change made in another tab is never
 * overwritten unseen.
 *
 * The box is closed while nothing is stored for the event or venue, and
 * open once JoyFox tracks it (ADR 0010: details on demand); its summary
 * says what is stored.
 */
export class ListingPanel {
  #root?: HTMLElement;
  /** The part each draw replaces; the notice below it stays. */
  #content?: HTMLElement;
  #statusNode?: HTMLElement;
  /** The user opened or closed the box on this page. */
  #open?: boolean;
  #key?: string;
  #kind?: ListingKind;
  #id?: string;
  #data?: ListingGetAnswer;
  /** The note as typed, while it differs from the stored one. */
  #draft?: string;
  #tagDraft = "";
  #status?: { text: Message; error: boolean };
  /**
   * A save is on its way. The box's controls ignore changes meanwhile, so a
   * second change can never be dropped or overwritten by the first answer.
   */
  #busy = false;
  /** Bumped on teardown and on an account switch. */
  #session = 0;
  #loadSequence = 0;

  constructor(
    private readonly document: Document,
    private readonly client: ListingClient,
    private readonly pathname: () => string = () => document.location.pathname,
  ) {}

  update(kind: ListingKind): void {
    const id = pathId(kind, this.pathname());
    const anchor = this.#anchor(kind);
    if (!id || !anchor) return this.leave();
    const key = `${kind}:${id}`;
    if (key === this.#key && this.#root?.isConnected) return;
    if (key !== this.#key) {
      this.leave();
      this.#key = key;
      this.#kind = kind;
      this.#id = id;
      const root = element(
        this.document,
        "section",
        "joyfox-panel joyfox-listing",
      );
      root.setAttribute(UI_ATTRIBUTE, "listing");
      const content = element(this.document, "div", "joyfox-listing__content");
      // One live region for the box's life, so each notice is announced.
      const status = element(this.document, "p", "joyfox-listing__status");
      status.setAttribute("role", "status");
      status.setAttribute("aria-live", "polite");
      root.append(content, status);
      this.#root = root;
      this.#content = content;
      this.#statusNode = status;
      this.#draw();
      void this.#load();
    }
    anchor.after(this.#root!);
  }

  leave(): void {
    this.#session += 1;
    this.#root?.remove();
    this.#root = undefined;
    this.#content = undefined;
    this.#statusNode = undefined;
    this.#open = undefined;
    this.#key = undefined;
    this.#kind = undefined;
    this.#id = undefined;
    this.#data = undefined;
    this.#draft = undefined;
    this.#tagDraft = "";
    this.#status = undefined;
  }

  /** Text typed for the previous account is dropped, as for member notes. */
  accountChanged(): void {
    this.#session += 1;
    if (!this.#root) return;
    this.#data = undefined;
    this.#draft = undefined;
    this.#tagDraft = "";
    this.#status = undefined;
    this.#open = undefined;
    this.#draw();
    void this.#load();
  }

  /** A save in another tab, or data deleted: show what is stored now. */
  invalidate(): void {
    if (this.#root) void this.#load();
  }

  localeChanged(): void {
    if (this.#root) this.#draw();
  }

  /** Event: after JoyClub's info box, else the title. Venue: the name. */
  #anchor(kind: ListingKind): Element | null {
    const fields =
      kind === "event" ? ["infoBox", "title"] : (["name"] as const);
    for (const field of fields) {
      const selector = verifiedSelector(kind, field);
      const found = selector ? this.document.querySelector(selector) : null;
      if (found) return found;
    }
    return null;
  }

  /** The listing facts the page shows now, read when the user saves. */
  #facts(): ListingFacts {
    const kind = this.#kind;
    const read = (field: string) => {
      const selector = kind ? verifiedSelector(kind, field) : undefined;
      return selector ? this.document.querySelector(selector) : null;
    };
    const path = this.pathname();
    if (kind === "venue")
      return {
        ...(text(read("name")) ? { title: text(read("name")) } : {}),
        path,
      };
    const start = parseEventStart(text(read("startText")) ?? "");
    const venue = read("venueLink");
    const venueId = /^\/club\/(\d{1,12})\./u.exec(
      venue?.getAttribute("href") ?? "",
    )?.[1];
    const title = text(read("title"));
    const venueName = text(venue);
    return {
      ...(title ? { title } : {}),
      ...(start ? { startLocal: start } : {}),
      path,
      ...(venueId ? { venueId } : {}),
      ...(venueId && venueName ? { venueName } : {}),
    };
  }

  async #load(): Promise<void> {
    const kind = this.#kind;
    const id = this.#id;
    if (!kind || !id) return;
    const session = this.#session;
    const sequence = (this.#loadSequence += 1);
    const current = () =>
      session === this.#session && sequence === this.#loadSequence;
    let answer: ListingGetAnswer;
    try {
      answer = await this.client.get(kind, id);
    } catch {
      if (!current()) return;
      this.#status = { text: message("listing.readFailed"), error: true };
      this.#draw();
      return;
    }
    if (!current()) return;
    this.#data = answer;
    if (this.#status?.text.key === "listing.readFailed")
      this.#status = undefined;
    this.#draw();
  }

  #saved(): Saved | undefined {
    return this.#data?.status === "ok" ? this.#data : undefined;
  }

  #draw(): void {
    const root = this.#root;
    const content = this.#content;
    const kind = this.#kind;
    if (!root || !content || !kind) return;
    const document = this.document;
    // Every draw replaces the box's controls, also for a save in another
    // tab; the focused control is found again by its key.
    const focus = rememberFocus(root);
    const heading = t(
      kind === "event" ? "listing.heading.event" : "listing.heading.venue",
    );
    root.setAttribute("aria-label", heading);
    content.replaceChildren();
    const data = this.#data;
    if (!data) {
      content.append(element(document, "p", "joyfox-panel__heading", heading));
      if (!this.#status)
        content.append(
          element(document, "p", "joyfox-note", t("listing.loading")),
        );
    } else content.append(this.#details(data, kind, heading));
    this.#showStatus();
    this.#markBusy();
    restoreFocus(root, focus, fallbacks(focus));
  }

  #details(
    data: ListingGetAnswer,
    kind: ListingKind,
    heading: string,
  ): HTMLElement {
    const document = this.document;
    const stored = data.status === "ok" ? data.listing : null;
    const details = element(document, "details", "joyfox-listing__details");
    details.open = this.#open ?? stored !== null;
    details.addEventListener("toggle", () => {
      if (details.isConnected) this.#open = details.open;
    });
    const summary = element(
      document,
      "summary",
      "joyfox-listing__summary",
      data.status === "ok" ? summaryText(kind, stored) : heading,
    );
    summary.setAttribute(FOCUS_KEY, "summary");
    details.append(summary);
    if (data.status === "no-account") {
      const options = button(
        document,
        "joyfox-button",
        t("common.openOptions"),
        () => void this.client.openOptions().catch(() => undefined),
      );
      options.setAttribute(FOCUS_KEY, "options");
      details.append(
        element(document, "p", "joyfox-note", t("listing.noAccount")),
        options,
      );
      return details;
    }
    if (kind === "event") details.append(this.#attendanceRow(data));
    details.append(this.#noteRow(data), this.#tagRow(data, kind));
    details.append(element(document, "p", "joyfox-note", t("listing.privacy")));
    return details;
  }

  #attendanceRow(data: Saved): HTMLElement {
    const document = this.document;
    const row = element(document, "div", "joyfox-listing__row");
    const label = element(document, "label", "", t("listing.attendanceLabel"));
    const select = element(document, "select", "joyfox-listing__attendance");
    select.id = "joyfox-listing-attendance";
    select.setAttribute(FOCUS_KEY, "attendance");
    label.htmlFor = select.id;
    const stored = data.listing?.attendance ?? "unknown";
    for (const value of ATTENDANCE_VALUES)
      select.append(
        new Option(t(ATTENDANCE_TEXT[value]), value, false, value === stored),
      );
    // The value being saved; a change while a save runs goes back to it.
    let chosen = stored;
    select.addEventListener("change", () => {
      if (this.#busy) {
        select.value = chosen;
        return;
      }
      chosen = select.value as Attendance;
      void this.#save({ attendance: chosen });
    });
    row.append(label, select);
    return row;
  }

  #noteRow(data: Saved): HTMLElement {
    const document = this.document;
    const row = element(document, "div", "joyfox-listing__row");
    const label = element(document, "label", "", t("listing.noteLabel"));
    const note = element(document, "textarea", NOTE_FIELD);
    note.id = "joyfox-listing-note";
    note.setAttribute(FOCUS_KEY, "note");
    label.htmlFor = note.id;
    note.maxLength = MAX_NOTE_LENGTH;
    note.rows = 3;
    note.value = this.#draft ?? data.listing?.note ?? "";
    note.addEventListener("input", () => {
      this.#draft = note.value;
    });
    // Keys typed here are JoyFox's: JoyClub's page shortcuts must not see them.
    note.addEventListener("keydown", (event) => event.stopPropagation());
    const length = noteLength(
      document,
      note,
      "joyfox-listing-note-length",
      () => {
        this.#status = { text: message(NOTES_TEXT.pasteCut), error: true };
        this.#showStatus();
      },
    );
    const save = button(
      document,
      "joyfox-button",
      t("listing.saveNote"),
      () => {
        void this.#save({ note: note.value }, true);
      },
    );
    save.setAttribute(FOCUS_KEY, "save-note");
    row.append(label, note, length, save);
    return row;
  }

  #tagRow(data: Saved, kind: ListingKind): HTMLElement {
    const document = this.document;
    const row = element(document, "div", "joyfox-listing__row");
    row.append(
      element(document, "p", "joyfox-listing__label", t("listing.tagsLabel")),
    );
    const tags = data.listing?.tags ?? [];
    if (tags.length > 0) {
      const list = element(document, "ul", "joyfox-listing__tags");
      for (const tag of tags) {
        const item = element(document, "li", "joyfox-listing__tag");
        const remove = button(document, "joyfox-button", "✕", () => {
          void this.#save({ tags: tags.filter((other) => other !== tag) });
        });
        remove.setAttribute(FOCUS_KEY, `remove:${tag}`);
        const label = t(message("listing.removeTag", { tag }));
        remove.setAttribute("aria-label", label);
        remove.title = label;
        item.append(element(document, "span", "", tag), remove);
        list.append(item);
      }
      row.append(list);
    }
    const input = element(document, "input", TAG_FIELD);
    input.setAttribute(FOCUS_KEY, "tag");
    input.type = "text";
    input.maxLength = MAX_TAG_LENGTH;
    input.autocomplete = "off";
    input.value = this.#tagDraft;
    input.setAttribute("aria-label", t("listing.tagLabel"));
    input.placeholder = t("listing.tagLabel");
    const add = () => {
      if (this.#busy) return;
      const tag = input.value.trim();
      if (!tag) return this.#setStatus(message("listing.emptyTag"), true);
      if (cleanTags([...tags, tag]).length > MAX_EVENT_TAGS)
        return this.#setStatus(
          kind === "event"
            ? message("listing.tooManyTags.event", { maximum: MAX_EVENT_TAGS })
            : message("listing.tooManyTags.venue", { maximum: MAX_EVENT_TAGS }),
          true,
        );
      void this.#save({ tags: [...tags, tag] }, false, true);
    };
    input.addEventListener("input", () => {
      this.#tagDraft = input.value;
    });
    input.addEventListener("keydown", (event) => {
      event.stopPropagation();
      if (event.key === "Enter") {
        event.preventDefault();
        add();
      }
    });
    const addButton = button(
      document,
      "joyfox-button",
      t("listing.addTag"),
      add,
    );
    addButton.setAttribute(FOCUS_KEY, "add-tag");
    row.append(input, addButton);
    return row;
  }

  /**
   * While a save runs, the box's controls say they are unavailable and
   * ignore input, but keep focus, which `disabled` would drop to the page.
   */
  #markBusy(): void {
    for (const control of Array.from(
      this.#content?.querySelectorAll<HTMLElement>(
        "button, input, select, textarea",
      ) ?? [],
    )) {
      if (this.#busy) control.setAttribute("aria-disabled", "true");
      else control.removeAttribute("aria-disabled");
      if (control.tagName === "INPUT" || control.tagName === "TEXTAREA")
        (control as HTMLInputElement).readOnly = this.#busy;
    }
  }

  /** Shown in place, so the live region stays the same node. */
  #showStatus(): void {
    const node = this.#statusNode;
    if (!node) return;
    // Written only when it changes: a live region may read a rewrite again.
    const text = this.#status ? t(this.#status.text) : "";
    if (node.textContent !== text) node.textContent = text;
    node.classList.toggle("joyfox-error", this.#status?.error === true);
  }

  #setStatus(text: Message, error: boolean): void {
    this.#status = { text, error };
    this.#draw();
  }

  /**
   * Save one change on top of what is stored. The note typed but not saved
   * is kept aside unless this save is the note's own.
   */
  async #save(
    change: { note?: string; tags?: string[]; attendance?: Attendance },
    savesNote = false,
    savesTag = false,
  ): Promise<void> {
    const data = this.#saved();
    const kind = this.#kind;
    const id = this.#id;
    if (!data || !kind || !id || this.#busy) return;
    const stored = data.listing;
    const session = this.#session;
    let answer: ListingSaveAnswer;
    this.#busy = true;
    this.#markBusy();
    try {
      answer = await this.client.save({
        accountId: data.accountId,
        kind,
        eventId: id,
        note: change.note ?? stored?.note ?? "",
        tags: change.tags ?? stored?.tags ?? [],
        attendance: change.attendance ?? stored?.attendance ?? "unknown",
        facts: this.#facts(),
        expectedUpdatedAt: stored?.updatedAt ?? null,
      });
    } catch {
      if (session === this.#session)
        this.#setStatus(message("common.saveFailed"), true);
      return;
    } finally {
      this.#busy = false;
      this.#markBusy();
    }
    if (session !== this.#session) return;
    if (answer.status === "refused") {
      this.#setStatus(message("listing.refused"), true);
      void this.#load();
      return;
    }
    const listing: ListingSummary | null =
      answer.status === "removed" ? null : answer.listing;
    this.#data = { ...data, listing };
    if (answer.status === "conflict") {
      this.#setStatus(message("listing.conflict"), true);
      return;
    }
    if (savesNote) this.#draft = undefined;
    if (savesTag) this.#tagDraft = "";
    // The first save of an event or venue says that JoyFox now tracks it,
    // and the last removal that it no longer does.
    const event = kind === "event";
    this.#setStatus(
      answer.status === "removed"
        ? message(event ? "listing.removed.event" : "listing.removed.venue")
        : stored
          ? message("listing.saved")
          : message(event ? "listing.tracked.event" : "listing.tracked.venue"),
      false,
    );
  }
}
