import type {
  EntityMap,
  EntityName,
  ExtensionAccount,
  MessageObservation,
  ProfileSnapshot,
} from "../domain/types";
import { newestCaptureFirst } from "../domain/snapshot-order";
import {
  DATABASE_VERSION,
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
      // Instants, not strings: offsets and precision can differ.
      .sort(newestCaptureFirst);
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
/**
 * PRD Section 19.5 sets a default auto-purge window of 12 months for cached
 * message text. Observations older than this are dropped on the next write, so
 * the cache cannot grow without bound or keep message content indefinitely.
 */
export const MESSAGE_OBSERVATION_RETENTION_DAYS = 365;

export class MessageObservationRepository extends IndexedDbRepository<"messageObservations"> {
  constructor() {
    super("messageObservations");
  }
  /**
   * The window is measured from this write, using `updatedAt`, which the
   * writer always sets to now. Measuring from the record's own `observedAt`
   * would let a caller backdate one message and drag the cutoff back with it,
   * keeping everything expired alive.
   *
   * The record being written is never purged here, so `put` cannot report
   * storing something this pass deleted in the same transaction.
   */
  protected override async applyRetention(
    store: IDBObjectStore,
    accountId: string,
    entity: MessageObservation,
  ): Promise<void> {
    const cutoff =
      Date.parse(entity.updatedAt) -
      MESSAGE_OBSERVATION_RETENTION_DAYS * 24 * 60 * 60 * 1000;
    const stored = await requestResult(
      store.index("accountId").getAll(accountId) as IDBRequest<
        Array<Stored<MessageObservation>>
      >,
    );
    for (const observation of stored)
      if (
        observation.id !== entity.id &&
        Date.parse(observation.observedAt) < cutoff
      )
        store.delete(observation.storageKey);
  }
}
export class SenderSpamOverrideRepository extends IndexedDbRepository<"senderSpamOverrides"> {
  constructor() {
    super("senderSpamOverrides");
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
  messageObservations: new MessageObservationRepository(),
  senderSpamOverrides: new SenderSpamOverrideRepository(),
  actionLogs: new ActionLogRepository(),
};

export interface DataExport {
  schemaVersion: typeof DATABASE_VERSION;
  exportedAt: string;
  scope: "account";
  accountId: string;
  entities: { [N in EntityName]: EntityMap[N][] };
}

/**
 * Every record in every store, whatever its scope. It also carries records
 * whose scope is not a registered account (for example the diagnostic wake
 * counter), so "everything" is literally everything the database holds.
 */
export interface FullDataExport {
  schemaVersion: typeof DATABASE_VERSION;
  exportedAt: string;
  scope: "all";
  entities: { [N in EntityName]: EntityMap[N][] };
}

export type EntityCounts = { [N in EntityName]: number };

/** Reads every store in one transaction, so the export is one consistent view. */
export async function exportAccount(accountId: string): Promise<DataExport> {
  const db = await openDatabase();
  const transaction = db.transaction([...ENTITY_NAMES]);
  const entries = await Promise.all(
    ENTITY_NAMES.map(
      async (name) =>
        [
          name,
          (
            await requestResult(
              transaction
                .objectStore(name)
                .index("accountId")
                .getAll(accountId) as IDBRequest<
                Array<Stored<EntityMap[typeof name]>>
              >,
            )
          ).map(withoutStorageKey),
        ] as const,
    ),
  );
  return {
    schemaVersion: DATABASE_VERSION,
    exportedAt: new Date().toISOString(),
    scope: "account",
    accountId,
    entities: Object.fromEntries(entries) as DataExport["entities"],
  };
}

/** Reads every store in one transaction, so the export is one consistent view. */
export async function exportAllData(): Promise<FullDataExport> {
  const db = await openDatabase();
  const transaction = db.transaction([...ENTITY_NAMES]);
  const entries = await Promise.all(
    ENTITY_NAMES.map(
      async (name) =>
        [
          name,
          (
            await requestResult(
              transaction.objectStore(name).getAll() as IDBRequest<
                Array<Stored<EntityMap[typeof name]>>
              >,
            )
          ).map(withoutStorageKey),
        ] as const,
    ),
  );
  return {
    schemaVersion: DATABASE_VERSION,
    exportedAt: new Date().toISOString(),
    scope: "all",
    entities: Object.fromEntries(entries) as FullDataExport["entities"],
  };
}

/** Record counts per entity for one account, read in one transaction. */
export async function countAccountRecords(
  accountId: string,
): Promise<EntityCounts> {
  const db = await openDatabase();
  const transaction = db.transaction([...ENTITY_NAMES]);
  const entries = await Promise.all(
    ENTITY_NAMES.map(
      async (name) =>
        [
          name,
          await requestResult(
            transaction.objectStore(name).index("accountId").count(accountId),
          ),
        ] as const,
    ),
  );
  return Object.fromEntries(entries) as EntityCounts;
}

/**
 * Deletes every record of the given entities in one account, in one
 * transaction, so a failure leaves all of them in place rather than some.
 */
export async function deleteAccountEntities(
  accountId: string,
  names: readonly EntityName[],
): Promise<void> {
  if (names.length === 0) return;
  const db = await openDatabase();
  const transaction = db.transaction([...names], "readwrite");
  for (const name of names) {
    const store = transaction.objectStore(name);
    const keys = await requestResult(
      store.index("accountId").getAllKeys(accountId),
    );
    for (const recordKey of keys) store.delete(recordKey);
  }
  await transactionDone(transaction);
}

export async function deleteAccountData(accountId: string): Promise<void> {
  await deleteAccountEntities(accountId, ENTITY_NAMES);
}

/**
 * Empties every store, including records whose scope is not a registered
 * account. The stores themselves stay, so no schema upgrade is needed later.
 */
export async function clearAllData(): Promise<void> {
  const db = await openDatabase();
  const transaction = db.transaction([...ENTITY_NAMES], "readwrite");
  for (const name of ENTITY_NAMES) transaction.objectStore(name).clear();
  await transactionDone(transaction);
}

/**
 * Every scope that holds at least one record, registered account or not, so
 * "delete all" can lock each of them.
 */
export async function listStoredScopes(): Promise<string[]> {
  const db = await openDatabase();
  const transaction = db.transaction([...ENTITY_NAMES]);
  const scopes = await Promise.all(
    ENTITY_NAMES.map(
      (name) =>
        new Promise<string[]>((resolve, reject) => {
          const found: string[] = [];
          const request = transaction
            .objectStore(name)
            .index("accountId")
            .openKeyCursor(null, "nextunique");
          request.onsuccess = () => {
            const cursor = request.result;
            if (!cursor) return resolve(found);
            found.push(String(cursor.key));
            cursor.continue();
          };
          request.onerror = () => reject(request.error);
        }),
    ),
  );
  return [...new Set(scopes.flat())];
}

/** The total record count over every store and scope. */
export async function countAllRecords(): Promise<number> {
  const db = await openDatabase();
  const transaction = db.transaction([...ENTITY_NAMES]);
  const counts = await Promise.all(
    ENTITY_NAMES.map((name) =>
      requestResult(transaction.objectStore(name).count()),
    ),
  );
  return counts.reduce((sum, count) => sum + count, 0);
}
