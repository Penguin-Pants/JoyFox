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
import { ExtensionError } from "../errors";
import { message, type Message } from "../i18n/message";
import { errorDisplay, formatDate, formatNumber, t } from "../i18n/translator";
import { ENTITY_NAMES } from "../storage/database";
import type { EntityCounts } from "../storage/repositories";
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
  readonly #status: StatusLine;
  /** Import's own status line, beside it when it has its own place. */
  readonly #importStatus: StatusLine;
  #generation = 0;
  /** The account being inspected; not necessarily the active one. */
  #selected: string | undefined;
  #shown: EntityName | undefined;
  #shownLimit = RECORD_PAGE_SIZE;
  /** The records expanded when the panel was last drawn. */
  #openRecords = new Set<string>();
  #pending: Pending | undefined;
  #armedAt = 0;
  /** What the last import changed, shown until the next file choice. */
  #importResult: (ImportPlan & { settingsSaved?: boolean }) | undefined;
  /**
   * True from a file choice until its import settles. The file chooser is
   * disabled meanwhile, so a second choice can never overlap a write.
   */
  #importing = false;

  constructor(
    private readonly root: HTMLElement,
    private readonly data = new DataService(),
    private readonly accounts = new AccountService(),
    private readonly saveFile: FileSaver = browserFileSaver,
    private readonly onChange: () => void = () => undefined,
    /**
     * Where Import is drawn, when not in this panel: the Accounts tab
     * (owner request, 2026-09-24).
     */
    private readonly importRoot?: HTMLElement,
  ) {
    this.#status = new StatusLine(root.ownerDocument);
    this.#importStatus = importRoot
      ? new StatusLine(root.ownerDocument)
      : this.#status;
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
      if (generation === this.#generation) {
        this.root.textContent = t("data.readFailed");
        // Import needs none of these reads. Redraw it, so a chooser that a
        // file choice disabled is enabled again.
        this.#importStatus.redraw();
        this.importRoot?.replaceChildren(
          this.#renderImport(document),
          this.#importStatus.node,
        );
      }
      return;
    }
    if (generation !== this.#generation) return;
    if (selected !== this.#selected) {
      this.#shown = undefined;
      this.#shownLimit = RECORD_PAGE_SIZE;
      this.#pending = undefined;
    }
    this.#selected = selected;

    // A redraw (a language change, a delete elsewhere) keeps the records the
    // user expanded. Read after the storage reads, just before the redraw.
    this.#openRecords = new Set(
      Array.from(
        this.root.querySelectorAll<HTMLElement>(".joyfox-data__record"),
      )
        .filter((item) => item.querySelector("details")?.open)
        .map((item) => item.dataset.recordId ?? ""),
    );
    this.root.replaceChildren();
    this.#status.redraw();
    this.#importStatus.redraw();
    const heading = element(
      document,
      "h2",
      "joyfox-panel__heading",
      t("options.tabs.data"),
    );
    heading.id = "joyfox-data-heading";
    this.root.setAttribute("aria-labelledby", heading.id);
    this.root.append(
      heading,
      element(document, "p", "joyfox-panel__hint", t("data.hint")),
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
        element(document, "p", "joyfox-panel__empty", t("data.noAccounts")),
      );
    }
    this.root.append(this.#renderGlobalActions(document), this.#status.node);
    this.importRoot?.replaceChildren(
      this.#renderImport(document),
      this.#importStatus.node,
    );
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
      t("data.accountPicker"),
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
      this.#status.clear();
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
      t("data.caption"),
    );
    const head = document.createElement("thead");
    const headRow = document.createElement("tr");
    for (const title of [
      t("data.col.type"),
      t("data.col.records"),
      t("data.col.actions"),
    ]) {
      const cell = element(document, "th", "", title);
      cell.scope = "col";
      headRow.append(cell);
    }
    head.append(headRow);
    const body = document.createElement("tbody");
    for (const name of ENTITY_NAMES) {
      const row = document.createElement("tr");
      row.dataset.entity = name;
      const title = element(document, "th", "", t(ENTITY_LABELS[name]));
      title.scope = "row";
      const count = element(
        document,
        "td",
        "joyfox-data__count",
        formatNumber(counts[name]),
      );
      // The buttons sit in a flex box inside the cell: a flex cell is no
      // longer a table cell and falls out of line with its row.
      const cell = document.createElement("td");
      const actions = element(document, "div", "joyfox-data__actions");
      cell.append(actions);
      const label = message(ENTITY_LABELS[name]);
      if (counts[name] > 0) {
        const showing = this.#shown === name;
        actions.append(
          this.#button(
            document,
            "joyfox-data__show",
            t(showing ? "data.hide" : "data.show"),
            t(showing ? "data.hideLabel" : "data.showLabel", { label }),
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
              t("data.deleteAll"),
              message("data.deleteAllLabel", { label }),
              message("data.deleteAllPrompt", { count: counts[name], label }),
              (accountId) => this.data.deleteEntity(accountId, name),
              message("data.deletedAll", { label }),
            ),
          );
      }
      row.append(title, count, cell);
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
      t("data.recordsTitle", {
        label: message(ENTITY_LABELS[name]),
        count: records.length,
      }),
    );
    section.append(title);
    if (!isDeletableEntity(name))
      section.append(
        element(
          document,
          "p",
          "joyfox-panel__hint",
          t("data.accountRecordHint"),
        ),
      );
    const list = element(document, "ul", "joyfox-data__record-list");
    for (const record of records.slice(0, this.#shownLimit)) {
      const item = element(document, "li", "joyfox-data__record");
      item.dataset.recordId = record.id;
      const details = element(document, "details", "joyfox-data__details");
      details.open = this.#openRecords.has(record.id);
      details.append(
        element(
          document,
          "summary",
          "",
          t("data.recordSummary", {
            id: record.id,
            updated: formatDate(record.updatedAt),
          }),
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
            t("data.delete"),
            message("data.deleteRecordLabel", { id: record.id }),
            message("data.deleteRecordPrompt", { id: record.id }),
            (accountId) => this.data.deleteRecord(accountId, name, record.id),
            message("data.deletedRecord", { id: record.id }),
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
          t("data.showMore", {
            count: Math.min(
              RECORD_PAGE_SIZE,
              records.length - this.#shownLimit,
            ),
          }),
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
        t("data.exportAccount"),
        undefined,
        () =>
          void this.#guard(async () => {
            // Any other action disarms a pending delete, at once.
            this.#pending = undefined;
            const accountId = this.#requireSelected();
            const exported = await this.data.exportAccount(accountId);
            this.saveFile(exportFileName(exported), serializeExport(exported));
            this.#setStatus(message("data.exportedAccount"), "info");
          }),
      ),
      document.createTextNode(" "),
      this.#confirmButton(
        document,
        { kind: "account" },
        t("data.deleteAccountData"),
        message("data.deleteAccountDataLabel"),
        message("data.deleteAccountDataPrompt"),
        (accountId) => this.data.clearAccountData(accountId),
        message("data.deletedAccountData"),
      ),
    );
    return actions;
  }

  #renderGlobalActions(document: Document): HTMLElement {
    const section = element(document, "div", "joyfox-data__global");
    section.append(
      element(
        document,
        "h3",
        "joyfox-data__global-title",
        t("data.allAccounts"),
      ),
      this.#button(
        document,
        "joyfox-data__export-all",
        t("data.exportAll"),
        undefined,
        () =>
          void this.#guard(async () => {
            // Any other action disarms a pending delete, at once.
            this.#pending = undefined;
            const exported = await this.data.exportAll();
            this.saveFile(exportFileName(exported), serializeExport(exported));
            this.#setStatus(message("data.exportedAll"), "info");
          }),
      ),
      document.createTextNode(" "),
      this.#confirmButton(
        document,
        { kind: "all" },
        t("data.deleteEverything"),
        message("data.deleteEverythingLabel"),
        message("data.deleteEverythingPrompt"),
        () => this.data.deleteEverything(),
        message("data.deletedEverything"),
      ),
      ...(this.importRoot ? [] : [this.#renderImport(document)]),
    );
    return section;
  }

  /**
   * Import (owner request, ADR 0009): choosing a file imports it. The file is
   * checked first, and a file that fails the check writes nothing. The
   * result shows what the import changed.
   */
  #renderImport(document: Document): HTMLElement {
    const section = element(document, "div", "joyfox-data__import");
    section.append(
      element(
        document,
        "h3",
        "joyfox-data__import-title",
        t("data.import.title"),
      ),
      element(document, "p", "joyfox-panel__hint", t("data.import.hint")),
    );
    const field = element(document, "p", "joyfox-panel__field");
    const label = element(
      document,
      "label",
      "joyfox-panel__field-label",
      t("data.import.fileLabel"),
    );
    label.htmlFor = "joyfox-data-import";
    const input = element(document, "input", "joyfox-data__import-file");
    input.type = "file";
    input.id = "joyfox-data-import";
    input.accept = ".json,application/json";
    input.disabled = this.#importing;
    input.addEventListener("change", () => {
      const file = input.files?.[0];
      if (!file || this.#importing) return;
      this.#importing = true;
      input.disabled = true;
      void this.#importFile(file);
    });
    field.append(label, input);
    section.append(field);
    if (this.#importResult)
      section.append(this.#renderImportResult(document, this.#importResult));
    return section;
  }

  #renderImportResult(
    document: Document,
    plan: ImportPlan & { settingsSaved?: boolean },
  ): HTMLElement {
    const preview = element(document, "div", "joyfox-data__import-result");
    const { matched, added } = plan.accounts;
    preview.append(
      element(
        document,
        "p",
        "",
        t(
          plan.scope === "all"
            ? "data.import.summary.all"
            : "data.import.summary.account",
          { matched, added, total: matched + added },
        ),
      ),
    );
    const table = element(document, "table", "joyfox-data__counts");
    table.append(
      element(
        document,
        "caption",
        "joyfox-data__caption",
        t("data.import.caption"),
      ),
    );
    const head = document.createElement("tr");
    for (const title of [
      t("data.col.type"),
      t("data.import.col.added"),
      t("data.import.col.replaced"),
      t("data.import.col.kept"),
      t("data.import.col.duplicates"),
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
      const title = element(document, "th", "", t(ENTITY_LABELS[name]));
      title.scope = "row";
      row.append(title);
      for (const value of [
        count.added,
        count.replaced,
        count.kept,
        count.duplicates,
      ])
        row.append(element(document, "td", "", formatNumber(value)));
      body.append(row);
    }
    table.append(thead, body);
    preview.append(
      rows > 0 ? table : element(document, "p", "", t("data.import.noRecords")),
    );
    // Setting names are technical keys, the same in every language.
    if (plan.settingsSkipped.length > 0)
      preview.append(
        element(
          document,
          "p",
          "",
          t("data.import.settingsSkipped", {
            keys: plan.settingsSkipped.join(", "),
          }),
        ),
      );
    if (plan.settingsAdded.length > 0)
      preview.append(
        element(
          document,
          "p",
          "",
          t(
            plan.settingsSaved === false
              ? "data.import.settingsNotSaved"
              : "data.import.settingsAdded",
            { keys: plan.settingsAdded.join(", ") },
          ),
        ),
      );
    return preview;
  }

  /** Runs with `#importing` set; clears it when the import settles. */
  async #importFile(file: File): Promise<void> {
    this.#pending = undefined;
    // Clear the last result at once: it belongs to another file.
    this.#importResult = undefined;
    this.#setImportStatus(message("data.import.running"), "info");
    void this.render();
    let checked = false;
    try {
      if (file.size > MAX_IMPORT_BYTES)
        throw new ExtensionError(
          "ExtractionInvalid",
          "The file is too large to be a JoyFox export",
          { display: message("error.import.tooLarge") },
        );
      const text = await readText(file);
      const preview = await this.data.previewImport(text);
      checked = true;
      // Always through `applyImport`: it plans again under the data lock, so
      // even "nothing changed" is checked against current data.
      const plan = await this.data.applyImport(text, preview.signature);
      this.#importResult = plan;
      if (plan.writes.length === 0 && plan.settingsAdded.length === 0) {
        this.#setImportStatus(message("data.import.nothing"), "info");
      } else {
        const totals = ENTITY_NAMES.reduce(
          (sum, name) => ({
            added: sum.added + plan.counts[name].added,
            replaced: sum.replaced + plan.counts[name].replaced,
          }),
          { added: 0, replaced: 0 },
        );
        this.#setImportStatus(
          message(
            plan.settingsSaved
              ? "data.import.complete"
              : "data.import.completeSettingsFailed",
            totals,
          ),
          plan.settingsSaved ? "info" : "error",
        );
        this.onChange();
      }
    } catch (error) {
      const display = errorDisplay(error);
      this.#setImportStatus(
        display
          ? message("error.withSuffix.nothingImported", { error: display })
          : message(
              checked ? "data.import.incomplete" : "data.import.unreadable",
            ),
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
    ariaLabel: Message,
    prompt: Message,
    action: (accountId: string) => Promise<void>,
    done: Message,
  ): HTMLButtonElement {
    // Whether this node was drawn armed, fixed at draw time: a click on a
    // node drawn unarmed can only arm, never confirm.
    const armed = samePending(this.#pending, pending);
    const node = this.#button(
      document,
      "joyfox-panel__remove",
      armed ? t("data.confirm") : text,
      armed ? t("data.confirmLabel", { label: ariaLabel }) : t(ariaLabel),
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

  #setStatus(message: Message, kind: "info" | "error"): void {
    this.#status.set(message, kind);
  }

  #setImportStatus(message: Message, kind: "info" | "error"): void {
    this.#importStatus.set(message, kind);
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
      const display = errorDisplay(error);
      this.#setStatus(
        display
          ? message("error.withSuffix.nothingDeleted", { error: display })
          : message("data.actionFailed"),
        "error",
      );
    }
    await this.render();
  }
}
