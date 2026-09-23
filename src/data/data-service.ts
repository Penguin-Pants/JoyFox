import {
  AccountService,
  ACTIVE_ACCOUNT_SETTING_KEY,
} from "../accounts/account-service";
import type { EntityMap, EntityName } from "../domain/types";
import { ExtensionError } from "../errors";
import { withAccountLock, withAccountLocks } from "../storage/account-lock";
import { ENTITY_NAMES } from "../storage/database";
import {
  runtimeSettingsArea,
  type SettingsArea,
} from "../storage/local-settings";
import {
  clearAllData,
  countAccountRecords,
  deleteAccountEntities,
  exportAccount,
  exportAllData,
  repositories,
  type DataExport,
  type EntityCounts,
  type FullDataExport,
} from "../storage/repositories";
import { bumpTriageRevision } from "../storage/triage-revision";

/** Plain-language names for the inspector (PRD Section 13.5). */
export const ENTITY_LABELS: Readonly<Record<EntityName, string>> = {
  extensionAccounts: "Account record",
  joyClubMembers: "Members",
  profileSnapshots: "Profile snapshots",
  userNotes: "Notes",
  userTags: "Tags",
  trustSignals: "Trust outcomes",
  contactRules: "Contact rules",
  conversationClassifications: "Manual placements",
  savedSearches: "Saved searches",
  eventMetadata: "Event notes",
  spendLogEntries: "Spending log",
  syncConfigs: "Sync settings",
  extensionPreferences: "Preferences",
  messageTemplates: "Message templates",
  spamPhrases: "Spam phrases",
  messageObservations: "Cached message text (normalized)",
  senderSpamOverrides: "Not-spam corrections",
  actionLogs: "Action log",
};

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

  exportAll(): Promise<FullDataExport> {
    return exportAllData();
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
   * sees no active account instead of a half-deleted one. All account locks
   * are held while the stores are emptied, so no accepted write lands after.
   */
  async deleteEverything(): Promise<void> {
    const accountIds = (await this.accounts.listAccounts()).map((a) => a.id);
    await this.settings.remove([ACTIVE_ACCOUNT_SETTING_KEY]);
    await withAccountLocks(accountIds, () => clearAllData());
    await this.settings.clear();
  }

  #requireDeletable(name: EntityName): void {
    if (!ENTITY_NAMES.includes(name))
      throw new ExtensionError("StorageError", "Unknown data type");
    if (!isDeletableEntity(name))
      throw new ExtensionError(
        "StorageError",
        "The account record is removed only with the whole account",
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
