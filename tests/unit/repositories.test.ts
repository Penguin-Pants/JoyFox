import "../setup-indexeddb";
import { beforeEach, describe, expect, it } from "vitest";
import type {
  AccountScopedEntity,
  EntityMap,
  EntityName,
} from "../../src/domain/types";
import { ENTITY_NAMES } from "../../src/storage/database";
import {
  clearAllData,
  deleteAccountData,
  exportAccount,
  PROFILE_SNAPSHOT_RETENTION,
  putRecords,
  repositories,
} from "../../src/storage/repositories";
import { freshDatabase } from "../setup-indexeddb";

const now = "2026-09-22T00:00:00.000Z";
const entityData: {
  [N in EntityName]: Omit<EntityMap[N], keyof AccountScopedEntity>;
} = {
  extensionAccounts: { joyClubAccountId: "synthetic-account" },
  joyClubMembers: { joyClubMemberId: "synthetic-member" },
  profileSnapshots: {
    memberId: "member-1",
    capturedAt: now,
    verification: "unknown",
    photoCount: "unknown",
    profileWordCount: "unknown",
    joinedAt: "unknown",
  },
  userNotes: { memberId: "member-1", body: "Invented note" },
  userTags: { memberId: "member-1", label: "Invented tag" },
  trustSignals: { memberId: "member-1", kind: "neutral", occurredAt: now },
  contactRules: {
    name: "Synthetic rule",
    schemaVersion: 1,
    audience: "all",
    enabled: true,
    defaultPlacement: "needs-review",
    root: { type: "group", match: "all", children: [] },
  },
  conversationClassifications: {
    memberId: "member-1",
    conversationId: "conversation-1",
    placement: "needs-review",
    source: "user",
    decidedAt: now,
    reasons: [
      { key: "legacy.text", params: { text: "Unknown synthetic input" } },
    ],
  },
  savedSearches: {
    name: "Synthetic search",
    url: "https://example.invalid/search",
    filters: {},
  },
  eventMetadata: { eventId: "event-1", tags: [], attendance: "unknown" },
  spendLogEntries: {
    occurredAt: now,
    amountMinor: 100,
    currency: "EUR",
    category: "other",
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
  extensionPreferences: { key: "synthetic.preference", value: true },
  messageTemplates: { name: "Synthetic template", body: "Invented message" },
  spamPhrases: { phrase: "Invented phrase", enabled: true },
  messageObservations: {
    memberId: "member-1",
    observedAt: now,
    normalizedText: "invented synthetic message text",
  },
  senderSpamOverrides: {
    memberId: "member-1",
    decision: "not-spam",
    decidedAt: now,
  },
  actionLogs: { action: "synthetic.action", steps: [] },
  messagePhraseMatches: {
    memberId: "member-1",
    phrase: "blue heron",
    matchedAt: now,
  },
};

function entity<N extends EntityName>(
  name: N,
  accountId: string,
  id: string,
): EntityMap[N] {
  return {
    id,
    accountId,
    createdAt: now,
    updatedAt: now,
    ...entityData[name],
  } as EntityMap[N];
}

describe("F6 repositories", () => {
  beforeEach(freshDatabase);
  for (const name of ENTITY_NAMES)
    it(`${name} supports scoped get, list, put and delete`, async () => {
      const repo = repositories[name] as {
        put(a: string, e: AccountScopedEntity): Promise<void>;
        get(a: string, id: string): Promise<AccountScopedEntity | undefined>;
        list(a: string): Promise<AccountScopedEntity[]>;
        delete(a: string, id: string): Promise<void>;
      };
      await repo.put("account-a", entity(name, "account-a", `${name}-1`));
      await repo.put("account-b", entity(name, "account-b", `${name}-1`));
      expect((await repo.get("account-a", `${name}-1`))?.accountId).toBe(
        "account-a",
      );
      expect(await repo.list("account-a")).toHaveLength(1);
      await repo.delete("account-a", `${name}-1`);
      expect(await repo.get("account-a", `${name}-1`)).toBeUndefined();
      expect(await repo.list("account-b")).toHaveLength(1);
    });

  it("rejects cross-account writes", async () => {
    await expect(
      repositories.userNotes.put(
        "account-a",
        entity("userNotes", "account-b", "note"),
      ),
    ).rejects.toThrow("account");
  });
  it("exports every entity and deletes an account only", async () => {
    for (const name of ENTITY_NAMES)
      await (
        repositories[name] as never as {
          put(a: string, e: AccountScopedEntity): Promise<void>;
        }
      ).put("account-a", entity(name, "account-a", name));
    const exported = await exportAccount("account-a");
    expect(Object.keys(exported.entities).sort()).toEqual(
      [...ENTITY_NAMES].sort(),
    );
    await deleteAccountData("account-a");
    for (const name of ENTITY_NAMES)
      expect(
        (await repositories[name].list("account-a")) as unknown[],
      ).toHaveLength(0);
  });
  it("rejects malformed entity-specific data", async () => {
    const malformed = {
      ...entity("profileSnapshots", "account-a", "snapshot"),
      photoCount: -1,
    };
    await expect(
      repositories.profileSnapshots.put("account-a", malformed),
    ).rejects.toThrow("photoCount");
  });
  it("refuses a phrase match longer than a rule phrase can normalize to", async () => {
    const long = {
      ...entity("messagePhraseMatches", "account-a", "match"),
      phrase: "x".repeat(401),
    };
    await expect(
      repositories.messagePhraseMatches.put("account-a", long),
    ).rejects.toThrow("phrase is too long");
  });
  it("never accepts passphrases in sync configuration", async () => {
    const unsafe = {
      ...entity("syncConfigs", "account-a", "sync"),
      passphrase: "must-not-persist",
    };
    await expect(
      repositories.syncConfigs.put("account-a", unsafe),
    ).rejects.toThrow("unsupported field passphrase");
  });
  it("keeps records separate when an identifier contains the key separator", async () => {
    await repositories.userNotes.put(
      "account:a",
      entity("userNotes", "account:a", "note"),
    );
    await repositories.userNotes.put(
      "account",
      entity("userNotes", "account", "a:note"),
    );
    expect((await repositories.userNotes.get("account:a", "note"))?.id).toBe(
      "note",
    );
    expect((await repositories.userNotes.get("account", "a:note"))?.id).toBe(
      "a:note",
    );
    expect(await repositories.userNotes.list("account:a")).toHaveLength(1);
    expect(await repositories.userNotes.list("account")).toHaveLength(1);
  });
  it("bounds profile snapshot history per member", async () => {
    const total = PROFILE_SNAPSHOT_RETENTION + 5;
    for (let index = 0; index < total; index += 1)
      await repositories.profileSnapshots.put("account-a", {
        ...entity("profileSnapshots", "account-a", `snapshot-${index}`),
        capturedAt: new Date(Date.parse(now) + index * 1000).toISOString(),
      });
    await repositories.profileSnapshots.put("account-a", {
      ...entity("profileSnapshots", "account-a", "other-member"),
      memberId: "member-2",
    });
    const stored = await repositories.profileSnapshots.list("account-a");
    const memberOne = stored.filter(({ memberId }) => memberId === "member-1");
    expect(memberOne).toHaveLength(PROFILE_SNAPSHOT_RETENTION);
    expect(memberOne.map(({ id }) => id)).not.toContain("snapshot-0");
    expect(memberOne.map(({ id }) => id)).toContain(`snapshot-${total - 1}`);
    expect(
      stored.filter(({ memberId }) => memberId === "member-2"),
    ).toHaveLength(1);
  });
  it("purges the oldest snapshot by instant when offsets differ", async () => {
    for (let index = 0; index < PROFILE_SNAPSHOT_RETENTION; index += 1)
      await repositories.profileSnapshots.put("account-a", {
        ...entity("profileSnapshots", "account-a", `snapshot-${index}`),
        capturedAt: new Date(
          Date.parse("2026-03-01T01:00:00Z") + index * 1000,
        ).toISOString(),
      });
    // 23:00 UTC on 28 February: the oldest, but it sorts last as text.
    await repositories.profileSnapshots.put("account-a", {
      ...entity("profileSnapshots", "account-a", "offset-oldest"),
      capturedAt: "2026-03-01T01:00:00+02:00",
    });
    const ids = (await repositories.profileSnapshots.list("account-a")).map(
      ({ id }) => id,
    );
    expect(ids).toHaveLength(PROFILE_SNAPSHOT_RETENTION);
    expect(ids).not.toContain("offset-oldest");
  });
  it("validates a snapshot's join window", async () => {
    const base = entity("profileSnapshots", "account-a", "window");
    await repositories.profileSnapshots.put("account-a", {
      ...base,
      joinedEarliest: "2025-10-27T00:00:00.000Z",
      joinedLatest: "2025-11-26T00:00:00.000Z",
    });
    await expect(
      repositories.profileSnapshots.put("account-a", {
        ...base,
        joinedEarliest: "2025-10-27T00:00:00.000Z",
      }),
    ).rejects.toThrow("present together");
    await expect(
      repositories.profileSnapshots.put("account-a", {
        ...base,
        joinedEarliest: "2025-12-01T00:00:00.000Z",
        joinedLatest: "2025-11-01T00:00:00.000Z",
      }),
    ).rejects.toThrow("must not be after");
    for (const bad of ["1 March 2026", "2026-02-30"])
      await expect(
        repositories.profileSnapshots.put("account-a", {
          ...base,
          joinedEarliest: bad,
          joinedLatest: "2026-03-10T00:00:00.000Z",
        }),
      ).rejects.toThrow("strict ISO 8601");
  });
  it("rejects malformed action log steps", async () => {
    const malformed = {
      ...entity("actionLogs", "account-a", "action"),
      steps: [{ name: "started", ok: "yes", at: now }],
    };
    await expect(
      repositories.actionLogs.put("account-a", malformed as never),
    ).rejects.toThrow("ok must be a boolean");
  });
});

describe("F6 writes commit together or not at all", () => {
  beforeEach(freshDatabase);

  /** Make one store's method throw, as a storage error between requests would. */
  function failIn<M extends "put" | "delete" | "clear">(
    method: M,
    store: EntityName,
  ): () => void {
    const original = IDBObjectStore.prototype[method];
    IDBObjectStore.prototype[method] = function (
      this: IDBObjectStore,
      ...args: unknown[]
    ) {
      if (this.name === store) throw new Error("injected storage failure");
      return (original as (...a: unknown[]) => IDBRequest).apply(this, args);
    } as never;
    return () => {
      IDBObjectStore.prototype[method] = original;
    };
  }

  it("writes no record of an import when a later one fails", async () => {
    const restore = failIn("put", "userTags");
    try {
      await expect(
        putRecords([
          { name: "userNotes", entity: entity("userNotes", "account-a", "n") },
          { name: "userTags", entity: entity("userTags", "account-a", "t") },
        ]),
      ).rejects.toThrow("injected storage failure");
    } finally {
      restore();
    }
    expect(await repositories.userNotes.list("account-a")).toEqual([]);
  });

  it("clears no store when a later store fails", async () => {
    await repositories.userNotes.put(
      "account-a",
      entity("userNotes", "account-a", "n"),
    );
    const restore = failIn("clear", ENTITY_NAMES.at(-1)!);
    try {
      await expect(clearAllData()).rejects.toThrow("injected storage failure");
    } finally {
      restore();
    }
    expect(await repositories.userNotes.list("account-a")).toHaveLength(1);
  });

  it("keeps an account's records when a later store fails", async () => {
    await repositories.userNotes.put(
      "account-a",
      entity("userNotes", "account-a", "n"),
    );
    const restore = failIn("delete", ENTITY_NAMES.at(-1)!);
    await repositories[ENTITY_NAMES.at(-1)!].put(
      "account-a",
      entity(ENTITY_NAMES.at(-1)!, "account-a", "last") as never,
    );
    try {
      await expect(deleteAccountData("account-a")).rejects.toThrow(
        "injected storage failure",
      );
    } finally {
      restore();
    }
    expect(await repositories.userNotes.list("account-a")).toHaveLength(1);
  });

  it("does not store a snapshot whose retention purge fails", async () => {
    for (let index = 0; index < PROFILE_SNAPSHOT_RETENTION; index += 1)
      await repositories.profileSnapshots.put("account-a", {
        ...entity("profileSnapshots", "account-a", `snapshot-${index}`),
        capturedAt: new Date(Date.parse(now) + index * 1000).toISOString(),
      });
    const restore = failIn("delete", "profileSnapshots");
    try {
      await expect(
        repositories.profileSnapshots.put("account-a", {
          ...entity("profileSnapshots", "account-a", "newest"),
          capturedAt: new Date(Date.parse(now) + 60_000).toISOString(),
        }),
      ).rejects.toThrow("injected storage failure");
    } finally {
      restore();
    }
    const stored = await repositories.profileSnapshots.list("account-a");
    expect(stored.map(({ id }) => id)).not.toContain("newest");
    expect(stored).toHaveLength(PROFILE_SNAPSHOT_RETENTION);
  });
});
