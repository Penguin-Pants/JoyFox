import {
  AccountService,
  ACTIVE_ACCOUNT_SETTING_KEY,
} from "../accounts/account-service";
import { QUICK_IGNORE_DELETE, reportOperation } from "../actions/ignore-delete";
import { QUICK_ACTION_KEY } from "../actions/quick-action-setting";
import {
  DataService,
  ENTITY_LABELS,
  exportFileName,
  isDeletableEntity,
  serializeExport,
  type AnyEntity,
} from "../data/data-service";
import { MAX_IMPORT_BYTES, type ImportPlan } from "../data/import";
import type { ActionLog, EntityName, ExtensionAccount } from "../domain/types";
import { ExtensionError } from "../errors";
import type { PlainKey } from "../i18n/catalog/en";
import { LOCALE_KEY } from "../i18n/locale";
import { message, type Message } from "../i18n/message";
import { errorDisplay, formatDate, formatNumber, t } from "../i18n/translator";
import {
  MESSAGE_CACHING_KEY,
  MESSAGE_RETENTION_KEY,
} from "../messages/message-settings";
import { ENTITY_NAMES } from "../storage/database";
import type { EntityCounts } from "../storage/repositories";
import {
  DEFAULT_SNAPSHOT_RETENTION,
  isSnapshotRetention,
  MAX_SNAPSHOT_RETENTION,
  MIN_SNAPSHOT_RETENTION,
  SNAPSHOT_RETENTION_KEY,
} from "../storage/snapshot-retention";
import { SHARED_EVENT_EXCEPTION_KEY } from "../triage/shared-event";
import {
  FOCUS_KEY,
  rememberFocus,
  restoreFocus,
  type FocusMemo,
} from "../ui/focus";
import { confirmAllowed, confirmTiming } from "./confirm";
import { renderFields } from "./record-fields";
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

/**
 * Catalog text in which `[Name](#tab)` is a link to that options tab, as in
 * the "Get started" steps. The tabs follow the address, so the plain link is
 * enough. Only for catalog text: user text never goes through this.
 */
export function withTabLinks(
  document: Document,
  text: string,
): DocumentFragment {
  const fragment = document.createDocumentFragment();
  for (const part of text.split(/(\[[^\]]+\]\(#[a-z]+\))/u)) {
    const link = /^\[([^\]]+)\]\((#[a-z]+)\)$/u.exec(part);
    if (!link) {
      if (part) fragment.append(part);
      continue;
    }
    const anchor = document.createElement("a");
    anchor.textContent = link[1] ?? "";
    anchor.href = link[2] ?? "";
    fragment.append(anchor);
  }
  return fragment;
}

/** The label with the JoyClub identifier, as the Accounts tab shows it. */
function accountName(account: ExtensionAccount): string {
  const label = account.label?.trim();
  return label && label !== account.joyClubAccountId
    ? t("accounts.nameWithIdentifier", {
        label,
        identifier: account.joyClubAccountId,
      })
    : account.joyClubAccountId;
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

/**
 * Runs `fill` once, the first time `details` is open: at once if it is open
 * already, else when the user opens it.
 */
function whenOpened(details: HTMLDetailsElement, fill: () => void): void {
  let filled = false;
  const run = () => {
    if (filled || !details.open) return;
    filled = true;
    fill();
  };
  details.addEventListener("toggle", run);
  run();
}

/**
 * The names of the settings an import can add or skip, so the result lists
 * words instead of stored keys. The template picker and diagnostics keys
 * are written out: their constants live in the content script.
 */
const SETTING_NAMES: Readonly<Record<string, PlainKey>> = {
  [ACTIVE_ACCOUNT_SETTING_KEY]: "data.setting.activeAccount",
  [LOCALE_KEY]: "data.setting.language",
  [MESSAGE_CACHING_KEY]: "data.setting.messageCaching",
  [MESSAGE_RETENTION_KEY]: "data.setting.messageRetention",
  [QUICK_ACTION_KEY]: "data.setting.quickIgnoreDelete",
  "joyfox.templatePicker": "data.setting.templatePicker",
  [SHARED_EVENT_EXCEPTION_KEY]: "data.setting.sharedEventException",
  [SNAPSHOT_RETENTION_KEY]: "data.setting.snapshotRetention",
  "joyfox.diagnostics": "data.setting.diagnostics",
};

/**
 * Settings by name, in the UI language. A setting JoyFox does not name is
 * shown by its stored key.
 */
function settingNames(keys: readonly string[]): string {
  return keys
    .map((key) =>
      Object.hasOwn(SETTING_NAMES, key) ? t(SETTING_NAMES[key]!) : key,
    )
    .join(", ");
}

/** Focus fell to the page, as when the focused control was disabled. */
const focusFell = (document: Document) =>
  !document.activeElement || document.activeElement === document.body;

/** How a failed action ends its message: what did not happen. */
interface Failure {
  /** With the error's own text. */
  suffix:
    | "error.withSuffix.nothingDeleted"
    | "error.withSuffix.nothingExported"
    | "error.withSuffix.settingNotChanged";
  /** For an error without one. */
  fallback: PlainKey;
}

/** Deletes may stop part-way; the counts show what is left. */
const DELETE_FAILED: Failure = {
  suffix: "error.withSuffix.nothingDeleted",
  fallback: "data.actionFailed",
};
const EXPORT_FAILED: Failure = {
  suffix: "error.withSuffix.nothingExported",
  fallback: "data.exportFailed",
};
const RETENTION_FAILED: Failure = {
  suffix: "error.withSuffix.settingNotChanged",
  fallback: "data.retentionFailed",
};

/** A destructive action waiting for its confirming second click. */
type Pending =
  | { kind: "record"; entity: EntityName; id: string }
  | { kind: "entity"; entity: EntityName }
  | { kind: "account" }
  | { kind: "all" }
  /** A lower snapshot number, which deletes older snapshots once saved. */
  | { kind: "retention"; keep: number };

const samePending = (a: Pending | undefined, b: Pending) =>
  JSON.stringify(a) === JSON.stringify(b);

/** Nicknames by member ID, from the member directory's records. */
function memberNames(records: readonly AnyEntity[]): Map<string, string> {
  const names = new Map<string, string>();
  for (const record of records) {
    const { joyClubMemberId, nickname } = record as unknown as Record<
      string,
      unknown
    >;
    if (typeof joyClubMemberId === "string" && typeof nickname === "string")
      names.set(joyClubMemberId, nickname);
  }
  return names;
}

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
  /** Where the next draw puts focus, whatever had it before. */
  #focusNext: FocusMemo | undefined;
  /**
   * The control that had focus when an import started. The disabled file
   * chooser drops focus to the page; the draw after the import puts it back.
   */
  #focusBefore: FocusMemo | undefined;

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

  /** Nicknames by member ID, for the shown account's records. */
  #names = new Map<string, string>();

  /**
   * The name a person knows a record by, if it has one: a template's or
   * saved search's name, an event's title, an account's label, or the
   * member's nickname.
   */
  #recordName(entity: EntityName, record: AnyEntity): string | undefined {
    const fields = record as unknown as Record<string, unknown>;
    const text = (value: unknown) =>
      typeof value === "string" && value.trim() ? value.trim() : undefined;
    switch (entity) {
      case "messageTemplates":
      case "savedSearches":
        return text(fields.name);
      case "eventMetadata":
        return text(fields.title) ?? text(fields.venueName);
      case "extensionAccounts":
        return text(fields.label) ?? text(fields.joyClubAccountId);
    }
    const memberId = fields.joyClubMemberId ?? fields.memberId;
    return typeof memberId === "string" ? this.#names.get(memberId) : undefined;
  }

  /** A record's line: its name if it has one, then its ID and date. */
  #summary(entity: EntityName, record: AnyEntity): string {
    const updated = formatDate(record.updatedAt);
    const name = this.#recordName(entity, record);
    return name
      ? t("data.recordSummaryNamed", { name, id: record.id, updated })
      : t("data.recordSummary", { id: record.id, updated });
  }

  /** A record in delete labels and messages: its name first, then its ID. */
  #recordText(entity: EntityName, record: AnyEntity): string {
    const name = this.#recordName(entity, record);
    return name ? t("data.recordNamed", { name, id: record.id }) : record.id;
  }

  async render(): Promise<void> {
    const generation = (this.#generation += 1);
    const document = this.root.ownerDocument;
    let accounts: ExtensionAccount[];
    let selected: string | undefined;
    let counts: EntityCounts | undefined;
    let records: AnyEntity[] = [];
    let names = new Map<string, string>();
    // Never fails: an unreadable setting reads as the default.
    const retention = await this.data.snapshotRetention();
    try {
      accounts = await this.accounts.listAccounts();
      const activeId = (await this.accounts.getActiveAccount())?.id;
      selected = accounts.some((a) => a.id === this.#selected)
        ? this.#selected
        : (activeId ?? accounts[0]?.id);
      if (selected) {
        counts = await this.data.counts(selected);
        if (this.#shown && selected === this.#selected) {
          records = await this.data.records(selected, this.#shown);
          names = memberNames(
            this.#shown === "joyClubMembers"
              ? records
              : await this.data.records(selected, "joyClubMembers"),
          );
        }
      }
    } catch {
      if (generation === this.#generation) {
        const focus = this.#rememberFocus(document);
        this.root.textContent = t("data.readFailed");
        // Import needs none of these reads. Redraw it, so a chooser that a
        // file choice disabled is enabled again.
        this.#importStatus.redraw();
        this.importRoot?.replaceChildren(
          this.#renderImport(document),
          this.#importStatus.node,
        );
        if (this.importRoot) restoreFocus(this.importRoot, focus);
      }
      return;
    }
    if (generation !== this.#generation) return;
    this.#names = names;
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
    const focus = this.#rememberFocus(document);
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
    if (this.importRoot) {
      // Import is on the Accounts tab (owner decision); say so here too.
      const pointer = element(document, "p", "joyfox-panel__hint");
      pointer.append(withTabLinks(document, t("data.importPointer")));
      this.root.append(pointer);
    }
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
    this.root.append(
      this.#renderRetention(document, retention),
      this.#renderGlobalActions(document),
      this.#status.node,
    );
    this.importRoot?.replaceChildren(
      this.#renderImport(document),
      this.#importStatus.node,
    );
    const next = this.#focusNext;
    this.#focusNext = undefined;
    if (next) restoreFocus(this.root, next);
    else if (!restoreFocus(this.root, focus, this.#fallbacks(focus)))
      if (this.importRoot) restoreFocus(this.importRoot, focus);
  }

  /** The keyed control that has focus, in this panel or in Import. */
  #rememberFocus(document: Document): FocusMemo | undefined {
    return (
      rememberFocus(this.root) ??
      rememberFocus(this.importRoot) ??
      (focusFell(document) ? this.#focusBefore : undefined)
    );
  }

  /**
   * Where focus goes when its control is gone after a draw: after a record
   * is deleted, the list's heading; after a type is emptied, the table.
   */
  #fallbacks(focus: FocusMemo | undefined): string[] {
    const kind = focus?.key.split(":")[0];
    switch (kind) {
      case "delete":
      case "record":
      case "more":
        return ["records-heading", "counts"];
      case "delete-all":
      case "show":
        return ["counts"];
      default:
        return [];
    }
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
    select.setAttribute(FOCUS_KEY, "account-picker");
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
    // Takes focus when a type's buttons go (its records were deleted).
    table.tabIndex = -1;
    table.setAttribute(FOCUS_KEY, "counts");
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
        const show = this.#button(
          document,
          "joyfox-data__show",
          t(showing ? "data.hide" : "data.show"),
          t(showing ? "data.hideLabel" : "data.showLabel", { label }),
          () => {
            this.#pending = undefined;
            this.#shown = showing ? undefined : name;
            this.#shownLimit = RECORD_PAGE_SIZE;
            // Shown: straight to the records. Hidden: focus stays here.
            if (!showing)
              this.#focusNext = { key: "records-heading", scroll: true };
            void this.render();
          },
        );
        show.setAttribute(FOCUS_KEY, `show:${name}`);
        actions.append(show);
        if (isDeletableEntity(name))
          actions.append(
            this.#confirmButton(
              document,
              `delete-all:${name}`,
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
    // "Show" moves focus here, so the records are read next.
    title.tabIndex = -1;
    title.setAttribute(FOCUS_KEY, "records-heading");
    section.append(title);
    if (!isDeletableEntity(name)) {
      const hint = element(document, "p", "joyfox-panel__hint");
      // "Accounts" links to the Accounts tab.
      hint.append(withTabLinks(document, t("data.accountRecordHint")));
      section.append(hint);
    }
    const list = element(document, "ul", "joyfox-data__record-list");
    for (const record of records.slice(0, this.#shownLimit)) {
      const item = element(document, "li", "joyfox-data__record");
      item.dataset.recordId = record.id;
      const details = element(document, "details", "joyfox-data__details");
      const summary = element(
        document,
        "summary",
        "",
        this.#summary(name, record),
      );
      summary.setAttribute(FOCUS_KEY, `record:${record.id}`);
      details.append(summary);
      details.open = this.#openRecords.has(record.id);
      // A record's fields and its stored JSON are drawn when it is opened,
      // never for every listed record: an imported record can be very large.
      whenOpened(details, () => {
        // The stored JSON stays one click away, exactly as exported.
        const raw = element(document, "details", "joyfox-data__raw");
        raw.append(element(document, "summary", "", t("data.rawJson")));
        whenOpened(raw, () =>
          raw.append(
            element(
              document,
              "pre",
              "joyfox-data__json",
              JSON.stringify(record, null, 2),
            ),
          ),
        );
        // An Ignore and Delete run in plain words first, as its notice on
        // JoyClub says it; the stored steps stay below.
        const log = record as ActionLog;
        if (name === "actionLogs" && log.action === QUICK_IGNORE_DELETE)
          details.append(this.#renderReport(document, log));
        details.append(
          renderFields(document, record as unknown as Record<string, unknown>),
          raw,
        );
      });
      item.append(details);
      if (isDeletableEntity(name)) {
        const shown = this.#recordText(name, record);
        item.append(
          this.#confirmButton(
            document,
            `delete:${record.id}`,
            { kind: "record", entity: name, id: record.id },
            t("data.delete"),
            message("data.deleteRecordLabel", { record: shown }),
            message("data.deleteRecordPrompt", { record: shown }),
            (accountId) => this.data.deleteRecord(accountId, name, record.id),
            message("data.deletedRecord", { record: shown }),
          ),
        );
      }
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
            // Focus goes to the first record the click adds.
            const first = records[this.#shownLimit];
            if (first)
              this.#focusNext = { key: `record:${first.id}`, scroll: true };
            this.#shownLimit += RECORD_PAGE_SIZE;
            void this.render();
          },
          "more",
        ),
      );
    return section;
  }

  /** What an Ignore and Delete run did, from its steps (PRD Section 21.2). */
  #renderReport(document: Document, log: ActionLog): HTMLElement {
    const list = element(document, "ul", "joyfox-data__report");
    // Steps are checked on import; a malformed one must not break the page.
    try {
      for (const line of reportOperation(log, Date.now()).lines)
        list.append(element(document, "li", "", t(line)));
    } catch {
      list.replaceChildren();
    }
    return list;
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
          }, EXPORT_FAILED),
        "export",
      ),
      document.createTextNode(" "),
      this.#confirmButton(
        document,
        "delete-account",
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

  /**
   * How many profile snapshots are kept per member (V1-12, PRD 13.3). Saving a
   * lower number deletes older snapshots at once, in every account.
   */
  #renderRetention(document: Document, current: number): HTMLElement {
    const section = element(document, "div", "joyfox-data__retention");
    const field = element(document, "p", "joyfox-panel__field");
    const label = element(
      document,
      "label",
      "joyfox-panel__field-label",
      t("data.retentionLabel"),
    );
    label.htmlFor = "joyfox-data-retention";
    const input = element(document, "input", "joyfox-data__retention-input");
    input.id = "joyfox-data-retention";
    input.type = "number";
    input.step = "1";
    input.min = String(MIN_SNAPSHOT_RETENTION);
    input.max = String(MAX_SNAPSHOT_RETENTION);
    // Drawn armed, the field keeps the number the second click saves.
    const pending = this.#pending;
    const armed = pending?.kind === "retention" ? pending : undefined;
    input.value = String(armed?.keep ?? current);
    input.setAttribute(FOCUS_KEY, "retention");
    const hint = element(
      document,
      "p",
      "joyfox-panel__hint",
      t("data.retentionHint", {
        minimum: MIN_SNAPSHOT_RETENTION,
        maximum: MAX_SNAPSHOT_RETENTION,
        default: DEFAULT_SNAPSHOT_RETENTION,
      }),
    );
    hint.id = "joyfox-data-retention-hint";
    input.setAttribute("aria-describedby", hint.id);
    const save = this.#button(
      document,
      "joyfox-data__retention-save",
      t(armed ? "data.retentionConfirm" : "data.retentionSave"),
      undefined,
      (event) => {
        const keep = Number(input.value);
        // A lower number deletes older snapshots at once, in every account:
        // it saves only on a second click, as a delete does.
        if (isSnapshotRetention(keep) && keep < current) {
          // Confirms only on a button drawn armed, and only while that
          // request is still armed now: typing a number disarms it without a
          // redraw, and typing the same number again must ask again.
          const live = this.#pending;
          if (
            !armed ||
            armed.keep !== keep ||
            live?.kind !== "retention" ||
            live.keep !== keep
          ) {
            if (event.detail > 1) return;
            this.#pending = { kind: "retention", keep };
            this.#armedAt = confirmTiming.now();
            this.#setStatus(
              message("data.retentionConfirmPrompt", { keep }),
              "info",
            );
            void this.render();
            return;
          }
          if (!confirmAllowed(event, this.#armedAt)) return;
        }
        void this.#guard(async () => {
          // Any other action disarms a pending delete, at once.
          this.#pending = undefined;
          if (!isSnapshotRetention(keep)) {
            this.#setStatus(
              message("data.retentionInvalid", {
                minimum: MIN_SNAPSHOT_RETENTION,
                maximum: MAX_SNAPSHOT_RETENTION,
              }),
              "error",
            );
            return;
          }
          const deleted = await this.data.setSnapshotRetention(keep);
          this.#setStatus(message("data.retentionSaved", { deleted }), "info");
          this.onChange();
        }, RETENTION_FAILED);
      },
      "retention-save",
    );
    input.addEventListener("input", () => {
      // Another number: the armed one no longer applies.
      if (this.#pending?.kind !== "retention") return;
      this.#pending = undefined;
      save.textContent = t("data.retentionSave");
      this.#status.clear();
    });
    field.append(label, " ", input, " ", save);
    section.append(field, hint);
    return section;
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
          }, EXPORT_FAILED),
        "export-all",
      ),
      document.createTextNode(" "),
      this.#confirmButton(
        document,
        "delete-everything",
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
    input.setAttribute(FOCUS_KEY, "import-file");
    input.addEventListener("change", () => {
      const file = input.files?.[0];
      if (!file || this.#importing) return;
      this.#importing = true;
      // Before the chooser is disabled, which drops its focus.
      this.#focusBefore = this.#rememberFocus(input.ownerDocument);
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
    // Settings by name in the UI language; one JoyFox does not name keeps
    // its stored key.
    if (plan.settingsSkipped.length > 0)
      preview.append(
        element(
          document,
          "p",
          "",
          t("data.import.settingsSkipped", {
            keys: settingNames(plan.settingsSkipped),
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
            { keys: settingNames(plan.settingsAdded) },
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
    try {
      await this.render();
    } finally {
      this.#focusBefore = undefined;
    }
  }

  #button(
    document: Document,
    className: string,
    text: string,
    ariaLabel: string | undefined,
    onClick: (event: MouseEvent) => void,
    focusKey?: string,
  ): HTMLButtonElement {
    const node = element(document, "button", className, text);
    node.type = "button";
    if (ariaLabel) node.setAttribute("aria-label", ariaLabel);
    // A key that stays the same across draws keeps focus on this button.
    if (focusKey) node.setAttribute(FOCUS_KEY, focusKey);
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
    focusKey: string,
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
      // The same key armed and unarmed, so focus stays on it when it arms.
      focusKey,
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
   * A refusal (an `ExtensionError`) comes before any change, so its message
   * says what did not happen: for a delete, nothing was deleted. Any other
   * failure may come part-way through "delete everything", so its message
   * points at the redrawn counts instead of claiming nothing changed.
   */
  async #guard(
    action: () => Promise<void>,
    failure: Failure = DELETE_FAILED,
  ): Promise<void> {
    try {
      await action();
    } catch (error) {
      this.#pending = undefined;
      const display = errorDisplay(error);
      this.#setStatus(
        display
          ? message(failure.suffix, { error: display })
          : message(failure.fallback),
        "error",
      );
    }
    await this.render();
  }
}
