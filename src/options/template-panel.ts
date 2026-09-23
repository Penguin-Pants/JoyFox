import { AccountService } from "../accounts/account-service";
import type { MessageTemplate } from "../domain/types";
import { isExtensionError } from "../errors";
import {
  folderOf,
  MAX_TEMPLATE_BODY_LENGTH,
  MAX_TEMPLATE_FOLDER_LENGTH,
  MAX_TEMPLATE_NAME_LENGTH,
  SUGGESTED_FOLDERS,
  TemplateService,
} from "../templates/template-service";

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
  readonly #status: HTMLParagraphElement;
  /** Bumped per render, so a slower, older render never replaces a newer one. */
  #generation = 0;
  /** The account the list and form were drawn for. */
  #accountId: string | undefined;
  #editing: MessageTemplate | undefined;
  #pendingDelete: string | undefined;
  #form: TemplateForm | undefined;

  constructor(
    private readonly root: HTMLElement,
    private readonly templates = new TemplateService(),
    private readonly accounts = new AccountService(),
    private readonly onChange: () => void = () => undefined,
  ) {
    this.#status = root.ownerDocument.createElement("p");
    this.#status.className = "joyfox-panel__status";
    this.#status.setAttribute("aria-live", "polite");
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
        this.root.textContent =
          "JoyFox could not read your templates. No template was changed.";
      return;
    }
    if (generation !== this.#generation) return;
    if (accountId !== this.#accountId) {
      // Another account's draft or edit must never carry over.
      this.#editing = undefined;
      this.#pendingDelete = undefined;
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
    const heading = element(
      document,
      "h2",
      "joyfox-panel__heading",
      "Message templates",
    );
    heading.id = "joyfox-templates-heading";
    this.root.setAttribute("aria-labelledby", heading.id);
    this.root.append(
      heading,
      element(
        document,
        "p",
        "joyfox-panel__hint",
        "A template fills JoyClub's message field at the cursor. You can still edit the text, and you always click JoyClub's Send button yourself. JoyFox never sends a message.",
      ),
    );
    if (!accountId) {
      this.root.append(
        element(
          document,
          "p",
          "joyfox-panel__empty",
          "Choose an active account above to store templates.",
        ),
        this.#status,
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
    this.root.append(form.form, this.#status);
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
        "No templates yet. Add one below.",
      );
    const wrapper = element(document, "div", "joyfox-templates__folders");
    let list: HTMLUListElement | undefined;
    let folder: string | undefined;
    for (const template of templates) {
      if (folderOf(template) !== folder) {
        folder = folderOf(template);
        const title = element(
          document,
          "h3",
          "joyfox-templates__folder",
          folder,
        );
        list = element(document, "ul", "joyfox-panel__list");
        list.setAttribute("aria-label", `Templates in ${folder}`);
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
    const edit = element(document, "button", "joyfox-templates__edit", "Edit");
    edit.type = "button";
    edit.setAttribute("aria-label", `Edit template ${template.name}`);
    edit.addEventListener("click", () => {
      this.#pendingDelete = undefined;
      this.#editing = template;
      this.#setStatus(`Editing ${template.name}.`, "info");
      void this.render().then(() => this.#form?.name.focus());
    });
    const confirming = this.#pendingDelete === template.id;
    const remove = element(
      document,
      "button",
      "joyfox-panel__remove",
      confirming ? "Confirm delete" : "Delete",
    );
    remove.type = "button";
    remove.setAttribute(
      "aria-label",
      confirming
        ? `Confirm deleting template ${template.name}`
        : `Delete template ${template.name}`,
    );
    remove.addEventListener("click", () => {
      if (this.#pendingDelete !== template.id) {
        this.#pendingDelete = template.id;
        this.#setStatus(
          `Click "Confirm delete" to delete ${template.name}.`,
          "info",
        );
        void this.render();
        return;
      }
      void this.#run(accountId, async () => {
        this.#pendingDelete = undefined;
        await this.templates.delete(accountId, template.id);
        if (this.#editing?.id === template.id) this.#editing = undefined;
        this.#setStatus(`Deleted ${template.name}.`, "info");
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
      editing ? `Edit template ${editing.name}` : "Add a template",
    );
    const name = this.#input(
      document,
      form,
      "joyfox-template-name",
      "Name",
      MAX_TEMPLATE_NAME_LENGTH,
    );
    name.required = true;
    name.value = editing?.name ?? "";
    const folder = this.#input(
      document,
      form,
      "joyfox-template-folder",
      "Folder (optional, General if empty)",
      MAX_TEMPLATE_FOLDER_LENGTH,
    );
    folder.value = editing?.folder ?? "";
    const suggestions = element(document, "datalist", "");
    suggestions.id = "joyfox-template-folders";
    for (const value of SUGGESTED_FOLDERS) {
      const option = document.createElement("option");
      option.value = value;
      suggestions.append(option);
    }
    folder.setAttribute("list", suggestions.id);
    form.append(suggestions);

    const bodyField = element(document, "p", "joyfox-panel__field");
    const bodyLabel = element(
      document,
      "label",
      "joyfox-panel__field-label",
      "Text",
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
      editing ? "Save changes" : "Add template",
    );
    submit.type = "submit";
    form.append(submit);
    if (editing) {
      const cancel = element(
        document,
        "button",
        "joyfox-templates__cancel",
        "Cancel editing",
      );
      cancel.type = "button";
      cancel.addEventListener("click", () => {
        this.#editing = undefined;
        this.#setStatus("", "info");
        void this.render();
      });
      form.append(cancel);
    }
    form.addEventListener("submit", (event) => {
      event.preventDefault();
      const id = editing?.id;
      const input = {
        ...(id ? { id } : {}),
        name: name.value,
        folder: folder.value,
        body: body.value,
      };
      void this.#run(accountId, async () => {
        this.#pendingDelete = undefined;
        const saved = await this.templates.save(accountId, input);
        this.#editing = undefined;
        // Saved: the next render starts from an empty form.
        this.#form = undefined;
        this.#setStatus(
          id ? `Saved ${saved.name}.` : `Added ${saved.name}.`,
          "info",
        );
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

  #setStatus(message: string, kind: "info" | "error"): void {
    this.#status.dataset.kind = kind;
    this.#status.setAttribute("role", kind === "error" ? "alert" : "status");
    this.#status.textContent = message;
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
        this.#setStatus(
          "The active account changed. Nothing was changed.",
          "error",
        );
        await this.render();
        return;
      }
      await action();
    } catch (error) {
      this.#pendingDelete = undefined;
      this.#setStatus(
        isExtensionError(error)
          ? `${error.message}. Nothing was changed.`
          : "That change could not be saved. Nothing was changed.",
        "error",
      );
      return;
    }
    this.onChange();
    await this.render();
  }
}
