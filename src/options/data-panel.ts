import { AccountService } from "../accounts/account-service";
import {
  DataService,
  ENTITY_LABELS,
  exportFileName,
  isDeletableEntity,
  serializeExport,
  type AnyEntity,
} from "../data/data-service";
import { MAX_IMPORT_BYTES, type ImportPlan } from "../data/import";
import type { EntityName, ExtensionAccount } from "../domain/types";
import { ExtensionError, isExtensionError } from "../errors";
import { ENTITY_NAMES } from "../storage/database";
import type { EntityCounts } from "../storage/repositories";
import { confirmAllowed, confirmTiming } from "./confirm";

function element<K extends keyof HTMLElementTagNameMap>(
  document: Document,
  tag: K,
  className: string,
  text?: string,
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  node.className = className;
  // Stored values are user input or page-derived and are always set as text.
  if (text !== undefined) node.textContent = text;
  return node;
}

function accountName(account: ExtensionAccount): string {
  return account.label?.trim() || account.joyClubAccountId;
}

/**
 * A file's text. Firefox has `Blob.text()`; `FileReader` is the fallback for
 * environments without it (the jsdom test runner).
 */
function readText(file: Blob): Promise<string> {
  if (typeof file.text === "function") return file.text();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = () => reject(reader.error ?? new Error("Unreadable file"));
    reader.readAsText(file);
  });
}

/** Records shown per step, so a large store does not freeze the page. */
export const RECORD_PAGE_SIZE = 50;

/** Saves a text file through the browser's normal download of a link. */
export type FileSaver = (name: string, text: string) => void;

export const browserFileSaver: FileSaver = (name, text) => {
  const document = globalThis.document;
  const url = URL.createObjectURL(
    new Blob([text], { type: "application/json" }),
  );
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  link.hidden = true;
  document.body.append(link);
  link.click();
  link.remove();
  // Revoked after the click has started the download.
  setTimeout(() => URL.revokeObjectURL(url), 0);
};

/** A destructive action waiting for its confirming second click. */
type Pending =
  | { kind: "record"; entity: EntityName; id: string }
  | { kind: "entity"; entity: EntityName }
  | { kind: "account" }
  | { kind: "all" };

const samePending = (a: Pending | undefined, b: Pending) =>
  JSON.stringify(a) === JSON.stringify(b);

/**
 * M8, the data inspector (PRD Section 13.5): shows what is stored for each
 * account, entity by entity, with export and delete controls beside each
 * one. Every delete asks for a second, explicit click. Nothing leaves the
 * browser: an export is a file the user saves.
 */
export class DataPanel {
  readonly #status: HTMLParagraphElement;
  #generation = 0;
  /** The account being inspected; not necessarily the active one. */
  #selected: string | undefined;
  #shown: EntityName | undefined;
  #shownLimit = RECORD_PAGE_SIZE;
  #pending: Pending | undefined;
  #armedAt = 0;
  /** A checked file waiting for "Confirm import", with its preview. */
  #import: { text: string; plan: ImportPlan } | undefined;
  #importing = false;

  constructor(
    private readonly root: HTMLElement,
    private readonly data = new DataService(),
    private readonly accounts = new AccountService(),
    private readonly saveFile: FileSaver = browserFileSaver,
    private readonly onChange: () => void = () => undefined,
  ) {
    this.#status = root.ownerDocument.createElement("p");
    this.#status.className = "joyfox-panel__status";
    this.#status.setAttribute("aria-live", "polite");
  }

  async render(): Promise<void> {
    const generation = (this.#generation += 1);
    const document = this.root.ownerDocument;
    let accounts: ExtensionAccount[];
    let selected: string | undefined;
    let counts: EntityCounts | undefined;
    let records: AnyEntity[] = [];
    try {
      accounts = await this.accounts.listAccounts();
      const activeId = (await this.accounts.getActiveAccount())?.id;
      selected = accounts.some((a) => a.id === this.#selected)
        ? this.#selected
        : (activeId ?? accounts[0]?.id);
      if (selected) {
        counts = await this.data.counts(selected);
        if (this.#shown && selected === this.#selected)
          records = await this.data.records(selected, this.#shown);
      }
    } catch {
      if (generation === this.#generation)
        this.root.textContent =
          "JoyFox could not read its stored data. Nothing was changed.";
      return;
    }
    if (generation !== this.#generation) return;
    if (selected !== this.#selected) {
      this.#shown = undefined;
      this.#shownLimit = RECORD_PAGE_SIZE;
      this.#pending = undefined;
    }
    this.#selected = selected;

    this.root.replaceChildren();
    const heading = element(
      document,
      "h2",
      "joyfox-panel__heading",
      "Your data",
    );
    heading.id = "joyfox-data-heading";
    this.root.setAttribute("aria-labelledby", heading.id);
    this.root.append(
      heading,
      element(
        document,
        "p",
        "joyfox-panel__hint",
        "Everything JoyFox stores stays in this browser profile. You can inspect it, save it as a JSON file and delete it here. Deleting here never changes anything on JoyClub.",
      ),
    );
    if (accounts.length > 0 && selected && counts) {
      this.root.append(
        this.#renderAccountPicker(document, accounts, selected),
        this.#renderCounts(document, counts),
      );
      if (this.#shown)
        this.root.append(this.#renderRecords(document, this.#shown, records));
      this.root.append(this.#renderAccountActions(document));
    } else {
      this.root.append(
        element(document, "p", "joyfox-panel__empty", "No accounts yet."),
      );
    }
    this.root.append(this.#renderGlobalActions(document), this.#status);
  }

  #renderAccountPicker(
    document: Document,
    accounts: ExtensionAccount[],
    selected: string,
  ): HTMLElement {
    const wrapper = element(document, "p", "joyfox-panel__field");
    const label = element(
      document,
      "label",
      "joyfox-panel__field-label",
      "Account to inspect",
    );
    label.htmlFor = "joyfox-data-account";
    const select = element(document, "select", "joyfox-data__account");
    select.id = "joyfox-data-account";
    for (const account of accounts) {
      const option = document.createElement("option");
      option.value = account.id;
      option.textContent = accountName(account);
      option.selected = account.id === selected;
      select.append(option);
    }
    select.addEventListener("change", () => {
      this.#selected = select.value;
      this.#shown = undefined;
      this.#pending = undefined;
      this.#setStatus("", "info");
      void this.render();
    });
    wrapper.append(label, select);
    return wrapper;
  }

  #renderCounts(document: Document, counts: EntityCounts): HTMLElement {
    const table = element(document, "table", "joyfox-data__counts");
    const caption = element(
      document,
      "caption",
      "joyfox-data__caption",
      "Stored records for this account",
    );
    const head = document.createElement("thead");
    const headRow = document.createElement("tr");
    for (const title of ["Data type", "Records", "Actions"]) {
      const cell = element(document, "th", "", title);
      cell.scope = "col";
      headRow.append(cell);
    }
    head.append(headRow);
    const body = document.createElement("tbody");
    for (const name of ENTITY_NAMES) {
      const row = document.createElement("tr");
      row.dataset.entity = name;
      const title = element(document, "th", "", ENTITY_LABELS[name]);
      title.scope = "row";
      const count = element(
        document,
        "td",
        "joyfox-data__count",
        String(counts[name]),
      );
      const actions = element(document, "td", "joyfox-data__actions");
      const label = ENTITY_LABELS[name];
      if (counts[name] > 0) {
        const showing = this.#shown === name;
        actions.append(
          this.#button(
            document,
            "joyfox-data__show",
            showing ? "Hide" : "Show",
            showing ? `Hide ${label}` : `Show ${label}`,
            () => {
              this.#pending = undefined;
              this.#shown = showing ? undefined : name;
              this.#shownLimit = RECORD_PAGE_SIZE;
              void this.render();
            },
          ),
        );
        if (isDeletableEntity(name))
          actions.append(
            this.#confirmButton(
              document,
              { kind: "entity", entity: name },
              "Delete all",
              `Delete all ${label}`,
              `Click "Confirm" to delete all ${counts[name]} ${label} records of this account.`,
              (accountId) => this.data.deleteEntity(accountId, name),
              `Deleted all ${label} of this account.`,
            ),
          );
      }
      row.append(title, count, actions);
      body.append(row);
    }
    table.append(caption, head, body);
    return table;
  }

  #renderRecords(
    document: Document,
    name: EntityName,
    records: AnyEntity[],
  ): HTMLElement {
    const section = element(document, "div", "joyfox-data__records");
    const title = element(
      document,
      "h3",
      "joyfox-data__records-title",
      `${ENTITY_LABELS[name]} (${records.length})`,
    );
    section.append(title);
    if (!isDeletableEntity(name))
      section.append(
        element(
          document,
          "p",
          "joyfox-panel__hint",
          "The account record is removed only with the whole account, in Accounts above.",
        ),
      );
    const list = element(document, "ul", "joyfox-data__record-list");
    for (const record of records.slice(0, this.#shownLimit)) {
      const item = element(document, "li", "joyfox-data__record");
      item.dataset.recordId = record.id;
      const details = element(document, "details", "joyfox-data__details");
      details.append(
        element(
          document,
          "summary",
          "",
          `${record.id} (updated ${record.updatedAt})`,
        ),
        element(
          document,
          "pre",
          "joyfox-data__json",
          JSON.stringify(record, null, 2),
        ),
      );
      item.append(details);
      if (isDeletableEntity(name))
        item.append(
          this.#confirmButton(
            document,
            { kind: "record", entity: name, id: record.id },
            "Delete",
            `Delete record ${record.id}`,
            `Click "Confirm" to delete record ${record.id}.`,
            (accountId) => this.data.deleteRecord(accountId, name, record.id),
            `Deleted record ${record.id}.`,
          ),
        );
      list.append(item);
    }
    section.append(list);
    if (records.length > this.#shownLimit)
      section.append(
        this.#button(
          document,
          "joyfox-data__more",
          `Show ${Math.min(RECORD_PAGE_SIZE, records.length - this.#shownLimit)} more`,
          undefined,
          () => {
            this.#pending = undefined;
            this.#shownLimit += RECORD_PAGE_SIZE;
            void this.render();
          },
        ),
      );
    return section;
  }

  #renderAccountActions(document: Document): HTMLElement {
    const actions = element(document, "p", "joyfox-data__account-actions");
    actions.append(
      this.#button(
        document,
        "joyfox-data__export",
        "Export this account (JSON)",
        undefined,
        () =>
          void this.#guard(async () => {
            // Any other action disarms a pending delete, at once.
            this.#pending = undefined;
            const accountId = this.#requireSelected();
            const exported = await this.data.exportAccount(accountId);
            this.saveFile(exportFileName(exported), serializeExport(exported));
            this.#setStatus("Export of this account created.", "info");
          }),
      ),
      document.createTextNode(" "),
      this.#confirmButton(
        document,
        { kind: "account" },
        "Delete this account's data",
        "Delete all data of this account",
        'Click "Confirm" to delete every record of this account. The account itself stays in Accounts.',
        (accountId) => this.data.clearAccountData(accountId),
        "Deleted all data of this account. The account itself is kept.",
      ),
    );
    return actions;
  }

  #renderGlobalActions(document: Document): HTMLElement {
    const section = element(document, "div", "joyfox-data__global");
    section.append(
      element(document, "h3", "joyfox-data__global-title", "All accounts"),
      this.#button(
        document,
        "joyfox-data__export-all",
        "Export all JoyFox data (JSON)",
        undefined,
        () =>
          void this.#guard(async () => {
            // Any other action disarms a pending delete, at once.
            this.#pending = undefined;
            const exported = await this.data.exportAll();
            this.saveFile(exportFileName(exported), serializeExport(exported));
            this.#setStatus("Export of all JoyFox data created.", "info");
          }),
      ),
      document.createTextNode(" "),
      this.#confirmButton(
        document,
        { kind: "all" },
        "Delete all JoyFox data",
        "Delete all JoyFox data in this browser",
        'Click "Confirm" to delete every account, every record and every JoyFox setting in this browser. This cannot be undone.',
        () => this.data.deleteEverything(),
        "Deleted all JoyFox data in this browser.",
      ),
      this.#renderImport(document),
    );
    return section;
  }

  /**
   * Import (owner request, ADR 0009): choose a file, read the preview, then
   * confirm. Nothing is written before "Confirm import".
   */
  #renderImport(document: Document): HTMLElement {
    const section = element(document, "div", "joyfox-data__import");
    section.append(
      element(document, "h3", "joyfox-data__import-title", "Import"),
      element(
        document,
        "p",
        "joyfox-panel__hint",
        "Import a JoyFox export file: everything, or one account. It is merged into what is stored here. An account with the same JoyClub identifier is merged into the existing one. For the same note, rule or placement the newer version wins; existing tags and corrections are kept. You see what will change before anything is saved.",
      ),
    );
    const field = element(document, "p", "joyfox-panel__field");
    const label = element(
      document,
      "label",
      "joyfox-panel__field-label",
      "JoyFox export file (JSON)",
    );
    label.htmlFor = "joyfox-data-import";
    const input = element(document, "input", "joyfox-data__import-file");
    input.type = "file";
    input.id = "joyfox-data-import";
    input.accept = ".json,application/json";
    input.addEventListener("change", () => {
      const file = input.files?.[0];
      if (file) void this.#previewImport(file);
    });
    field.append(label, input);
    section.append(field);
    if (this.#import)
      section.append(this.#renderPreview(document, this.#import.plan));
    return section;
  }

  #renderPreview(document: Document, plan: ImportPlan): HTMLElement {
    const preview = element(document, "div", "joyfox-data__import-preview");
    const { matched, added } = plan.accounts;
    preview.append(
      element(
        document,
        "p",
        "",
        `This ${plan.scope === "all" ? "full" : "single-account"} export holds ${matched + added} account(s): ${matched} merged into an existing account, ${added} added as new.`,
      ),
    );
    const table = element(document, "table", "joyfox-data__counts");
    table.append(
      element(
        document,
        "caption",
        "joyfox-data__caption",
        "What the import changes",
      ),
    );
    const head = document.createElement("tr");
    for (const title of [
      "Data type",
      "Added",
      "Replaced (newer)",
      "Kept",
      "Skipped duplicates",
    ]) {
      const cell = element(document, "th", "", title);
      cell.scope = "col";
      head.append(cell);
    }
    const thead = document.createElement("thead");
    thead.append(head);
    const body = document.createElement("tbody");
    let rows = 0;
    for (const name of ENTITY_NAMES) {
      const count = plan.counts[name];
      if (count.added + count.replaced + count.kept + count.duplicates === 0)
        continue;
      rows += 1;
      const row = document.createElement("tr");
      row.dataset.importEntity = name;
      const title = element(document, "th", "", ENTITY_LABELS[name]);
      title.scope = "row";
      row.append(title);
      for (const value of [
        count.added,
        count.replaced,
        count.kept,
        count.duplicates,
      ])
        row.append(element(document, "td", "", String(value)));
      body.append(row);
    }
    table.append(thead, body);
    preview.append(
      rows > 0
        ? table
        : element(document, "p", "", "The file holds no records."),
    );
    if (plan.settingsSkipped.length > 0)
      preview.append(
        element(
          document,
          "p",
          "",
          `Settings in the file that are never imported (they switch features on): ${plan.settingsSkipped.join(", ")}.`,
        ),
      );
    if (plan.settingsAdded.length > 0)
      preview.append(
        element(
          document,
          "p",
          "",
          `Settings added (only those not set here): ${plan.settingsAdded.join(", ")}.`,
        ),
      );
    const confirm = this.#button(
      document,
      "joyfox-data__import-confirm",
      "Confirm import",
      undefined,
      () => void this.#applyImport(),
    );
    confirm.disabled =
      plan.writes.length === 0 && plan.settingsAdded.length === 0;
    const cancel = this.#button(
      document,
      "joyfox-data__import-cancel",
      "Cancel",
      "Cancel import",
      () => {
        this.#import = undefined;
        this.#setStatus("Import cancelled. Nothing was changed.", "info");
        void this.render();
      },
    );
    preview.append(confirm, document.createTextNode(" "), cancel);
    return preview;
  }

  async #previewImport(file: File): Promise<void> {
    this.#pending = undefined;
    this.#import = undefined;
    try {
      if (file.size > MAX_IMPORT_BYTES)
        throw new ExtensionError(
          "ExtractionInvalid",
          "The file is too large to be a JoyFox export",
        );
      const text = await readText(file);
      const plan = await this.data.previewImport(text);
      this.#import = { text, plan };
      this.#setStatus(
        plan.writes.length === 0 && plan.settingsAdded.length === 0
          ? "Everything in this file is already stored. Nothing would change."
          : 'Check what the import changes, then click "Confirm import".',
        "info",
      );
    } catch (error) {
      this.#setStatus(
        isExtensionError(error)
          ? `${error.message}. Nothing was imported.`
          : "JoyFox could not read that file. Nothing was imported.",
        "error",
      );
    }
    await this.render();
  }

  async #applyImport(): Promise<void> {
    const pending = this.#import;
    if (!pending || this.#importing) return;
    this.#importing = true;
    this.#import = undefined;
    this.#pending = undefined;
    try {
      const plan = await this.data.applyImport(
        pending.text,
        pending.plan.signature,
      );
      const totals = ENTITY_NAMES.reduce(
        (sum, name) => ({
          added: sum.added + plan.counts[name].added,
          replaced: sum.replaced + plan.counts[name].replaced,
        }),
        { added: 0, replaced: 0 },
      );
      this.#setStatus(
        `Import complete: ${totals.added} record(s) added, ${totals.replaced} replaced by a newer version.${
          plan.settingsSaved
            ? ""
            : " Some settings could not be saved; check the active account."
        }`,
        plan.settingsSaved ? "info" : "error",
      );
      this.onChange();
    } catch (error) {
      this.#setStatus(
        isExtensionError(error)
          ? `${error.message}. Nothing was imported.`
          : "The import could not be completed. The counts shown now are what is stored.",
        "error",
      );
    } finally {
      this.#importing = false;
    }
    await this.render();
  }

  #button(
    document: Document,
    className: string,
    text: string,
    ariaLabel: string | undefined,
    onClick: (event: MouseEvent) => void,
  ): HTMLButtonElement {
    const node = element(document, "button", className, text);
    node.type = "button";
    if (ariaLabel) node.setAttribute("aria-label", ariaLabel);
    node.addEventListener("click", onClick);
    return node;
  }

  /**
   * A delete button that acts only on its second click. The first click
   * arms it and says exactly what the second one deletes; any other action
   * disarms it.
   */
  #confirmButton(
    document: Document,
    pending: Pending,
    text: string,
    ariaLabel: string,
    prompt: string,
    action: (accountId: string) => Promise<void>,
    done: string,
  ): HTMLButtonElement {
    // Whether this node was drawn armed, fixed at draw time: a click on a
    // node drawn unarmed can only arm, never confirm.
    const armed = samePending(this.#pending, pending);
    const node = this.#button(
      document,
      "joyfox-panel__remove",
      armed ? "Confirm" : text,
      armed ? `Confirm: ${ariaLabel}` : ariaLabel,
      (event) => {
        if (!armed) {
          if (event.detail > 1) return;
          this.#pending = pending;
          this.#armedAt = confirmTiming.now();
          this.#setStatus(prompt, "info");
          void this.render();
          return;
        }
        if (!samePending(this.#pending, pending)) return;
        if (!confirmAllowed(event, this.#armedAt)) return;
        this.#pending = undefined;
        void this.#guard(async () => {
          await action(this.#requireSelected(pending.kind === "all"));
          this.#setStatus(done, "info");
          this.onChange();
        });
      },
    );
    return node;
  }

  #requireSelected(optional = false): string {
    if (!this.#selected && !optional) throw new Error("No account selected");
    return this.#selected ?? "";
  }

  #setStatus(message: string, kind: "info" | "error"): void {
    this.#status.dataset.kind = kind;
    this.#status.setAttribute("role", kind === "error" ? "alert" : "status");
    this.#status.textContent = message;
  }

  /**
   * Every action redraws from storage, so the panel shows committed state.
   * A refusal (an `ExtensionError`) comes before any change. Any other
   * failure may come part-way through "delete everything", so its message
   * points at the redrawn counts instead of claiming nothing changed.
   */
  async #guard(action: () => Promise<void>): Promise<void> {
    try {
      await action();
    } catch (error) {
      this.#pending = undefined;
      this.#setStatus(
        isExtensionError(error)
          ? `${error.message}. Nothing was deleted.`
          : "That action could not be completed. The counts shown now are what is stored.",
        "error",
      );
    }
    await this.render();
  }
}
