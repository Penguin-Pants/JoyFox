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
  connection ??= new Promise((resolve, reject) => {
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
    request.onblocked = () => reject(new Error("Database upgrade blocked"));
  });
  return connection;
}

export async function resetDatabaseConnectionForTests(): Promise<void> {
  if (connection) (await connection).close();
  connection = undefined;
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
