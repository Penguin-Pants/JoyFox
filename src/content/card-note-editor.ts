import { message, type Message } from "../i18n/message";
import { t } from "../i18n/translator";
import type { MemberNotesResponse } from "../messaging/protocol";
import { MAX_NOTE_LENGTH, MAX_TAG_LENGTH } from "../notes/limits";
import { NOTES_TEXT, type NotesClient } from "./member-notes";
import { button, element, UI_ATTRIBUTE } from "./triage-ui";

/** Marks the editor that a card's note button opens (V1-10). */
export const CARD_EDITOR = "card-editor";

type Loaded = Extract<MemberNotesResponse, { status: "ok" }>;

/**
 * V1-10: the note and tags of one member, edited from a card (PRD 6.2, 8.4).
 * It opens as a panel fixed to the window, outside JoyClub's cards, because
 * a card is a link: a click in a text box inside it would open the profile.
 * Notes and tags are the same records the profile page edits, keyed to the
 * member ID. A save names the note it was typed over, so a newer note from
 * another tab is never overwritten unseen.
 */
export class CardNoteEditor {
  #root?: HTMLElement;
  #memberId?: string;
  #data?: Loaded;
  #status?: { text: Message; error: boolean };
  #returnFocus?: HTMLElement;
  /** Bumped on open and close, so a late answer is dropped. */
  #session = 0;
  #busy = false;
  /** Typed text not saved yet; kept across redraws and a conflict. */
  #noteDraft?: string;
  #tagDraft = "";

  constructor(
    private readonly document: Document,
    private readonly client: NotesClient,
  ) {}

  get memberId(): string | undefined {
    return this.#memberId;
  }

  open(memberId: string, returnFocus?: HTMLElement): void {
    this.close();
    this.#memberId = memberId;
    this.#returnFocus = returnFocus;
    const root = element(
      this.document,
      "div",
      "joyfox-panel joyfox-card-editor",
    );
    root.setAttribute(UI_ATTRIBUTE, CARD_EDITOR);
    root.setAttribute("role", "dialog");
    root.setAttribute(
      "aria-label",
      t(message("signals.editor.label", { member: memberId })),
    );
    root.addEventListener("keydown", (event) => {
      if (event.key === "Escape") this.close();
    });
    this.#root = root;
    this.document.body.append(root);
    this.#draw();
    void this.#load();
  }

  close(): void {
    this.#session += 1;
    this.#root?.remove();
    this.#root = undefined;
    this.#memberId = undefined;
    this.#data = undefined;
    this.#status = undefined;
    this.#busy = false;
    this.#noteDraft = undefined;
    this.#tagDraft = "";
    const focus = this.#returnFocus;
    this.#returnFocus = undefined;
    if (focus?.isConnected) focus.focus({ preventScroll: true });
  }

  /** Another tab or the account changed: read the member again. */
  invalidate(): void {
    if (this.#memberId) void this.#load();
  }

  localeChanged(): void {
    if (this.#root) this.#draw();
  }

  async #load(): Promise<void> {
    const session = this.#session;
    const memberId = this.#memberId;
    if (!memberId) return;
    try {
      const answer = await this.client.getNotes(memberId);
      if (session !== this.#session) return;
      if (answer.status !== "ok") {
        this.#data = undefined;
        this.#status = {
          text: message("signals.editor.noAccount"),
          error: true,
        };
      } else this.#data = answer;
    } catch {
      if (session !== this.#session) return;
      this.#status = {
        text: message("signals.editor.readFailed"),
        error: true,
      };
    }
    this.#draw();
  }

  /** Runs one write, then reads the member again. */
  async #write(
    action: (data: Loaded) => Promise<{ text: Message; error: boolean }>,
  ): Promise<void> {
    const data = this.#data;
    if (!data || this.#busy) return;
    const session = this.#session;
    this.#busy = true;
    this.#draw();
    let status: { text: Message; error: boolean };
    try {
      status = await action(data);
    } catch {
      status = { text: message(NOTES_TEXT.failed), error: true };
    }
    if (session !== this.#session) return;
    this.#busy = false;
    this.#status = status;
    await this.#load();
  }

  #draw(): void {
    const root = this.#root;
    const memberId = this.#memberId;
    if (!root || !memberId) return;
    const document = this.document;
    root.replaceChildren(
      element(
        document,
        "strong",
        "joyfox-card-editor__heading",
        t(message("signals.editor.label", { member: memberId })),
      ),
    );
    const data = this.#data;
    if (data) {
      const noteId = `joyfox-card-note-${memberId}`;
      const noteLabel = element(document, "label", "", t("notes.privateNote"));
      noteLabel.htmlFor = noteId;
      const note = element(document, "textarea", "joyfox-card-editor__note");
      note.id = noteId;
      note.maxLength = MAX_NOTE_LENGTH;
      note.rows = 3;
      // Typed text survives a redraw (a save elsewhere, a new language).
      note.value = this.#noteDraft ?? data.note ?? "";
      note.addEventListener("input", () => {
        this.#noteDraft = note.value;
      });
      const save = button(
        document,
        "joyfox-button",
        t("notes.save"),
        () =>
          void this.#write(async (current) => {
            const body = note.value.trim();
            if (!body && current.note === null)
              return { text: message(NOTES_TEXT.emptyNote), error: true };
            const answer = await this.client.saveNote(
              current.accountId,
              memberId,
              body,
              current.note,
            );
            if (answer.status === "saved") {
              // Saved: the redraw shows the stored note.
              this.#noteDraft = undefined;
              return {
                text: message(body ? NOTES_TEXT.saved : NOTES_TEXT.removed),
                error: false,
              };
            }
            // A newer note, or another account: the typed text stays.
            return {
              text: message(
                answer.status === "conflict"
                  ? NOTES_TEXT.conflict
                  : NOTES_TEXT.refused,
              ),
              error: true,
            };
          }),
      );
      const tagsHeading = element(document, "p", "", t("notes.tags"));
      const list = element(document, "ul", "joyfox-card-editor__tags");
      for (const label of data.tags) {
        const item = element(document, "li", "", label);
        const remove = button(
          document,
          "joyfox-button",
          t("notes.remove"),
          () =>
            void this.#write(async (current) => {
              const done = await this.client.removeTag(
                current.accountId,
                memberId,
                label,
              );
              return done
                ? { text: message(NOTES_TEXT.tagRemoved), error: false }
                : { text: message(NOTES_TEXT.refused), error: true };
            }),
        );
        remove.setAttribute(
          "aria-label",
          t(message("notes.removeTag", { label })),
        );
        item.append(" ", remove);
        list.append(item);
      }
      if (data.tags.length === 0)
        list.append(element(document, "li", "", t("notes.noTags")));
      const tagId = `joyfox-card-tag-${memberId}`;
      const tagLabel = element(document, "label", "", t("notes.addTagLabel"));
      tagLabel.htmlFor = tagId;
      const tag = element(document, "input", "joyfox-card-editor__tag");
      tag.id = tagId;
      tag.maxLength = MAX_TAG_LENGTH;
      tag.value = this.#tagDraft;
      tag.addEventListener("input", () => {
        this.#tagDraft = tag.value;
      });
      const add = button(
        document,
        "joyfox-button",
        t("notes.addTag"),
        () =>
          void this.#write(async (current) => {
            const label = tag.value.trim();
            if (!label)
              return { text: message(NOTES_TEXT.emptyTag), error: true };
            const done = await this.client.addTag(
              current.accountId,
              memberId,
              label,
            );
            if (!done)
              return { text: message(NOTES_TEXT.refused), error: true };
            this.#tagDraft = "";
            return { text: message(NOTES_TEXT.tagAdded), error: false };
          }),
      );
      for (const control of [note, save, tag, add])
        control.disabled = this.#busy;
      root.append(noteLabel, note, save, tagsHeading, list, tagLabel, tag, add);
    } else if (!this.#status)
      root.append(
        element(document, "p", "joyfox-note", t("signals.editor.loading")),
      );
    const status = element(document, "p", "joyfox-card-editor__status");
    status.setAttribute("role", "status");
    if (this.#status) {
      status.textContent = t(this.#status.text);
      if (this.#status.error) status.classList.add("joyfox-error");
    }
    root.append(
      status,
      button(document, "joyfox-button", t("signals.editor.close"), () =>
        this.close(),
      ),
    );
  }
}
