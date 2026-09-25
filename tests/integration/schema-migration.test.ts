import "../setup-indexeddb";
import { beforeEach, describe, expect, it } from "vitest";
import type { MessageObservation } from "../../src/domain/types";
import { setLocale } from "../../src/i18n/translator";
import {
  DATABASE_NAME,
  DATABASE_VERSION,
  ENTITY_NAMES,
  openDatabase,
  resetDatabaseConnectionForTests,
} from "../../src/storage/database";
import {
  exportAccount,
  MESSAGE_OBSERVATION_RETENTION_DAYS,
  repositories,
} from "../../src/storage/repositories";
import { texts } from "../i18n-text";
import { freshDatabase } from "../setup-indexeddb";

const ACCOUNT = "account-a";
const VERSION_1_STORES = [
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

const observation = (id: string, observedAt: string): MessageObservation => ({
  id,
  accountId: ACCOUNT,
  memberId: "member-1",
  observedAt,
  normalizedText: `synthetic message ${id}`,
  createdAt: observedAt,
  updatedAt: observedAt,
});

/** Builds a real version 1 database, as an install from the last release has. */
async function createVersion1Database(): Promise<void> {
  await resetDatabaseConnectionForTests();
  await new Promise<void>((resolve, reject) => {
    const request = indexedDB.deleteDatabase(DATABASE_NAME);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
  const db = await new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(DATABASE_NAME, 1);
    request.onupgradeneeded = () => {
      for (const name of VERSION_1_STORES) {
        const store = request.result.createObjectStore(name, {
          keyPath: "storageKey",
        });
        store.createIndex("accountId", "accountId", { unique: false });
        store.createIndex("updatedAt", "updatedAt", { unique: false });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  const transaction = db.transaction("userNotes", "readwrite");
  transaction.objectStore("userNotes").put({
    storageKey: `${ACCOUNT}:note-1`,
    id: "note-1",
    accountId: ACCOUNT,
    memberId: "member-1",
    body: "Note written before the upgrade",
    createdAt: "2026-09-01T00:00:00.000Z",
    updatedAt: "2026-09-01T00:00:00.000Z",
  });
  await new Promise<void>((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
  });
  db.close();
}

describe("schema version 2", () => {
  beforeEach(async () => {
    await freshDatabase();
  });

  it("creates every store exactly once on a fresh install", async () => {
    const db = await openDatabase();
    expect(db.version).toBe(DATABASE_VERSION);
    const names = Array.from(db.objectStoreNames).sort();
    expect(names).toEqual([...ENTITY_NAMES].sort());
    expect(new Set(names).size).toBe(names.length);
  });

  it("upgrades a version 1 database without losing its records", async () => {
    await createVersion1Database();
    const db = await openDatabase();
    expect(db.version).toBe(DATABASE_VERSION);
    expect(db.objectStoreNames.contains("messageObservations")).toBe(true);
    expect(db.objectStoreNames.contains("senderSpamOverrides")).toBe(true);
    const note = await repositories.userNotes.get(ACCOUNT, "note-1");
    expect(note?.body).toBe("Note written before the upgrade");
  });

  it("exports the new entities and reports the current schema version", async () => {
    await repositories.messageObservations.put(
      ACCOUNT,
      observation("o1", "2026-09-22T00:00:00.000Z"),
    );
    const exported = await exportAccount(ACCOUNT);
    expect(exported.schemaVersion).toBe(DATABASE_VERSION);
    expect(exported.entities.messageObservations).toHaveLength(1);
    expect(exported.entities.senderSpamOverrides).toEqual([]);
  });

  it("purges message observations past the retention window", async () => {
    const recent = "2026-09-22T00:00:00.000Z";
    const expired = new Date(
      Date.parse(recent) -
        (MESSAGE_OBSERVATION_RETENTION_DAYS + 1) * 24 * 60 * 60 * 1000,
    ).toISOString();
    await repositories.messageObservations.put(
      ACCOUNT,
      observation("old", expired),
    );
    await repositories.messageObservations.put(
      ACCOUNT,
      observation("new", recent),
    );
    expect(
      (await repositories.messageObservations.list(ACCOUNT)).map((o) => o.id),
    ).toEqual(["new"]);
  });

  it("keeps an observation inside the retention window", async () => {
    const recent = "2026-09-22T00:00:00.000Z";
    const inside = new Date(
      Date.parse(recent) -
        (MESSAGE_OBSERVATION_RETENTION_DAYS - 1) * 24 * 60 * 60 * 1000,
    ).toISOString();
    await repositories.messageObservations.put(
      ACCOUNT,
      observation("older", inside),
    );
    await repositories.messageObservations.put(
      ACCOUNT,
      observation("new", recent),
    );
    expect(await repositories.messageObservations.list(ACCOUNT)).toHaveLength(
      2,
    );
  });

  it("measures the window from the write, not from a backdated message", async () => {
    const writeTime = "2026-09-22T00:00:00.000Z";
    const expired = new Date(
      Date.parse(writeTime) -
        (MESSAGE_OBSERVATION_RETENTION_DAYS + 1) * 24 * 60 * 60 * 1000,
    ).toISOString();
    await repositories.messageObservations.put(
      ACCOUNT,
      observation("old", expired),
    );
    // A message observed long ago but written now must not drag the cutoff
    // back far enough to keep the expired record alive.
    await repositories.messageObservations.put(ACCOUNT, {
      ...observation("backdated", "2026-09-01T00:00:00.000Z"),
      updatedAt: writeTime,
    });
    expect(
      (await repositories.messageObservations.list(ACCOUNT)).map((o) => o.id),
    ).toEqual(["backdated"]);
  });

  it("never purges the record being written", async () => {
    const writeTime = "2026-09-22T00:00:00.000Z";
    const expired = new Date(
      Date.parse(writeTime) -
        (MESSAGE_OBSERVATION_RETENTION_DAYS + 1) * 24 * 60 * 60 * 1000,
    ).toISOString();
    await repositories.messageObservations.put(ACCOUNT, {
      ...observation("already-expired", expired),
      updatedAt: writeTime,
    });
    expect(
      (await repositories.messageObservations.list(ACCOUNT)).map((o) => o.id),
    ).toEqual(["already-expired"]);
  });

  it("purges only the writing account's expired observations", async () => {
    const recent = "2026-09-22T00:00:00.000Z";
    const expired = new Date(
      Date.parse(recent) -
        (MESSAGE_OBSERVATION_RETENTION_DAYS + 1) * 24 * 60 * 60 * 1000,
    ).toISOString();
    await repositories.messageObservations.put("account-b", {
      ...observation("other-old", expired),
      accountId: "account-b",
    });
    await repositories.messageObservations.put(
      ACCOUNT,
      observation("new", recent),
    );
    expect(
      await repositories.messageObservations.list("account-b"),
    ).toHaveLength(1);
  });
});

/** A version 2 install with manual placements in version 2's English form. */
async function createVersion2Database(
  classifications: Array<Record<string, unknown>>,
): Promise<void> {
  await resetDatabaseConnectionForTests();
  await new Promise<void>((resolve, reject) => {
    const request = indexedDB.deleteDatabase(DATABASE_NAME);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
  const db = await new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(DATABASE_NAME, 2);
    request.onupgradeneeded = () => {
      for (const name of [
        ...VERSION_1_STORES,
        "messageObservations",
        "senderSpamOverrides",
      ]) {
        const store = request.result.createObjectStore(name, {
          keyPath: "storageKey",
        });
        store.createIndex("accountId", "accountId", { unique: false });
        store.createIndex("updatedAt", "updatedAt", { unique: false });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  const transaction = db.transaction(
    "conversationClassifications",
    "readwrite",
  );
  for (const record of classifications)
    transaction.objectStore("conversationClassifications").put({
      storageKey: `${ACCOUNT}:${String(record.id)}`,
      accountId: ACCOUNT,
      source: "user",
      decidedAt: "2026-09-20T00:00:00.000Z",
      createdAt: "2026-09-20T00:00:00.000Z",
      updatedAt: "2026-09-20T00:00:00.000Z",
      ...record,
    });
  await new Promise<void>((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
  });
  db.close();
}

describe("schema version 3", () => {
  beforeEach(async () => {
    await freshDatabase();
  });

  it("rewrites version 2 reasons as messages and keeps every override", async () => {
    await createVersion2Database([
      {
        id: "classification:1",
        memberId: "1",
        placement: "needs-review",
        reasons: ["You moved this sender to Needs Review."],
      },
      {
        id: "classification:2",
        memberId: "2",
        placement: "quarantined",
        reasons: [
          "You moved this sender to Quarantined.",
          "A reason from an older build.",
        ],
      },
    ]);
    const db = await openDatabase();
    expect(db.version).toBe(3);
    const stored = await repositories.conversationClassifications.list(ACCOUNT);
    expect(
      stored
        .sort((a, b) => a.id.localeCompare(b.id))
        .map(({ memberId, placement, reasons }) => ({
          memberId,
          placement,
          reasons,
        })),
    ).toEqual([
      {
        memberId: "1",
        placement: "needs-review",
        reasons: [
          {
            key: "triage.reason.userMoved",
            params: { placement: { key: "placement.needs-review" } },
          },
        ],
      },
      {
        memberId: "2",
        placement: "quarantined",
        reasons: [
          {
            key: "triage.reason.userMoved",
            params: { placement: { key: "placement.quarantined" } },
          },
          {
            key: "legacy.text",
            params: { text: "A reason from an older build." },
          },
        ],
      },
    ]);
    // The migrated reasons read in both languages; old text stays verbatim.
    const reasons = stored.flatMap((record) => record.reasons);
    expect(texts(reasons)).toEqual([
      "You moved this sender to Needs Review.",
      "You moved this sender to Quarantined.",
      "A reason from an older build.",
    ]);
    setLocale("de");
    expect(texts(reasons)).toEqual([
      "Du hast diese Person nach „Zu prüfen“ verschoben.",
      "Du hast diese Person nach „Quarantäne“ verschoben.",
      "A reason from an older build.",
    ]);
    setLocale("en");
  });

  it("upgrades a version 1 database through both versions", async () => {
    await createVersion1Database();
    const db = await openDatabase();
    expect(db.version).toBe(3);
    expect((await repositories.userNotes.get(ACCOUNT, "note-1"))?.body).toBe(
      "Note written before the upgrade",
    );
  });

  it("refuses to store a reason that is not a catalog message", async () => {
    await expect(
      repositories.conversationClassifications.put(ACCOUNT, {
        id: "classification:3",
        accountId: ACCOUNT,
        memberId: "3",
        placement: "qualified",
        source: "user",
        decidedAt: "2026-09-20T00:00:00.000Z",
        reasons: ["Plain English" as never],
        createdAt: "2026-09-20T00:00:00.000Z",
        updatedAt: "2026-09-20T00:00:00.000Z",
      }),
    ).rejects.toThrow("catalog messages");
  });
});
