import { AccountService } from "../accounts/account-service";
import type { MessageTemplate } from "../domain/types";
import { message, type Message } from "../i18n/message";
import { errorDisplay, t } from "../i18n/translator";
import {
  compareTemplates,
  DEFAULT_FOLDER,
  folderOf,
  MAX_TEMPLATE_BODY_LENGTH,
  MAX_TEMPLATE_FOLDER_LENGTH,
  MAX_TEMPLATE_NAME_LENGTH,
  SUGGESTED_FOLDERS,
  TemplateService,
} from "../templates/template-service";
import { confirmAllowed, confirmTiming } from "./confirm";
import { StatusLine } from "./status-line";

function element<K extends keyof HTMLElementTagNameMap>(
  document: Document,
  tag: K,
  className: string,
  text?: string,
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  node.className = className;
  // Template text is user input and is always set as text, never as markup.
  if (text !== undefined) node.textContent = text;
  return node;
}

const PREVIEW_LENGTH = 120;

function preview(body: string): string {
  const flat = body.replace(/\s+/gu, " ").trim();
  return flat.length > PREVIEW_LENGTH
    ? `${flat.slice(0, PREVIEW_LENGTH)}…`
    : flat;
}

interface TemplateForm {
  /** The template the form edits, or `undefined` for a new one. */
  editingId: string | undefined;
  form: HTMLFormElement;
  name: HTMLInputElement;
  folder: HTMLInputElement;
  body: HTMLTextAreaElement;
}

/**
 * M10 on the options page: create, edit, delete and organize the active
 * account's message templates into folders. Inserting happens on JoyClub's
 * own composer; this panel never sends anything.
 */
export class TemplatePanel {
  readonly #status: StatusLine;
  /** Bumped per render, so a slower, older render never replaces a newer one. */
  #generation = 0;
  /** The account the list and form were drawn for. */
  #accountId: string | undefined;
  #editing: MessageTemplate | undefined;
  #pendingDelete: string | undefined;
  #armedAt = 0;
  #form: TemplateForm | undefined;
  /** Set while a save runs, so a double submit cannot add a template twice. */
  #saving = false;
  readonly #guard = {
    activeAccountId: () => this.accounts.getActiveAccountId(),
  };

  constructor(
    private readonly root: HTMLElement,
    private readonly templates = new TemplateService(),
    private readonly accounts = new AccountService(),
    private readonly onChange: () => void = () => undefined,
  ) {
    this.#status = new StatusLine(root.ownerDocument);
  }

  async render(): Promise<void> {
    const generation = (this.#generation += 1);
    const document = this.root.ownerDocument;
    let accountId: string | undefined;
    let templates: MessageTemplate[];
    try {
      accountId = (await this.accounts.getActiveAccount())?.id;
      templates = accountId ? await this.templates.list(accountId) : [];
    } catch {
      if (generation === this.#generation)
        this.root.textContent = t("templates.readFailed");
      return;
    }
    if (generation !== this.#generation) return;
    if (accountId !== this.#accountId) {
      // Another account's draft, edit or status text (which can name one of
      // its templates) must never carry over.
      this.#editing = undefined;
      this.#pendingDelete = undefined;
      this.#status.clear();
    }
    if (this.#editing && !templates.some((t) => t.id === this.#editing?.id))
      this.#editing = undefined;
    // A redraw (a delete confirmation, another tab's change) keeps what the
    // user is typing, as long as the form still edits the same thing.
    const previous = this.#form;
    const draft =
      previous && accountId === this.#accountId
        ? {
            editingId: previous.editingId,
            name: previous.name.value,
            folder: previous.folder.value,
            body: previous.body.value,
          }
        : undefined;
    this.#form = undefined;
    this.#accountId = accountId;
    this.root.replaceChildren();
    this.#status.redraw();
    const heading = element(
      document,
      "h2",
      "joyfox-panel__heading",
      t("templates.heading"),
    );
    heading.id = "joyfox-templates-heading";
    this.root.setAttribute("aria-labelledby", heading.id);
    this.root.append(
      heading,
      element(document, "p", "joyfox-panel__hint", t("templates.hint")),
    );
    if (!accountId) {
      this.root.append(
        element(document, "p", "joyfox-panel__empty", t("templates.noAccount")),
        this.#status.node,
      );
      return;
    }
    this.root.append(this.#renderList(document, accountId, templates));
    const form = this.#renderForm(document, accountId);
    if (draft && draft.editingId === form.editingId) {
      form.name.value = draft.name;
      form.folder.value = draft.folder;
      form.body.value = draft.body;
    }
    this.#form = form;
    this.root.append(form.form, this.#status.node);
  }

  #renderList(
    document: Document,
    accountId: string,
    templates: MessageTemplate[],
  ): HTMLElement {
    if (templates.length === 0)
      return element(
        document,
        "p",
        "joyfox-panel__empty",
        t("templates.empty"),
      );
    const wrapper = element(document, "div", "joyfox-templates__folders");
    let list: HTMLUListElement | undefined;
    let folder: string | undefined;
    // A template without a folder is listed under "General" in the language
    // shown, and sorted where that name reads.
    const general = t(DEFAULT_FOLDER);
    const sorted = [...templates].sort((a, b) =>
      compareTemplates(a, b, general),
    );
    for (const template of sorted) {
      if (folderOf(template, general) !== folder) {
        folder = folderOf(template, general);
        const title = element(
          document,
          "h3",
          "joyfox-templates__folder",
          folder,
        );
        list = element(document, "ul", "joyfox-panel__list");
        list.setAttribute("aria-label", t("templates.inFolder", { folder }));
        wrapper.append(title, list);
      }
      list!.append(this.#renderItem(document, accountId, template));
    }
    return wrapper;
  }

  #renderItem(
    document: Document,
    accountId: string,
    template: MessageTemplate,
  ): HTMLElement {
    const item = element(document, "li", "joyfox-panel__item");
    item.dataset.templateId = template.id;
    item.append(
      element(document, "span", "joyfox-panel__item-name", template.name),
      element(
        document,
        "span",
        "joyfox-templates__preview",
        preview(template.body),
      ),
    );
    const name = { name: template.name };
    const edit = element(
      document,
      "button",
      "joyfox-templates__edit",
      t("templates.edit"),
    );
    edit.type = "button";
    edit.setAttribute("aria-label", t("templates.editLabel", name));
    edit.addEventListener("click", () => {
      this.#pendingDelete = undefined;
      this.#editing = template;
      this.#setStatus(message("templates.editing", name), "info");
      void this.render().then(() => this.#form?.name.focus());
    });
    const confirming = this.#pendingDelete === template.id;
    const remove = element(
      document,
      "button",
      "joyfox-panel__remove",
      t(confirming ? "templates.confirmDelete" : "templates.delete"),
    );
    remove.type = "button";
    remove.setAttribute(
      "aria-label",
      t(
        confirming ? "templates.confirmDeleteLabel" : "templates.deleteLabel",
        name,
      ),
    );
    remove.addEventListener("click", (event) => {
      // `confirming` is fixed at draw time: a node drawn unarmed only arms.
      if (!confirming) {
        if (event.detail > 1) return;
        this.#pendingDelete = template.id;
        this.#armedAt = confirmTiming.now();
        this.#setStatus(message("templates.deletePrompt", name), "info");
        void this.render();
        return;
      }
      if (this.#pendingDelete !== template.id) return;
      if (!confirmAllowed(event, this.#armedAt)) return;
      void this.#run(accountId, async () => {
        this.#pendingDelete = undefined;
        await this.templates.delete(accountId, template.id, this.#guard);
        if (this.#editing?.id === template.id) this.#editing = undefined;
        this.#setStatus(message("templates.deleted", name), "info");
      });
    });
    item.append(edit, remove);
    return item;
  }

  #renderForm(document: Document, accountId: string): TemplateForm {
    const editing = this.#editing;
    const form = element(document, "form", "joyfox-panel__form");
    form.setAttribute(
      "aria-label",
      editing
        ? t("templates.editLabel", { name: editing.name })
        : t("templates.addForm"),
    );
    const name = this.#input(
      document,
      form,
      "joyfox-template-name",
      t("templates.name"),
      MAX_TEMPLATE_NAME_LENGTH,
    );
    name.required = true;
    name.value = editing?.name ?? "";
    const folder = this.#input(
      document,
      form,
      "joyfox-template-folder",
      t("templates.folder"),
      MAX_TEMPLATE_FOLDER_LENGTH,
    );
    folder.value = editing?.folder ?? "";
    const suggestions = element(document, "datalist", "");
    suggestions.id = "joyfox-template-folders";
    for (const key of SUGGESTED_FOLDERS) {
      const option = document.createElement("option");
      option.value = t(key);
      suggestions.append(option);
    }
    folder.setAttribute("list", suggestions.id);
    form.append(suggestions);

    const bodyField = element(document, "p", "joyfox-panel__field");
    const bodyLabel = element(
      document,
      "label",
      "joyfox-panel__field-label",
      t("templates.text"),
    );
    bodyLabel.htmlFor = "joyfox-template-body";
    const body = element(document, "textarea", "joyfox-panel__field-input");
    body.id = "joyfox-template-body";
    body.name = body.id;
    body.rows = 6;
    body.required = true;
    body.maxLength = MAX_TEMPLATE_BODY_LENGTH;
    body.value = editing?.body ?? "";
    bodyField.append(bodyLabel, body);
    form.append(bodyField);

    const submit = element(
      document,
      "button",
      "joyfox-panel__submit",
      t(editing ? "templates.saveChanges" : "templates.add"),
    );
    submit.type = "submit";
    form.append(submit);
    if (editing) {
      const cancel = element(
        document,
        "button",
        "joyfox-templates__cancel",
        t("templates.cancel"),
      );
      cancel.type = "button";
      cancel.addEventListener("click", () => {
        this.#editing = undefined;
        this.#status.clear();
        void this.render();
      });
      form.append(cancel);
    }
    form.addEventListener("submit", (event) => {
      event.preventDefault();
      if (this.#saving) return;
      const id = editing?.id;
      const input = {
        ...(id ? { id } : {}),
        name: name.value,
        folder: folder.value,
        body: body.value,
      };
      this.#saving = true;
      submit.disabled = true;
      void this.#run(accountId, async () => {
        this.#pendingDelete = undefined;
        let saved: MessageTemplate;
        try {
          saved = await this.templates.save(accountId, input, this.#guard);
        } catch (error) {
          // The template being edited was deleted in another tab. Keep what
          // the user typed as a new template, so a retry adds it instead of
          // failing the same way again.
          if (
            id &&
            !(await this.templates.list(accountId)).some((t) => t.id === id)
          ) {
            this.#editing = undefined;
            if (this.#form) this.#form.editingId = undefined;
            await this.render();
          }
          throw error;
        }
        this.#editing = undefined;
        // Saved: the next render starts from an empty form.
        this.#form = undefined;
        this.#setStatus(
          message(id ? "templates.saved" : "templates.added", {
            name: saved.name,
          }),
          "info",
        );
      }).finally(() => {
        this.#saving = false;
        submit.disabled = false;
      });
    });
    return { editingId: editing?.id, form, name, folder, body };
  }

  #input(
    document: Document,
    form: HTMLFormElement,
    id: string,
    labelText: string,
    maxLength: number,
  ): HTMLInputElement {
    const wrapper = element(document, "p", "joyfox-panel__field");
    const label = element(
      document,
      "label",
      "joyfox-panel__field-label",
      labelText,
    );
    label.htmlFor = id;
    const input = element(document, "input", "joyfox-panel__field-input");
    input.id = id;
    input.name = id;
    input.type = "text";
    input.autocomplete = "off";
    input.maxLength = maxLength;
    wrapper.append(label, input);
    form.append(wrapper);
    return input;
  }

  #setStatus(message: Message, kind: "info" | "error"): void {
    this.#status.set(message, kind);
  }

  /**
   * A write goes to the account the panel was drawn for, and only while it
   * is still the active one. On success the panel redraws from storage; on
   * failure the form keeps what the user typed.
   */
  async #run(accountId: string, action: () => Promise<void>): Promise<void> {
    try {
      if ((await this.accounts.getActiveAccount())?.id !== accountId) {
        this.#pendingDelete = undefined;
        // Redraw first: the redraw for the new account clears the status.
        await this.render();
        this.#setStatus(message("templates.accountChanged"), "error");
        return;
      }
      await action();
    } catch (error) {
      this.#pendingDelete = undefined;
      const display = errorDisplay(error);
      this.#setStatus(
        display
          ? message("error.withSuffix.nothingChanged", { error: display })
          : message("accounts.saveFailed"),
        "error",
      );
      return;
    }
    this.onChange();
    await this.render();
  }
}
