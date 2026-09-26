import "../setup-indexeddb";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { DATABASE_NAME } from "../../src/storage/database";
import { repositories } from "../../src/storage/repositories";
import { freshDatabase } from "../setup-indexeddb";

describe("F6 database connection", () => {
  beforeEach(freshDatabase);

  it("never blocks another context that deletes or upgrades the database", async () => {
    // A second copy of the storage module, as another extension context or a
    // re-imported page has, keeps its own connection open.
    vi.resetModules();
    const other = await import("../../src/storage/database");
    await other.openDatabase();
    // Deleting the database closes that connection instead of blocking.
    await expect(freshDatabase()).resolves.toBeUndefined();
  });

  it("opens a new connection after one was closed for a version change", async () => {
    await repositories.userNotes.put("account-a", {
      id: "note:1",
      accountId: "account-a",
      memberId: "1234567",
      body: "Invented note",
      createdAt: "2026-09-25T00:00:00.000Z",
      updatedAt: "2026-09-25T00:00:00.000Z",
    });
    // This module's own connection stays open: nothing resets it here.
    await new Promise<void>((resolve, reject) => {
      const request = indexedDB.deleteDatabase(DATABASE_NAME);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
      request.onblocked = () => reject(new Error("blocked"));
    });
    // The delete closed it; the next read opens a new, empty database.
    expect(await repositories.userNotes.list("account-a")).toEqual([]);
  });
});
