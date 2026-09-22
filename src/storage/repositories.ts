import type {
  EntityMap,
  EntityName,
  ExtensionAccount,
  ProfileSnapshot,
} from "../domain/types";
import {
  ENTITY_NAMES,
  openDatabase,
  requestResult,
  transactionDone,
} from "./database";
import {
  IndexedDbRepository,
  withoutStorageKey,
  type Stored,
} from "./repository";

/**
 * Profile snapshots are time-series personal data, so the store keeps only the
 * newest snapshots per member. Without a bound, ordinary revisits grow storage
 * indefinitely and retain obsolete profile facts.
 */
export const PROFILE_SNAPSHOT_RETENTION = 20;

export class ExtensionAccountRepository extends IndexedDbRepository<"extensionAccounts"> {
  constructor() {
    super("extensionAccounts");
  }
  /**
   * The account directory is the one store that must be readable without an
   * account scope, because the scope itself is chosen from its contents. Every
   * account record is self-scoped (`accountId === id`), so this reads the
   * directory and never another account's data.
   */
  async listAllAccounts(): Promise<ExtensionAccount[]> {
    const db = await openDatabase();
    const stored = await requestResult(
      db
        .transaction("extensionAccounts")
        .objectStore("extensionAccounts")
        .getAll() as IDBRequest<Array<Stored<ExtensionAccount>>>,
    );
    return stored.map(withoutStorageKey);
  }
}
export class JoyClubMemberRepository extends IndexedDbRepository<"joyClubMembers"> {
  constructor() {
    super("joyClubMembers");
  }
}
export class ProfileSnapshotRepository extends IndexedDbRepository<"profileSnapshots"> {
  constructor() {
    super("profileSnapshots");
  }
  protected override async applyRetention(
    store: IDBObjectStore,
    accountId: string,
    entity: ProfileSnapshot,
  ): Promise<void> {
    const stored = await requestResult(
      store.index("accountId").getAll(accountId) as IDBRequest<
        Array<Stored<ProfileSnapshot>>
      >,
    );
    const newestFirst = stored
      .filter((snapshot) => snapshot.memberId === entity.memberId)
      .sort(
        (a, b) =>
          b.capturedAt.localeCompare(a.capturedAt) || b.id.localeCompare(a.id),
      );
    for (const obsolete of newestFirst.slice(PROFILE_SNAPSHOT_RETENTION))
      store.delete(obsolete.storageKey);
  }
}
export class UserNoteRepository extends IndexedDbRepository<"userNotes"> {
  constructor() {
    super("userNotes");
  }
}
export class UserTagRepository extends IndexedDbRepository<"userTags"> {
  constructor() {
    super("userTags");
  }
}
export class TrustSignalRepository extends IndexedDbRepository<"trustSignals"> {
  constructor() {
    super("trustSignals");
  }
}
export class ContactRuleRepository extends IndexedDbRepository<"contactRules"> {
  constructor() {
    super("contactRules");
  }
}
export class ConversationClassificationRepository extends IndexedDbRepository<"conversationClassifications"> {
  constructor() {
    super("conversationClassifications");
  }
}
export class SavedSearchRepository extends IndexedDbRepository<"savedSearches"> {
  constructor() {
    super("savedSearches");
  }
}
export class EventMetadataRepository extends IndexedDbRepository<"eventMetadata"> {
  constructor() {
    super("eventMetadata");
  }
}
export class SpendLogEntryRepository extends IndexedDbRepository<"spendLogEntries"> {
  constructor() {
    super("spendLogEntries");
  }
}
export class SyncConfigRepository extends IndexedDbRepository<"syncConfigs"> {
  constructor() {
    super("syncConfigs");
  }
}
export class ExtensionPreferenceRepository extends IndexedDbRepository<"extensionPreferences"> {
  constructor() {
    super("extensionPreferences");
  }
}
export class MessageTemplateRepository extends IndexedDbRepository<"messageTemplates"> {
  constructor() {
    super("messageTemplates");
  }
}
export class SpamPhraseRepository extends IndexedDbRepository<"spamPhrases"> {
  constructor() {
    super("spamPhrases");
  }
}
export class ActionLogRepository extends IndexedDbRepository<"actionLogs"> {
  constructor() {
    super("actionLogs");
  }
}

export const repositories = {
  extensionAccounts: new ExtensionAccountRepository(),
  joyClubMembers: new JoyClubMemberRepository(),
  profileSnapshots: new ProfileSnapshotRepository(),
  userNotes: new UserNoteRepository(),
  userTags: new UserTagRepository(),
  trustSignals: new TrustSignalRepository(),
  contactRules: new ContactRuleRepository(),
  conversationClassifications: new ConversationClassificationRepository(),
  savedSearches: new SavedSearchRepository(),
  eventMetadata: new EventMetadataRepository(),
  spendLogEntries: new SpendLogEntryRepository(),
  syncConfigs: new SyncConfigRepository(),
  extensionPreferences: new ExtensionPreferenceRepository(),
  messageTemplates: new MessageTemplateRepository(),
  spamPhrases: new SpamPhraseRepository(),
  actionLogs: new ActionLogRepository(),
};

export interface DataExport {
  schemaVersion: 1;
  exportedAt: string;
  accountId: string;
  entities: { [N in EntityName]: EntityMap[N][] };
}

export async function exportAccount(accountId: string): Promise<DataExport> {
  const entries = await Promise.all(
    ENTITY_NAMES.map(
      async (name) => [name, await repositories[name].list(accountId)] as const,
    ),
  );
  return {
    schemaVersion: 1,
    exportedAt: new Date().toISOString(),
    accountId,
    entities: Object.fromEntries(entries) as DataExport["entities"],
  };
}

export async function deleteAccountData(accountId: string): Promise<void> {
  const db = await openDatabase();
  for (const name of ENTITY_NAMES) {
    const transaction = db.transaction(name, "readwrite");
    const index = transaction.objectStore(name).index("accountId");
    const keys = await requestResult(index.getAllKeys(accountId));
    for (const recordKey of keys)
      transaction.objectStore(name).delete(recordKey);
    await transactionDone(transaction);
  }
}
