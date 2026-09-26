import {
  AccountService,
  ACTIVE_ACCOUNT_SETTING_KEY,
} from "../accounts/account-service";
import type { EntityMap, EntityName } from "../domain/types";
import { ExtensionError } from "../errors";
import type { PlainKey } from "../i18n/catalog/en";
import { message } from "../i18n/message";
import {
  withAccountLock,
  withExclusiveDataLock,
} from "../storage/account-lock";
import { ENTITY_NAMES } from "../storage/database";
import {
  runtimeSettingsArea,
  type SettingsArea,
} from "../storage/local-settings";
import {
  clearAllData,
  countAccountRecords,
  countAllRecords,
  deleteAccountEntities,
  exportAccount,
  exportAllData,
  putRecords,
  repositories,
  type DataExport,
  type EntityCounts,
  type FullDataExport,
} from "../storage/repositories";
import {
  isSnapshotRetention,
  MAX_SNAPSHOT_RETENTION,
  MIN_SNAPSHOT_RETENTION,
  readSnapshotRetention,
  SNAPSHOT_RETENTION_KEY,
} from "../storage/snapshot-retention";
import { bumpTriageRevision } from "../storage/triage-revision";
import {
  parseImportFile,
  planImport,
  type ImportPlan,
  type StoredSnapshot,
} from "./import";

/**
 * Catalog keys of the plain-language names for the inspector (PRD Section
 * 13.5): `entity.<name>`.
 */
export const ENTITY_LABELS: Readonly<Record<EntityName, PlainKey>> =
  Object.fromEntries(
    ENTITY_NAMES.map((name) => [name, `entity.${name}` as const]),
  ) as Record<EntityName, `entity.${EntityName}`>;

/**
 * The account record is removed only with the whole account, from the
 * Accounts panel. Deleting it alone would leave the account's other records
 * without an owner the extension can show or select.
 */
export const ACCOUNT_BOUND_ENTITIES: readonly EntityName[] = [
  "extensionAccounts",
];

export function isDeletableEntity(name: EntityName): boolean {
  return !ACCOUNT_BOUND_ENTITIES.includes(name);
}

export type AnyEntity = EntityMap[EntityName];

const newestFirst = (a: AnyEntity, b: AnyEntity) =>
  b.updatedAt.localeCompare(a.updatedAt) || a.id.localeCompare(b.id);

/**
 * M8: inspect, export and delete stored data. Every delete runs under the
 * account's lock, the same lock every write takes, so a delete never
 * interleaves with a write to that account from another tab or the
 * background. Every delete that can change what a page shows also sets the
 * triage revision, so open pages re-evaluate at once.
 */
export class DataService {
  constructor(
    private readonly accounts = new AccountService(),
    private readonly settings: SettingsArea = runtimeSettingsArea,
  ) {}

  counts(accountId: string): Promise<EntityCounts> {
    return countAccountRecords(accountId);
  }

  async records(accountId: string, name: EntityName): Promise<AnyEntity[]> {
    const records = (await repositories[name].list(accountId)) as AnyEntity[];
    return records.sort(newestFirst);
  }

  exportAccount(accountId: string): Promise<DataExport> {
    return exportAccount(accountId);
  }

  async exportAll(): Promise<
    FullDataExport & { settings: Record<string, unknown> }
  > {
    const [data, settings] = await Promise.all([
      exportAllData(),
      this.settingsSnapshot(),
    ]);
    return { ...data, settings };
  }

  async deleteRecord(
    accountId: string,
    name: EntityName,
    id: string,
  ): Promise<void> {
    this.#requireDeletable(name);
    await this.#locked(accountId, () =>
      repositories[name].delete(accountId, id),
    );
  }

  async deleteEntity(accountId: string, name: EntityName): Promise<void> {
    this.#requireDeletable(name);
    await this.#locked(accountId, () =>
      deleteAccountEntities(accountId, [name]),
    );
  }

  /**
   * Deletes every record in the account except the account itself, so the
   * account stays registered (and active, if it was) with no data under it.
   * Removing the account too is the Accounts panel's "Remove".
   */
  async clearAccountData(accountId: string): Promise<void> {
    await this.#locked(accountId, () =>
      deleteAccountEntities(accountId, ENTITY_NAMES.filter(isDeletableEntity)),
    );
  }

  /**
   * Deletes everything JoyFox stores in this browser profile: every record
   * in every store, whatever its scope, and every `storage.local` setting.
   * The active pointer goes first, so a page or write that runs meanwhile
   * sees no active account instead of a half-deleted one. The exclusive data
   * lock is held while the stores and settings are emptied, and both are
   * checked empty before success is reported.
   */
  async deleteEverything(): Promise<void> {
    await this.settings.remove([ACTIVE_ACCOUNT_SETTING_KEY]);
    // Exclusive: waits for every account-locked write in any scope (account
    // creation, a switch, the wake counter), and holds back new ones.
    await withExclusiveDataLock(async () => {
      await clearAllData();
      await this.settings.clear();
      // Every writer holds the shared lock, so nothing should remain. Check
      // anyway rather than report success over data left behind.
      if (
        (await countAllRecords()) > 0 ||
        Object.keys(await this.settings.getAll()).length > 0
      )
        throw new Error("Data was written while deleting");
    });
  }

  /** How many profile snapshots are kept per member (V1-12). */
  snapshotRetention(): Promise<number> {
    return readSnapshotRetention(this.settings);
  }

  /**
   * Saves how many profile snapshots are kept per member, then deletes the
   * older snapshots of every member in every account at once. Holds the
   * exclusive data lock, so no capture or import overlaps the purge. Returns
   * how many snapshots were deleted.
   */
  async setSnapshotRetention(keep: number): Promise<number> {
    if (!isSnapshotRetention(keep))
      throw new ExtensionError("StorageError", "Invalid snapshot retention", {
        display: message("data.retentionInvalid", {
          minimum: MIN_SNAPSHOT_RETENTION,
          maximum: MAX_SNAPSHOT_RETENTION,
        }),
      });
    return withExclusiveDataLock(async () => {
      await this.settings.set({ [SNAPSHOT_RETENTION_KEY]: keep });
      return repositories.profileSnapshots.pruneAll(keep);
    });
  }

  /**
   * Check a file and show what importing it would change, without writing.
   * The returned signature must be passed to `applyImport`.
   */
  async previewImport(text: string): Promise<ImportPlan> {
    return planImport(parseImportFile(text), await this.#snapshot());
  }

  /**
   * Merge a file into stored data. Holds the exclusive data lock, so no write
   * overlaps it, and plans again from current data: if the result differs
   * from the preview, nothing is written. All records are written in one
   * transaction, so a failure leaves stored records unchanged.
   * Settings follow as a best-effort second step.
   */
  async applyImport(
    text: string,
    signature: string,
  ): Promise<ImportPlan & { settingsSaved: boolean }> {
    const file = parseImportFile(text);
    const plan = await withExclusiveDataLock(async () => {
      const current = planImport(file, await this.#snapshot());
      if (current.signature !== signature)
        throw new ExtensionError(
          "StorageError",
          "Stored data changed while the file was checked. Choose the file again",
          { display: message("error.data.changedDuringCheck") },
        );
      await putRecords(current.writes);
      // After the records committed, settings are best effort: a failure
      // here must not report the stored records as not imported.
      let settingsSaved = true;
      if (Object.keys(current.settings).length > 0)
        try {
          await this.settings.set(current.settings);
        } catch {
          settingsSaved = false;
        }
      return { ...current, settingsSaved };
    });
    await bumpTriageRevision(this.settings);
    return plan;
  }

  async #snapshot(): Promise<StoredSnapshot> {
    const [data, settings] = await Promise.all([
      exportAllData(),
      this.settings.getAll(),
    ]);
    return { entities: data.entities, settings };
  }

  /**
   * Every JoyFox setting in `storage.local` (the active pointer and opt-in
   * flags), for the full export. Values are small and never sensitive.
   */
  settingsSnapshot(): Promise<Record<string, unknown>> {
    return this.settings.getAll();
  }

  #requireDeletable(name: EntityName): void {
    if (!ENTITY_NAMES.includes(name))
      throw new ExtensionError("StorageError", "Unknown data type", {
        display: message("error.data.unknownType"),
      });
    if (!isDeletableEntity(name))
      throw new ExtensionError(
        "StorageError",
        "The account record is removed only with the whole account",
        { display: message("error.data.accountRecord") },
      );
  }

  /**
   * The account must still exist inside the lock: a delete for an account
   * removed meanwhile has nothing to act on and reports that plainly.
   */
  async #locked(accountId: string, action: () => Promise<void>): Promise<void> {
    await withAccountLock(accountId, async () => {
      const directory = await this.accounts.listAccounts();
      if (!directory.some((account) => account.id === accountId))
        throw new ExtensionError(
          "IdentityMismatch",
          "That account no longer exists",
          { display: message("error.account.gone") },
        );
      await action();
    });
    await bumpTriageRevision(this.settings);
  }
}

/** Human-readable JSON (PRD Section 21.4): indented, one key per line. */
export function serializeExport(data: DataExport | FullDataExport): string {
  return `${JSON.stringify(data, null, 2)}\n`;
}

/** A file name with the scope and date only, never an account identifier. */
export function exportFileName(data: DataExport | FullDataExport): string {
  const day = data.exportedAt.slice(0, 10);
  return data.scope === "all"
    ? `joyfox-export-all-${day}.json`
    : `joyfox-export-account-${day}.json`;
}
