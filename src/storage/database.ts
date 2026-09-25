import type { EntityName } from "../domain/types";
import { migrateReasons } from "./reason-migration";

export const DATABASE_NAME = "joyfox";
/**
 * Version 4 adds no store: it rewrites the stored reasons of manual
 * placements from English text to catalog messages (docs/i18n-spec.md,
 * ADR 0014).
 */
export const DATABASE_VERSION = 4;

/** The stores schema version 1 created. Frozen: it describes history. */
const VERSION_1_ENTITY_NAMES: readonly EntityName[] = [
  "extensionAccounts",
  "joyClubMembers",
  "profileSnapshots",
  "userNotes",
  "userTags",
  "trustSignals",
  "contactRules",
  "conversationClassifications",
  "savedSearches",
  "eventMetadata",
  "spendLogEntries",
  "syncConfigs",
  "extensionPreferences",
  "messageTemplates",
  "spamPhrases",
  "actionLogs",
];

/** The stores schema version 2 added, for the template spam detector. */
const VERSION_2_ENTITY_NAMES: readonly EntityName[] = [
  "messageObservations",
  "senderSpamOverrides",
];

/** The store schema version 3 added, for "First message contains". */
const VERSION_3_ENTITY_NAMES: readonly EntityName[] = ["messagePhraseMatches"];

export const ENTITY_NAMES: readonly EntityName[] = [
  ...VERSION_1_ENTITY_NAMES,
  ...VERSION_2_ENTITY_NAMES,
  ...VERSION_3_ENTITY_NAMES,
];

let connection: Promise<IDBDatabase> | undefined;

/**
 * Rewrite each manual placement's `reasons` as catalog messages. Records are
 * plain objects, so the rewrite runs inside the upgrade transaction and
 * commits or aborts with it.
 */
function migrateToVersion4(
  db: IDBDatabase,
  transaction: IDBTransaction | null,
): void {
  const name = "conversationClassifications";
  if (!transaction || !db.objectStoreNames.contains(name)) return;
  const cursor = transaction.objectStore(name).openCursor();
  cursor.onsuccess = () => {
    const current = cursor.result;
    if (!current) return;
    const record = current.value as Record<string, unknown>;
    current.update({
      ...record,
      reasons: migrateReasons(record.reasons, record.placement),
    });
    current.continue();
  };
}

export function openDatabase(): Promise<IDBDatabase> {
  connection ??= new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);
    request.onupgradeneeded = (event) => {
      const db = request.result;
      // Each version adds only its own stores. A fresh install runs every
      // branch in order, so a store must never be created by two of them.
      const createStores = (names: readonly EntityName[]) => {
        for (const name of names) {
          const store = db.createObjectStore(name, { keyPath: "storageKey" });
          store.createIndex("accountId", "accountId", { unique: false });
          store.createIndex("updatedAt", "updatedAt", { unique: false });
        }
      };
      if (event.oldVersion < 1) createStores(VERSION_1_ENTITY_NAMES);
      if (event.oldVersion < 2) createStores(VERSION_2_ENTITY_NAMES);
      if (event.oldVersion < 3) createStores(VERSION_3_ENTITY_NAMES);
      if (event.oldVersion < 4) migrateToVersion4(db, request.transaction);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
    // `blocked` means another connection still holds an older version. The open
    // request stays pending and succeeds once that connection closes, so this is
    // a wait condition, not a failure.
    request.onblocked = () =>
      console.warn(
        "JoyFox: database upgrade is blocked by another open connection",
      );
  }).catch((error: unknown) => {
    // Do not keep a rejected promise cached: a transient or blocking failure
    // would otherwise disable persistence for the rest of this background
    // lifetime. The next caller retries the open.
    connection = undefined;
    throw error;
  });
  return connection;
}

export async function resetDatabaseConnectionForTests(): Promise<void> {
  const pending = connection;
  connection = undefined;
  if (pending) await pending.then((db) => db.close()).catch(() => undefined);
}

export function requestResult<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export function transactionDone(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
    transaction.onabort = () => reject(transaction.error);
  });
}
