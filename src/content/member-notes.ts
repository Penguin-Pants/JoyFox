import type { PlainKey } from "../i18n/catalog/en";
import { t } from "../i18n/translator";
import type {
  ExtensionMessage,
  ExtensionResponse,
  MemberNotesResponse,
  MessageContract,
} from "../messaging/protocol";
import { request, type MessageSender } from "../messaging/request";
import { MAX_NOTE_LENGTH, MAX_TAG_LENGTH } from "../notes/limits";
import { pageMember, type MemberPage } from "./member-panel";
import { isPlaced, placeInStrip, removeEmptyStrip } from "./member-strip";
import { button, element, UI_ATTRIBUTE } from "./triage-ui";

/** Marks the note and tag editor. */
export const MEMBER_NOTES = "member-notes";

export type SaveNoteAnswer = MessageContract["note.save"]["response"];

/**
 * What the note editor asks of the background. Content scripts run in the
 * page's origin, so notes are reachable only through messages. Tests supply
 * their own implementation.
 */
export interface NotesClient {
  getNotes(memberId: string): Promise<MemberNotesResponse>;
  saveNote(
    accountId: string,
    memberId: string,
    body: string,
    expectedBody: string | null,
  ): Promise<SaveNoteAnswer>;
  addTag(accountId: string, memberId: string, label: string): Promise<boolean>;
  removeTag(
    accountId: string,
    memberId: string,
    label: string,
  ): Promise<boolean>;
}

export function messageNotesClient(sender: MessageSender): NotesClient {
  return {
    getNotes: (memberId) => request(sender, "note.get", { memberId }),
    saveNote: (accountId, memberId, body, expectedBody) =>
      request(sender, "note.save", {
        accountId,
        memberId,
        body,
        expectedBody,
      }),
    addTag: async (accountId, memberId, label) =>
      (await request(sender, "tag.add", { accountId, memberId, label })).done,
    removeTag: async (accountId, memberId, label) =>
      (await request(sender, "tag.remove", { accountId, memberId, label }))
        .done,
  };
}

export function runtimeNotesClient(): NotesClient {
  return messageNotesClient(
    (message: ExtensionMessage) =>
      browser.runtime.sendMessage(message) as Promise<ExtensionResponse>,
  );
}

type NotesData = Extract<MemberNotesResponse, { status: "ok" }>;

interface Target {
  memberId: string;
  anchor: Element;
  /** The page and member shown; every other piece of state belongs to it. */
  key: string;
}

/** Unsaved text in the note box, and the stored note it was typed over. */
interface Draft {
  text: string;
  base: string | null;
}

/** Which control had focus before a redraw, so the redraw can restore it. */
interface FocusState {
  control: string;
  start?: number | null;
  end?: number | null;
}

const CONTROL = "data-joyfox-control";

/** Catalog keys of the editor's notices, translated when shown. */
export const NOTES_TEXT = {
  scope: "notes.scope",
  saved: "notes.saved",
  removed: "notes.removed",
  conflict: "notes.conflict",
  refused: "notes.refused",
  failed: "common.saveFailed",
  emptyTag: "notes.emptyTag",
  emptyNote: "notes.emptyNote",
  tagAdded: "notes.tagAdded",
  tagRemoved: "notes.tagRemoved",
} as const satisfies Record<string, PlainKey>;

type NotesStatus = { text: PlainKey; error: boolean };

/**
 * M5: the private note and tag editor on a conversation or profile page
 * (PRD Sections 8.4 and 10.1), placed after the JoyFox member panel, or
 * after JoyClub's header while the panel is not shown. It appears only for a
 * member whose ID resolves through a verified selector, and only while an
 * account is active; notes and tags are keyed to both.
 *
 * Typed text is kept across redraws and is never written until the user
 * saves. A save names the note it was typed over, so a newer note from
 * another tab is never overwritten unseen.
 */
export class MemberNotes {
  #page?: MemberPage;
  #key?: string;
  #data?: { key: string; value: MemberNotesResponse };
  #inFlight?: string;
  /** Bumped on every reload and leave, so a late answer is dropped. */
  #generation = 0;
  #rendered = "";
  #draft?: Draft;
  #tagDraft = "";
  #open?: boolean;
  #status?: NotesStatus;
  /**
   * Bumped whenever the shown member or the account changes. A write's
   * answer from before that must not touch the new state: the page and
   * member can be the same while the account is another.
   */
  #session = 0;
  /** The session of the save in flight, if any. */
  #savingSession?: number;
  /** The account the shown note was read for. */
  #accountId?: string;
  #writeQueue: Promise<void> = Promise.resolve();

  constructor(
    private readonly document: Document,
    private readonly client: NotesClient,
  ) {}

  update(page: MemberPage): void {
    this.#page = page;
    const member = pageMember(this.document, page);
    if (!member) {
      this.teardown();
      return;
    }
    const target: Target = {
      memberId: member.memberId,
      anchor: member.anchor,
      key: `${page}|${member.memberId}`,
    };
    // A client-side route to another member: the old member's note and
    // typed text go at once, before the new answer arrives.
    if (target.key !== this.#key) {
      this.#forget();
      this.teardown();
      this.#key = target.key;
    }
    const data = this.#data?.key === target.key ? this.#data.value : undefined;
    if (!data) {
      this.#load(target);
      return;
    }
    this.#render(target, data);
  }

  /** Read the note again, keeping any typed text. */
  invalidate(): void {
    this.#generation += 1;
    this.#data = undefined;
    this.#inFlight = undefined;
    if (this.#page) this.update(this.#page);
  }

  /**
   * The active account changed. The editor shows the previous account's
   * note, so it goes at once, and typed text is dropped: it must never be
   * saved into the newly active account.
   */
  accountChanged(): void {
    this.teardown();
    this.#forget();
    this.invalidate();
  }

  /**
   * Called when the page is no longer a conversation or profile. JoyClub can
   * hide the header for a moment while it re-renders, so typed text is kept
   * for the same member; another member or account drops it.
   */
  leave(): void {
    this.#page = undefined;
    this.#generation += 1;
    this.#inFlight = undefined;
    this.#data = undefined;
    this.#status = undefined;
    this.teardown();
  }

  /**
   * The language changed: draw the editor again. Typed text, the open state
   * and the status stay; the status is shown in the new language.
   */
  localeChanged(): void {
    this.#rendered = "";
    if (this.#page) this.update(this.#page);
  }

  teardown(): void {
    for (const node of Array.from(
      this.document.querySelectorAll(`[${UI_ATTRIBUTE}="${MEMBER_NOTES}"]`),
    ))
      node.remove();
    removeEmptyStrip(this.document);
    this.#rendered = "";
  }

  #forget(): void {
    this.#dropTyped();
    this.#key = undefined;
    this.#data = undefined;
    this.#accountId = undefined;
    this.#open = undefined;
    this.#status = undefined;
  }

  /** Typed text belongs to one member and account; answers to it lapse. */
  #dropTyped(): void {
    this.#session += 1;
    this.#draft = undefined;
    this.#tagDraft = "";
  }

  #element(): HTMLElement | null {
    return this.document.querySelector(`[${UI_ATTRIBUTE}="${MEMBER_NOTES}"]`);
  }

  #load(target: Target): void {
    if (this.#inFlight === target.key) return;
    this.#inFlight = target.key;
    const generation = this.#generation;
    this.client
      .getNotes(target.memberId)
      .then((value) => {
        if (generation !== this.#generation || this.#key !== target.key) return;
        this.#inFlight = undefined;
        // The account can change before this tab hears of the switch, for
        // example when a save is refused and the editor reloads. Text typed
        // for the previous account must never be saved into this one.
        const accountId = value.status === "ok" ? value.accountId : undefined;
        if (this.#accountId !== undefined && accountId !== this.#accountId) {
          // A status about the previous account's note goes too, except the
          // notice that typed text was dropped.
          const typed = this.#draft !== undefined || this.#tagDraft !== "";
          this.#dropTyped();
          if (typed) this.#status = { text: NOTES_TEXT.refused, error: true };
          else if (this.#status?.text !== NOTES_TEXT.refused)
            this.#status = undefined;
          this.#rendered = "";
        }
        this.#accountId = accountId;
        this.#data = { key: target.key, value };
        if (this.#page) this.update(this.#page);
      })
      .catch(() => {
        if (generation !== this.#generation || this.#inFlight !== target.key)
          return;
        // Fail closed: without an answer, show nothing.
        this.#inFlight = undefined;
        this.teardown();
      });
  }

  #render(target: Target, data: MemberNotesResponse): void {
    if (data.status !== "ok") {
      this.teardown();
      return;
    }
    const existing = this.#element();
    const key = JSON.stringify([target.key, data]);
    if (existing && key === this.#rendered && isPlaced(existing, target.anchor))
      return;
    const focus = this.#focusState(existing);
    existing?.remove();
    const section = this.#build(target, data);
    placeInStrip(this.document, target.anchor, section);
    this.#rendered = key;
    this.#restoreFocus(section, focus);
  }

  #build(target: Target, data: NotesData): HTMLElement {
    const document = this.document;
    const section = element(document, "section", "joyfox-panel joyfox-notes");
    section.setAttribute(UI_ATTRIBUTE, MEMBER_NOTES);
    section.setAttribute("data-member", target.memberId);
    section.setAttribute("aria-label", t("notes.region"));
    const details = element(document, "details", "joyfox-notes__details");
    // Closed until opened (owner decision, 2026-09-24: details on demand).
    // The summary still says whether a note or tags exist.
    details.open = this.#open ?? false;
    details.addEventListener("toggle", () => {
      if (details.isConnected) this.#open = details.open;
    });
    const summary = element(
      document,
      "summary",
      "joyfox-notes__summary",
      summaryText(data),
    );
    summary.setAttribute(CONTROL, "summary");
    details.append(
      summary,
      element(document, "p", "joyfox-note", t(NOTES_TEXT.scope)),
    );

    const noteLabel = element(
      document,
      "label",
      "joyfox-notes__label",
      t("notes.privateNote"),
    );
    noteLabel.htmlFor = "joyfox-note-text";
    const note = element(document, "textarea", "joyfox-notes__text");
    note.id = "joyfox-note-text";
    note.rows = 3;
    note.maxLength = MAX_NOTE_LENGTH;
    note.setAttribute(CONTROL, "note");
    note.value = this.#draft?.text ?? data.note ?? "";
    const discard = button(
      document,
      "joyfox-button",
      t("notes.discard"),
      () => {
        this.#draft = undefined;
        this.#setStatus(undefined);
        this.#rendered = "";
        if (this.#page) this.update(this.#page);
      },
    );
    discard.setAttribute(CONTROL, "discard-note");
    discard.disabled = this.#draft === undefined;
    note.addEventListener("input", () => {
      // Kept in place: redrawing on a keystroke would break text input.
      this.#draft = {
        text: note.value,
        base: this.#draft ? this.#draft.base : data.note,
      };
      discard.disabled = false;
    });
    const save = button(document, "joyfox-button", t("notes.save"), () =>
      this.#saveNote(target, data, note.value),
    );
    save.setAttribute(CONTROL, "save-note");
    const noteActions = element(document, "div", "joyfox-actions");
    noteActions.append(save, discard);
    details.append(noteLabel, note, noteActions);

    details.append(
      element(document, "h3", "joyfox-notes__heading", t("notes.tags")),
    );
    if (data.tags.length === 0)
      details.append(element(document, "p", "joyfox-note", t("notes.noTags")));
    else {
      const list = element(document, "ul", "joyfox-notes__tags");
      list.setAttribute("aria-label", t("notes.tags"));
      for (const label of data.tags) {
        const item = element(document, "li", "joyfox-notes__tag");
        const remove = button(
          document,
          "joyfox-button",
          t("notes.remove"),
          () => this.#removeTag(target, data, label),
        );
        remove.setAttribute("aria-label", t("notes.removeTag", { label }));
        remove.setAttribute(CONTROL, `remove-tag:${label}`);
        item.append(element(document, "span", "", label), remove);
        list.append(item);
      }
      details.append(list);
    }
    const tagLabel = element(
      document,
      "label",
      "joyfox-notes__label",
      t("notes.addTagLabel"),
    );
    tagLabel.htmlFor = "joyfox-tag-input";
    const tagInput = element(document, "input", "joyfox-notes__tag-input");
    tagInput.type = "text";
    tagInput.id = "joyfox-tag-input";
    tagInput.maxLength = MAX_TAG_LENGTH;
    tagInput.setAttribute(CONTROL, "tag-input");
    tagInput.value = this.#tagDraft;
    tagInput.addEventListener("input", () => {
      this.#tagDraft = tagInput.value;
    });
    tagInput.addEventListener("keydown", (event) => {
      if (event.key !== "Enter" || event.isComposing) return;
      event.preventDefault();
      event.stopPropagation();
      this.#addTag(target, data, tagInput.value);
    });
    const add = button(document, "joyfox-button", t("notes.addTag"), () =>
      this.#addTag(target, data, tagInput.value),
    );
    add.setAttribute(CONTROL, "add-tag");
    const tagRow = element(document, "div", "joyfox-actions");
    tagRow.append(tagInput, add);
    details.append(tagLabel, tagRow);

    const status = element(document, "p", "joyfox-notes__status");
    status.setAttribute("role", "status");
    status.setAttribute("aria-live", "polite");
    details.append(status);
    section.append(details);
    this.#showStatus(status);
    return section;
  }

  #saveNote(target: Target, data: NotesData, body: string): void {
    // A second click while a save runs would name the note this editor is
    // replacing and report a false conflict, so it is ignored. A save for
    // another member or account does not block this one.
    const session = this.#session;
    if (this.#savingSession === session) return;
    // Taken at click time: a redraw while this save waits must not change
    // which stored note it may replace.
    const expected = this.#draft ? this.#draft.base : data.note;
    if (body.trim().length === 0 && expected === null) {
      this.#setStatus({ text: NOTES_TEXT.emptyNote, error: true });
      return;
    }
    this.#savingSession = session;
    this.#write(session, async () => {
      const answer = await this.client
        .saveNote(data.accountId, target.memberId, body, expected)
        .finally(() => {
          if (this.#savingSession === session) this.#savingSession = undefined;
        });
      if (this.#session !== session) return;
      if (answer.status === "refused") {
        this.#dropTyped();
        this.#setStatus({ text: NOTES_TEXT.refused, error: true });
        return;
      }
      if (answer.status === "conflict") {
        // The next save replaces the note that is stored now.
        this.#draft = { text: this.#draft?.text ?? body, base: answer.current };
        this.#setStatus({ text: NOTES_TEXT.conflict, error: true });
        return;
      }
      // Text typed while the save ran stays a draft over the saved note.
      if (this.#draft && this.#draft.text !== body)
        this.#draft = { text: this.#draft.text, base: answer.current };
      else this.#draft = undefined;
      this.#setStatus({
        text: answer.current === null ? NOTES_TEXT.removed : NOTES_TEXT.saved,
        error: false,
      });
    });
  }

  #addTag(target: Target, data: NotesData, label: string): void {
    const typed = label;
    if (label.trim().length === 0) {
      this.#setStatus({ text: NOTES_TEXT.emptyTag, error: true });
      return;
    }
    const session = this.#session;
    this.#write(session, async () => {
      const done = await this.client.addTag(
        data.accountId,
        target.memberId,
        label,
      );
      if (this.#session !== session) return;
      if (!done) {
        this.#dropTyped();
        this.#setStatus({ text: NOTES_TEXT.refused, error: true });
        return;
      }
      if (this.#tagDraft === typed) this.#tagDraft = "";
      this.#setStatus({ text: NOTES_TEXT.tagAdded, error: false });
    });
  }

  #removeTag(target: Target, data: NotesData, label: string): void {
    const session = this.#session;
    this.#write(session, async () => {
      const done = await this.client.removeTag(
        data.accountId,
        target.memberId,
        label,
      );
      if (this.#session !== session) return;
      if (!done) this.#dropTyped();
      this.#setStatus(
        done
          ? { text: NOTES_TEXT.tagRemoved, error: false }
          : { text: NOTES_TEXT.refused, error: true },
      );
    });
  }

  /**
   * Writes run one after another, in click order, then the note is read
   * again. A failure keeps typed text and says nothing was changed.
   */
  #write(session: number, action: () => Promise<void>): void {
    this.#writeQueue = this.#writeQueue.then(() =>
      action()
        .catch(() => {
          if (this.#session === session)
            this.#setStatus({ text: NOTES_TEXT.failed, error: true });
        })
        .then(() => {
          this.#rendered = "";
          this.invalidate();
        }),
    );
  }

  /** Shown in place, so a status change does not redraw the editor. */
  #setStatus(status: NotesStatus | undefined): void {
    this.#status = status;
    const node = this.#element()?.querySelector<HTMLElement>(
      ".joyfox-notes__status",
    );
    if (node) this.#showStatus(node);
  }

  #showStatus(node: HTMLElement): void {
    node.textContent = this.#status ? t(this.#status.text) : "";
    node.classList.toggle("joyfox-error", this.#status?.error === true);
  }

  #focusState(existing: Element | null): FocusState | undefined {
    const active = this.document.activeElement;
    if (!existing || !active || !existing.contains(active)) return undefined;
    const control = active.getAttribute(CONTROL);
    if (!control) return undefined;
    const field = active as HTMLTextAreaElement | HTMLInputElement;
    return "selectionStart" in field
      ? { control, start: field.selectionStart, end: field.selectionEnd }
      : { control };
  }

  #restoreFocus(section: HTMLElement, focus: FocusState | undefined): void {
    if (!focus) return;
    const find = (control: string) =>
      Array.from(section.querySelectorAll<HTMLElement>(`[${CONTROL}]`)).find(
        (node) => node.getAttribute(CONTROL) === control,
      );
    // A removed tag's button is gone, and "Discard my changes" is disabled
    // after a discard. Focus then moves to the field beside it rather than
    // falling back to the top of the page.
    const usable = (node: HTMLElement | undefined) =>
      node && !(node as HTMLButtonElement).disabled ? node : undefined;
    const fallback = focus.control.startsWith("remove-tag:")
      ? "tag-input"
      : focus.control === "discard-note" || focus.control === "save-note"
        ? "note"
        : undefined;
    const target =
      usable(find(focus.control)) ??
      (fallback ? usable(find(fallback)) : undefined);
    if (!target) return;
    // Only the summary stays reachable inside a closed editor.
    if (target.closest("details:not([open])") && target.tagName !== "SUMMARY")
      return;
    target.focus({ preventScroll: true });
    if (
      focus.start !== undefined &&
      focus.start !== null &&
      "setSelectionRange" in target
    )
      (target as HTMLTextAreaElement).setSelectionRange(
        focus.start,
        focus.end ?? focus.start,
      );
  }
}

function summaryText(data: NotesData): string {
  const count = data.tags.length;
  if (data.note !== null)
    return count > 0
      ? t("notes.summary.noteAndTags", { count })
      : t("notes.summary.note");
  return count > 0
    ? t("notes.summary.tags", { count })
    : t("notes.summary.none");
}
