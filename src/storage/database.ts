import type { EntityName } from "../domain/types";

export const DATABASE_NAME = "joyfox";
export const DATABASE_VERSION = 1;
export const ENTITY_NAMES: readonly EntityName[] = [
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

let connection: Promise<IDBDatabase> | undefined;

export function openDatabase(): Promise<IDBDatabase> {
  connection ??= new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);
    request.onupgradeneeded = (event) => {
      const db = request.result;
      if (event.oldVersion < 1)
        for (const name of ENTITY_NAMES) {
          const store = db.createObjectStore(name, { keyPath: "storageKey" });
          store.createIndex("accountId", "accountId", { unique: false });
          store.createIndex("updatedAt", "updatedAt", { unique: false });
        }
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
