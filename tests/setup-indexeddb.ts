import "fake-indexeddb/auto";
import {
  DATABASE_NAME,
  resetDatabaseConnectionForTests,
} from "../src/storage/database";

export async function freshDatabase(): Promise<void> {
  await resetDatabaseConnectionForTests();
  await new Promise<void>((resolve, reject) => {
    const request = indexedDB.deleteDatabase(DATABASE_NAME);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
    request.onblocked = () => reject(new Error("blocked"));
  });
}
