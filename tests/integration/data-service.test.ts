import "../setup-indexeddb";
import { beforeEach, describe, expect, it } from "vitest";
import {
  AccountService,
  ACTIVE_ACCOUNT_SETTING_KEY,
} from "../../src/accounts/account-service";
import {
  DataService,
  ENTITY_LABELS,
  exportFileName,
  serializeExport,
} from "../../src/data/data-service";
import type {
  AccountScopedEntity,
  EntityMap,
  EntityName,
} from "../../src/domain/types";
import { DATABASE_VERSION, ENTITY_NAMES } from "../../src/storage/database";
import { withAccountLock } from "../../src/storage/account-lock";
import { repositories } from "../../src/storage/repositories";
import { TRIAGE_REVISION_KEY } from "../../src/storage/triage-revision";
import { MemorySettingsArea } from "../memory-settings";
import { freshDatabase } from "../setup-indexeddb";

const now = "2026-09-23T10:00:00.000Z";

/** One synthetic record per entity. No real member data. */
const sample: {
  [N in EntityName]: Omit<EntityMap[N], keyof AccountScopedEntity>;
} = {
  extensionAccounts: { joyClubAccountId: "synthetic" },
  joyClubMembers: { joyClubMemberId: "1234567" },
  profileSnapshots: {
    memberId: "1234567",
    capturedAt: now,
    verification: true,
    photoCount: 3,
    profileWordCount: 42,
    joinedAt: "unknown",
    joinedEarliest: "2025-09-23",
    joinedLatest: "2025-11-23",
  },
  userNotes: { memberId: "1234567", body: "Invented note\nsecond line" },
  userTags: { memberId: "1234567", label: "Invented tag" },
  trustSignals: { memberId: "1234567", kind: "positive", occurredAt: now },
  contactRules: {
    name: "Synthetic rule",
    schemaVersion: 1,
    audience: "all",
    enabled: true,
    defaultPlacement: "needs-review",
    root: { type: "group", match: "all", children: [] },
  },
  conversationClassifications: {
    memberId: "1234567",
    placement: "quarantined",
    source: "user",
    decidedAt: now,
    reasons: ["Invented reason"],
  },
  savedSearches: {
    name: "Synthetic search",
    url: "https://example.invalid/search",
    filters: { nested: [1, 2] },
  },
  eventMetadata: {
    eventId: "event-1",
    note: "Invented",
    tags: ["a"],
    attendance: "attending",
  },
  spendLogEntries: {
    occurredAt: now,
    amountMinor: 499,
    currency: "EUR",
    category: "coins",
  },
  syncConfigs: {
    endpoint: "https://example.invalid/sync",
    keyDerivation: {
      algorithm: "PBKDF2",
      iterations: 600_000,
      hash: "SHA-256",
      salt: "synthetic-salt",
    },
  },
  extensionPreferences: { key: "synthetic.preference", value: { on: true } },
  messageTemplates: {
    name: "Synthetic template",
    body: "Hallo 😀\nBis bald",
    folder: "Event confirmation",
  },
  spamPhrases: { phrase: "Invented phrase", enabled: false },
  messageObservations: {
    memberId: "1234567",
    observedAt: now,
    normalizedText: "invented synthetic message text",
  },
  senderSpamOverrides: {
    memberId: "1234567",
    decision: "not-spam",
    decidedAt: now,
    reason: "Invented",
  },
  actionLogs: {
    memberId: "1234567",
    action: "synthetic.action",
    steps: [{ name: "started", ok: true, at: now }],
  },
};

function record<N extends EntityName>(
  name: N,
  accountId: string,
  id: string,
): EntityMap[N] {
  return {
    id,
    accountId,
    createdAt: now,
    updatedAt: now,
    ...sample[name],
  } as EntityMap[N];
}

type AnyRepository = {
  put(accountId: string, entity: AccountScopedEntity): Promise<void>;
  list(accountId: string): Promise<AccountScopedEntity[]>;
};
const repo = (name: EntityName) => repositories[name] as never as AnyRepository;

/** Every entity filled for the account, the account record included. */
async function fill(accountId: string): Promise<void> {
  for (const name of ENTITY_NAMES)
    await repo(name).put(
      accountId,
      record(
        name,
        accountId,
        name === "extensionAccounts" ? accountId : `${name}-1`,
      ),
    );
}

let settings: MemorySettingsArea;
let accounts: AccountService;
let data: DataService;

beforeEach(async () => {
  await freshDatabase();
  settings = new MemorySettingsArea();
  accounts = new AccountService(repositories.extensionAccounts, settings);
  data = new DataService(accounts, settings);
  await fill("account-a");
  await fill("account-b");
  await settings.set({ [ACTIVE_ACCOUNT_SETTING_KEY]: "account-a" });
});

describe("M8 export", () => {
  it("covers every entity, item by item, with the schema version", async () => {
    const exported = await data.exportAccount("account-a");
    expect(exported.schemaVersion).toBe(DATABASE_VERSION);
    expect(exported.scope).toBe("account");
    expect(Object.keys(exported.entities).sort()).toEqual(
      [...ENTITY_NAMES].sort(),
    );
    // Round-trip through the file format, then compare each stored record.
    const file = JSON.parse(serializeExport(exported)) as typeof exported;
    for (const name of ENTITY_NAMES) {
      const stored = await repo(name).list("account-a");
      expect(stored).toHaveLength(1);
      expect(file.entities[name]).toEqual(stored);
      expect(JSON.stringify(file.entities[name])).not.toContain("account-b");
      expect(JSON.stringify(file.entities[name])).not.toContain("storageKey");
    }
  });

  it("exports everything, including records outside a registered account", async () => {
    // The diagnostic wake counter writes under a scope that is not an account.
    await repositories.extensionPreferences.put(
      "acceptance",
      record("extensionPreferences", "acceptance", "background-wake-count"),
    );
    const exported = await data.exportAll();
    expect(exported.scope).toBe("all");
    expect(exported.schemaVersion).toBe(DATABASE_VERSION);
    for (const name of ENTITY_NAMES) {
      const expected = [
        ...(await repo(name).list("account-a")),
        ...(await repo(name).list("account-b")),
        ...(await repo(name).list("acceptance")),
      ];
      expect(exported.entities[name]).toHaveLength(expected.length);
      expect(exported.entities[name]).toEqual(expect.arrayContaining(expected));
    }
  });

  it("is human-readable JSON and names no account in the file name", async () => {
    const exported = await data.exportAccount("account-a");
    const text = serializeExport(exported);
    expect(text).toContain('\n  "schemaVersion": ');
    expect(exportFileName(exported)).toBe(
      `joyfox-export-account-${exported.exportedAt.slice(0, 10)}.json`,
    );
    expect(exportFileName(exported)).not.toContain("account-a");
  });

  it("names every entity in plain language", () => {
    for (const name of ENTITY_NAMES) expect(ENTITY_LABELS[name]).toBeTruthy();
  });
});

describe("M8 inspection and delete", () => {
  it("counts records per entity for one account only", async () => {
    await repositories.userTags.put(
      "account-a",
      record("userTags", "account-a", "tag-2"),
    );
    const counts = await data.counts("account-a");
    for (const name of ENTITY_NAMES)
      expect(counts[name]).toBe(name === "userTags" ? 2 : 1);
  });

  it("lists one entity's records, newest first", async () => {
    await repositories.userTags.put("account-a", {
      ...record("userTags", "account-a", "tag-2"),
      updatedAt: "2026-09-24T00:00:00.000Z",
    });
    const ids = (await data.records("account-a", "userTags")).map((r) => r.id);
    expect(ids).toEqual(["tag-2", "userTags-1"]);
  });

  it("deletes one record and signals open pages", async () => {
    await data.deleteRecord("account-a", "userNotes", "userNotes-1");
    expect(await repositories.userNotes.list("account-a")).toEqual([]);
    expect(await repositories.userNotes.list("account-b")).toHaveLength(1);
    expect(settings.items.has(TRIAGE_REVISION_KEY)).toBe(true);
  });

  it("waits for a write that holds the account lock", async () => {
    let release!: () => void;
    const held = withAccountLock(
      "account-a",
      () => new Promise<void>((resolve) => (release = resolve)),
    );
    let deleted = false;
    const deleting = data
      .deleteEntity("account-a", "userNotes")
      .then(() => (deleted = true));
    await new Promise((resolve) => setTimeout(resolve, 10));
    expect(deleted).toBe(false);
    release();
    await Promise.all([held, deleting]);
    expect(await repositories.userNotes.list("account-a")).toEqual([]);
  });

  it("deletes one entity class in one account", async () => {
    await data.deleteEntity("account-a", "trustSignals");
    const counts = await data.counts("account-a");
    for (const name of ENTITY_NAMES)
      expect(counts[name]).toBe(name === "trustSignals" ? 0 : 1);
    expect((await data.counts("account-b")).trustSignals).toBe(1);
  });

  it("never deletes the account record on its own", async () => {
    await expect(
      data.deleteRecord("account-a", "extensionAccounts", "account-a"),
    ).rejects.toThrow("whole account");
    await expect(
      data.deleteEntity("account-a", "extensionAccounts"),
    ).rejects.toThrow("whole account");
    expect(await accounts.getActiveAccount()).toBeDefined();
  });

  it("refuses an unknown entity name from a caller", async () => {
    await expect(
      data.deleteEntity("account-a", "unknown" as EntityName),
    ).rejects.toThrow("Unknown data type");
  });

  it("clears an account's data but keeps the account", async () => {
    await data.clearAccountData("account-a");
    const counts = await data.counts("account-a");
    for (const name of ENTITY_NAMES)
      expect(counts[name]).toBe(name === "extensionAccounts" ? 1 : 0);
    expect((await accounts.getActiveAccount())?.id).toBe("account-a");
    for (const count of Object.values(await data.counts("account-b")))
      expect(count).toBe(1);
  });

  it("refuses to delete in an account that no longer exists", async () => {
    await accounts.deleteAccount("account-b");
    await expect(data.clearAccountData("account-b")).rejects.toThrow(
      "no longer exists",
    );
  });

  it("reports an account added while everything was being deleted", async () => {
    const racing = new DataService(
      {
        listAccounts: (() => {
          let calls = 0;
          return async () => {
            calls += 1;
            // The second read, inside the locks, sees a newcomer.
            if (calls === 2)
              await repositories.extensionAccounts.put("late", {
                ...record("extensionAccounts", "late", "late"),
              });
            return accounts.listAccounts();
          };
        })(),
      } as unknown as AccountService,
      settings,
    );
    await expect(racing.deleteEverything()).rejects.toThrow("added");
  });

  it("deletes everything, in every scope, with every setting", async () => {
    await repositories.extensionPreferences.put(
      "acceptance",
      record("extensionPreferences", "acceptance", "background-wake-count"),
    );
    await settings.set({ "joyfox.diagnostics": true });
    await data.deleteEverything();
    const exported = await data.exportAll();
    for (const name of ENTITY_NAMES)
      expect(exported.entities[name]).toEqual([]);
    expect(settings.items.size).toBe(0);
    expect(await accounts.getActiveAccount()).toBeUndefined();
    expect(await accounts.listAccounts()).toEqual([]);
  });
});
