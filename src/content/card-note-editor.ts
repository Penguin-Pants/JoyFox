import { message, type Message } from "../i18n/message";
import { t } from "../i18n/translator";
import type { MemberNotesResponse } from "../messaging/protocol";
import { MAX_NOTE_LENGTH, MAX_TAG_LENGTH } from "../notes/limits";
import {
  FOCUS_KEY,
  rememberFocus,
  restoreFocus,
  type FocusMemo,
} from "../ui/focus";
import { NOTES_TEXT, noteLength, type NotesClient } from "./member-notes";
import { button, element, UI_ATTRIBUTE } from "./triage-ui";

/** Marks the editor that a card's note button opens (V1-10). */
export const CARD_EDITOR = "card-editor";

type Loaded = Extract<MemberNotesResponse, { status: "ok" }>;

/**
 * Where focus goes when a redraw removed the focused control: a removed
 * tag's button leaves it to the tag box, a disabled "Discard my changes" to
 * the note box. "Close" is always there.
 */
function fallbacks(memo: FocusMemo | undefined): string[] {
  if (memo?.key.startsWith("remove:")) return ["tag", "close"];
  if (memo?.key === "discard" || memo?.key === "save") return ["note", "close"];
  return ["close"];
}

/**
 * V1-10: the note and tags of one member, edited from a card (PRD 6.2, 8.4).
 * It opens as a panel fixed to the window, outside JoyClub's cards, because
 * a card is a link: a click in a text box inside it would open the profile.
 * Notes and tags are the same records the profile page edits, keyed to the
 * member ID. A save names the note it was typed over, so a newer note from
 * another tab is never overwritten unseen.
 *
 * The panel sits at the end of the page, so it takes keyboard focus when it
 * opens and gives it back to the member's note button when it closes.
 */
export class CardNoteEditor {
  #root?: HTMLElement;
  #heading?: HTMLElement;
  /** The part each draw replaces; the heading, notice and Close stay. */
  #body?: HTMLElement;
  #statusNode?: HTMLElement;
  #closeButton?: HTMLButtonElement;
  #memberId?: string;
  #name?: string;
  #data?: Loaded;
  #status?: { text: Message; error: boolean };
  #returnFocus?: HTMLElement;
  /** The note box takes focus once drawn, while focus is still on the panel. */
  #focusNote = false;
  /** Bumped on open and close, so a late answer is dropped. */
  #session = 0;
  #loadSequence = 0;
  /** Set while the shown notice is a failed read's. */
  #readFailed = false;
  #busy = false;
  /**
   * Typed text not saved yet, and the stored note it was typed over. A save
   * names that note, not one read later, so a newer note from another tab is
   * reported as a conflict instead of being overwritten unseen.
   */
  #noteDraft?: { text: string; base: string | null };
  #tagDraft = "";

  constructor(
    private readonly document: Document,
    private readonly client: NotesClient,
    /**
     * The member's note button on the cards shown now. The cards draw their
     * chips again after a save, so the button the editor opened from can be
     * gone when it closes.
     */
    private readonly noteButton: (
      memberId: string,
    ) => HTMLElement | undefined = () => undefined,
  ) {}

  /** The member as the title names them: the nickname, else the number. */
  #member(memberId: string): string {
    return this.#name ?? t(message("member.number", { id: memberId }));
  }

  get memberId(): string | undefined {
    return this.#memberId;
  }

  /** `name`: the nickname the card shows, for the editor's title. */
  open(memberId: string, returnFocus?: HTMLElement, name?: string): void {
    this.close();
    this.#memberId = memberId;
    this.#name = name;
    this.#returnFocus = returnFocus;
    const document = this.document;
    const root = element(document, "div", "joyfox-panel joyfox-card-editor");
    root.setAttribute(UI_ATTRIBUTE, CARD_EDITOR);
    root.setAttribute("role", "dialog");
    // Focusable itself, so focus can wait here until the note box is drawn.
    root.tabIndex = -1;
    root.addEventListener("keydown", (event) => {
      if (event.key === "Escape") this.close();
    });
    const heading = element(document, "strong", "joyfox-card-editor__heading");
    const body = element(document, "div", "joyfox-card-editor__body");
    // One live region for the panel's life, so each notice is announced.
    const status = element(document, "p", "joyfox-card-editor__status");
    status.setAttribute("role", "status");
    status.setAttribute("aria-live", "polite");
    const close = button(document, "joyfox-button", "", () => this.close());
    close.setAttribute(FOCUS_KEY, "close");
    root.append(heading, body, status, close);
    this.#root = root;
    this.#heading = heading;
    this.#body = body;
    this.#statusNode = status;
    this.#closeButton = close;
    this.#focusNote = true;
    document.body.append(root);
    this.#draw();
    root.focus({ preventScroll: true });
    void this.#load();
  }

  close(): void {
    const memberId = this.#memberId;
    const root = this.#root;
    const active = this.document.activeElement;
    // Focus goes back only from the panel, never from elsewhere on the page.
    const hadFocus =
      !active || active === this.document.body || root?.contains(active);
    this.#session += 1;
    root?.remove();
    this.#root = undefined;
    this.#heading = undefined;
    this.#body = undefined;
    this.#statusNode = undefined;
    this.#closeButton = undefined;
    this.#memberId = undefined;
    this.#name = undefined;
    this.#data = undefined;
    this.#status = undefined;
    this.#busy = false;
    this.#noteDraft = undefined;
    this.#tagDraft = "";
    this.#readFailed = false;
    this.#focusNote = false;
    const focus = this.#returnFocus;
    this.#returnFocus = undefined;
    if (!root || !hadFocus) return;
    const target = focus?.isConnected
      ? focus
      : memberId
        ? this.noteButton(memberId)
        : undefined;
    target?.focus({ preventScroll: true });
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
    // Each read has its own number: an older read that finishes last must
    // not replace a newer one.
    const sequence = (this.#loadSequence += 1);
    const current = () =>
      session === this.#session && sequence === this.#loadSequence;
    const memberId = this.#memberId;
    if (!memberId) return;
    try {
      const answer = await this.client.getNotes(memberId);
      if (!current()) return;
      const account = answer.status === "ok" ? answer.accountId : undefined;
      // Text typed for one account must never be saved into another: a
      // reload that answers for another account drops it, as the profile
      // page's editor does.
      if (this.#data && this.#data.accountId !== account) {
        this.#noteDraft = undefined;
        this.#tagDraft = "";
        this.#status = undefined;
      }
      if (answer.status !== "ok") {
        this.#data = undefined;
        this.#status = {
          text: message("signals.editor.noAccount"),
          error: true,
        };
      } else {
        this.#data = answer;
        // A read that works again clears the notice of the one that failed.
        if (this.#readFailed) this.#status = undefined;
      }
      this.#readFailed = false;
    } catch {
      if (!current()) return;
      this.#readFailed = true;
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

  /** Shown in place, so the live region stays the same node. */
  #showStatus(): void {
    const node = this.#statusNode;
    if (!node) return;
    // Written only when it changes: a live region may read a rewrite again.
    const text = this.#status ? t(this.#status.text) : "";
    if (node.textContent !== text) node.textContent = text;
    node.classList.toggle("joyfox-error", this.#status?.error === true);
  }

  #draw(): void {
    const root = this.#root;
    const body = this.#body;
    const memberId = this.#memberId;
    if (!root || !body || !memberId) return;
    const document = this.document;
    // Every draw replaces the fields, also for a change in another tab, so
    // the focused control is found again by its key.
    const memo = rememberFocus(root);
    const label = t(
      message("signals.editor.label", { member: this.#member(memberId) }),
    );
    root.setAttribute("aria-label", label);
    if (this.#heading && this.#heading.textContent !== label)
      this.#heading.textContent = label;
    const close = t("signals.editor.close");
    if (this.#closeButton && this.#closeButton.textContent !== close)
      this.#closeButton.textContent = close;
    body.replaceChildren();
    const data = this.#data;
    if (data) body.append(...this.#fields(data, memberId));
    else if (!this.#status)
      body.append(
        element(document, "p", "joyfox-note", t("signals.editor.loading")),
      );
    this.#showStatus();
    restoreFocus(root, memo, fallbacks(memo));
    if (data && this.#focusNote) {
      this.#focusNote = false;
      if (document.activeElement === root)
        root
          .querySelector<HTMLElement>(`[${FOCUS_KEY}="note"]`)
          ?.focus({ preventScroll: true });
    }
  }

  #fields(data: Loaded, memberId: string): HTMLElement[] {
    const document = this.document;
    // While a write runs, the controls keep focus: the boxes are read-only
    // and the buttons say they are unavailable, where `disabled` would drop
    // focus to the page. `#write` ignores a second write meanwhile.
    const busy = this.#busy;
    const unavailable = (control: HTMLButtonElement) => {
      if (busy) control.setAttribute("aria-disabled", "true");
      return control;
    };
    const noteId = `joyfox-card-note-${memberId}`;
    const noteLabel = element(document, "label", "", t("notes.privateNote"));
    noteLabel.htmlFor = noteId;
    const note = element(document, "textarea", "joyfox-card-editor__note");
    note.id = noteId;
    note.maxLength = MAX_NOTE_LENGTH;
    note.rows = 3;
    note.readOnly = busy;
    note.setAttribute(FOCUS_KEY, "note");
    // Typed text survives a redraw (a save elsewhere, a new language).
    note.value = this.#noteDraft?.text ?? data.note ?? "";
    const discard = unavailable(
      button(document, "joyfox-button", t("notes.discard"), () => {
        if (this.#busy) return;
        this.#noteDraft = undefined;
        this.#status = undefined;
        this.#draw();
      }),
    );
    discard.setAttribute(FOCUS_KEY, "discard");
    discard.disabled = this.#noteDraft === undefined;
    note.addEventListener("input", () => {
      this.#noteDraft = {
        text: note.value,
        base: this.#noteDraft ? this.#noteDraft.base : data.note,
      };
      discard.disabled = false;
    });
    const length = noteLength(
      document,
      note,
      `joyfox-card-note-length-${memberId}`,
      () => {
        this.#status = { text: message(NOTES_TEXT.pasteCut), error: true };
        this.#showStatus();
      },
    );
    const save = unavailable(
      button(
        document,
        "joyfox-button",
        t("notes.save"),
        () =>
          void this.#write(async (current) => {
            // Sent as typed, as on the profile page; storage trims it.
            const body = note.value;
            const expected = this.#noteDraft
              ? this.#noteDraft.base
              : current.note;
            if (!body.trim() && expected === null)
              return { text: message(NOTES_TEXT.emptyNote), error: true };
            const answer = await this.client.saveNote(
              current.accountId,
              memberId,
              body,
              expected,
            );
            if (answer.status === "saved") {
              // Saved: the redraw shows the stored note.
              this.#noteDraft = undefined;
              return {
                text: message(
                  answer.current === null
                    ? NOTES_TEXT.removed
                    : NOTES_TEXT.saved,
                ),
                error: false,
              };
            }
            // A newer note, or another account: the typed text stays. After
            // a conflict, as on the profile page, the next save replaces the
            // note that is stored now: the user has been told, and "Discard
            // my changes" shows it.
            if (answer.status === "conflict")
              this.#noteDraft = {
                text: this.#noteDraft?.text ?? body,
                base: answer.current,
              };
            return {
              text: message(
                answer.status === "conflict"
                  ? NOTES_TEXT.conflict
                  : NOTES_TEXT.refused,
              ),
              error: true,
            };
          }),
      ),
    );
    save.setAttribute(FOCUS_KEY, "save");
    const noteActions = element(document, "div", "joyfox-actions");
    noteActions.append(save, discard);

    const tagsHeading = element(document, "p", "", t("notes.tags"));
    const list = element(document, "ul", "joyfox-card-editor__tags");
    for (const label of data.tags) {
      const item = element(document, "li", "", label);
      const remove = unavailable(
        button(
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
        ),
      );
      remove.setAttribute(
        "aria-label",
        t(message("notes.removeTag", { label })),
      );
      remove.setAttribute(FOCUS_KEY, `remove:${label}`);
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
    tag.readOnly = busy;
    tag.setAttribute(FOCUS_KEY, "tag");
    tag.value = this.#tagDraft;
    tag.addEventListener("input", () => {
      this.#tagDraft = tag.value;
    });
    const addTag = () =>
      void this.#write(async (current) => {
        const label = tag.value.trim();
        if (!label) return { text: message(NOTES_TEXT.emptyTag), error: true };
        const done = await this.client.addTag(
          current.accountId,
          memberId,
          label,
        );
        if (!done) return { text: message(NOTES_TEXT.refused), error: true };
        this.#tagDraft = "";
        return {
          text: message(
            done === "exists" ? NOTES_TEXT.tagExists : NOTES_TEXT.tagAdded,
          ),
          error: false,
        };
      });
    // Enter adds the tag, as in the profile page's editor.
    tag.addEventListener("keydown", (event) => {
      if (event.key !== "Enter" || event.isComposing) return;
      event.preventDefault();
      event.stopPropagation();
      // Read-only while a write or its redraw is on its way, like the buttons.
      if (tag.readOnly) return;
      addTag();
    });
    const add = unavailable(
      button(document, "joyfox-button", t("notes.addTag"), addTag),
    );
    add.setAttribute(FOCUS_KEY, "add");
    return [
      element(document, "p", "joyfox-note", t(NOTES_TEXT.scope)),
      noteLabel,
      note,
      length,
      noteActions,
      tagsHeading,
      list,
      tagLabel,
      tag,
      add,
    ];
  }
}
