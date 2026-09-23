import "../setup-indexeddb";
import { beforeEach, describe, expect, it } from "vitest";
import { AccountService } from "../../src/accounts/account-service";
import { registerTriageHandlers } from "../../src/background/triage-handlers";
import { MessageRouter } from "../../src/messaging/router";
import type { ContactRuleDefinition } from "../../src/rules/contact-rule";
import { GLOBAL_RULE_ID, RuleService } from "../../src/rules/rule-service";
import { repositories } from "../../src/storage/repositories";
import { TRIAGE_REVISION_KEY } from "../../src/storage/triage-revision";
import {
  classificationId,
  TriageService,
  type TriageResponse,
} from "../../src/triage/triage-service";
import { TrustService } from "../../src/trust/trust-service";
import { MemorySettingsArea } from "../memory-settings";
import { freshDatabase } from "../setup-indexeddb";

const A = "account-a";
const B = "account-b";
const MEMBER = "1234567";
const OTHER = "98765432";
const NOW = new Date("2026-09-23T12:00:00.000Z");

let settings: MemorySettingsArea;
let rules: RuleService;
let triage: TriageService;
let trust: TrustService;
let ids = 0;

const photoRule = (
  extra: Partial<ContactRuleDefinition> = {},
): ContactRuleDefinition => ({
  schemaVersion: 1,
  audience: "all",
  enabled: true,
  defaultPlacement: "quarantined",
  root: {
    type: "group",
    match: "all",
    children: [
      {
        type: "condition",
        kind: "minimumPhotos",
        value: 3,
        whenUnknown: "needs-review",
      },
    ],
  },
  ...extra,
});

function ok(response: TriageResponse) {
  if (response.status !== "ok") throw new Error(`got ${response.status}`);
  return response.results;
}

beforeEach(async () => {
  await freshDatabase();
  settings = new MemorySettingsArea();
  rules = new RuleService(undefined, settings, () => NOW.toISOString());
  triage = new TriageService(
    undefined,
    undefined,
    undefined,
    undefined,
    undefined,
    undefined,
    settings,
    () => NOW,
    () => `id-${(ids += 1)}`,
  );
  trust = new TrustService(
    undefined,
    undefined,
    settings,
    () => NOW.toISOString(),
    () => `id-${(ids += 1)}`,
  );
});

describe("TriageService.evaluate", () => {
  it("reports why triage is off instead of placing anyone", async () => {
    expect(await triage.evaluate(undefined, [])).toEqual({
      status: "no-account",
    });
    expect(await triage.evaluate(A, [])).toEqual({
      status: "no-rule",
      accountId: A,
    });
    await rules.saveGlobalRule(A, photoRule({ enabled: false }));
    expect(await triage.evaluate(A, [])).toEqual({
      status: "rule-disabled",
      accountId: A,
    });
  });

  it("places a sender from a cached snapshot the inbox cannot show", async () => {
    await rules.saveGlobalRule(A, photoRule());
    expect(
      ok(await triage.evaluate(A, [{ memberId: MEMBER, observed: {} }]))[0]
        ?.placement,
    ).toBe("needs-review");
    await triage.captureSnapshot(A, MEMBER, { photoCount: 1 });
    const [result] = ok(
      await triage.evaluate(A, [{ memberId: MEMBER, observed: {} }]),
    );
    expect(result?.placement).toBe("quarantined");
    expect(result?.source).toBe("rule");
    expect(result?.automatic.reasons).toContain(
      "Photo count is 1, below the required 3.",
    );
    expect(result?.automatic.evaluatedConditions[0]?.source).toBe("cached");
  });

  it("applies a manual placement over the rule and still shows the rule's view", async () => {
    await rules.saveGlobalRule(A, photoRule());
    await triage.captureSnapshot(A, MEMBER, { photoCount: 1 });
    await triage.setOverride(A, MEMBER, "qualified");
    const [result] = ok(
      await triage.evaluate(A, [{ memberId: MEMBER, observed: {} }]),
    );
    expect(result).toMatchObject({
      placement: "qualified",
      source: "override",
      override: { placement: "qualified", decidedAt: NOW.toISOString() },
    });
    expect(result?.automatic.placement).toBe("quarantined");

    await triage.setOverride(A, MEMBER, null);
    expect(
      await repositories.conversationClassifications.get(
        A,
        classificationId(MEMBER),
      ),
    ).toBeUndefined();
    const [cleared] = ok(
      await triage.evaluate(A, [{ memberId: MEMBER, observed: {} }]),
    );
    expect(cleared?.source).toBe("rule");
  });

  it("uses the not-spam correction and logged outcomes", async () => {
    await rules.saveGlobalRule(A, {
      ...photoRule(),
      root: {
        type: "group",
        match: "all",
        children: [
          {
            type: "condition",
            kind: "notTemplateSpam",
            whenUnknown: "needs-review",
          },
          {
            type: "condition",
            kind: "minimumTrustScore",
            value: 1,
            whenUnknown: "needs-review",
          },
        ],
      },
    });
    await repositories.senderSpamOverrides.put(A, {
      id: "spam-override:1234567",
      accountId: A,
      memberId: MEMBER,
      decision: "not-spam",
      decidedAt: NOW.toISOString(),
      createdAt: NOW.toISOString(),
      updatedAt: NOW.toISOString(),
    });
    await trust.logOutcome(A, MEMBER, "positive");
    const [result] = ok(
      await triage.evaluate(A, [{ memberId: MEMBER, observed: {} }]),
    );
    expect(result?.placement).toBe("qualified");
    expect(result?.trust).toEqual({
      score: 1,
      logged: 1,
      contributions: [{ points: 1, reason: "You logged 1 positive outcome." }],
    });
  });

  it("keeps each account's rule, overrides and history apart", async () => {
    await rules.saveGlobalRule(A, photoRule());
    await triage.setOverride(A, MEMBER, "qualified");
    await trust.logOutcome(A, MEMBER, "negative");
    expect(
      await triage.evaluate(B, [{ memberId: MEMBER, observed: {} }]),
    ).toEqual({ status: "no-rule", accountId: B });
    await rules.saveGlobalRule(B, photoRule());
    const [result] = ok(
      await triage.evaluate(B, [{ memberId: MEMBER, observed: {} }]),
    );
    expect(result?.source).toBe("rule");
    expect(result?.trust).toBe("unknown");
  });

  it("refuses a member ID that is not a JoyClub profile number", async () => {
    await rules.saveGlobalRule(A, photoRule());
    await expect(
      triage.evaluate(A, [{ memberId: "Synthetic Name", observed: {} }]),
    ).rejects.toThrow(/member ID/);
    await expect(triage.setOverride(A, "../x", "qualified")).rejects.toThrow();
  });
});

describe("snapshot capture", () => {
  it("stores counts and dates only, and skips unseen or unchanged facts", async () => {
    expect(await triage.captureSnapshot(A, MEMBER, {})).toBe(false);
    const window = {
      earliest: "2025-09-23T12:00:00.000Z",
      latest: "2025-11-23T12:00:00.000Z",
    };
    expect(
      await triage.captureSnapshot(A, MEMBER, {
        verification: true,
        photoCount: 4,
        profileWordCount: 12,
        joinedWindow: window,
        personallyKnown: true,
      }),
    ).toBe(true);
    const [snapshot] = await repositories.profileSnapshots.list(A);
    expect(snapshot).toMatchObject({
      memberId: MEMBER,
      verification: true,
      photoCount: 4,
      profileWordCount: 12,
      joinedAt: "unknown",
      joinedEarliest: window.earliest,
      joinedLatest: window.latest,
    });
    // Personally known is live-only and never cached.
    expect(snapshot).not.toHaveProperty("personallyKnown");
    // The same facts a few milliseconds later write nothing new.
    expect(
      await triage.captureSnapshot(A, MEMBER, {
        verification: true,
        photoCount: 4,
        profileWordCount: 12,
        joinedWindow: {
          earliest: "2025-09-23T12:00:00.005Z",
          latest: "2025-11-23T12:00:00.005Z",
        },
      }),
    ).toBe(false);
    expect(await repositories.profileSnapshots.list(A)).toHaveLength(1);
    expect(await repositories.joyClubMembers.get(A, MEMBER)).toBeDefined();
  });

  it("keeps capture order for two snapshots in the same millisecond", async () => {
    // Random IDs that sort against capture order, at one fixed instant.
    const randomIds = ["zzzz", "aaaa"];
    const sameTime = new TriageService(
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      settings,
      () => NOW,
      () => randomIds.shift() ?? "x",
    );
    await sameTime.captureSnapshot(A, MEMBER, { profileWordCount: 5 });
    await sameTime.captureSnapshot(A, MEMBER, {
      profileWordCount: 5,
      photoCount: 4,
    });
    await rules.saveGlobalRule(A, photoRule());
    const [result] = ok(
      await sameTime.evaluate(A, [{ memberId: MEMBER, observed: {} }]),
    );
    expect(result?.placement).toBe("qualified");
  });

  it("keeps a known fact when a later capture has not seen it yet", async () => {
    await rules.saveGlobalRule(A, photoRule());
    let tick = 0;
    const later = new TriageService(
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      settings,
      () => new Date(NOW.getTime() + (tick += 1000)),
    );
    await later.captureSnapshot(A, MEMBER, {
      verification: true,
      photoCount: 4,
      joinedWindow: {
        earliest: "2025-09-23T12:00:00.000Z",
        latest: "2025-11-23T12:00:00.000Z",
      },
    });
    // The photo badge and join badge have not rendered on this visit yet.
    expect(
      await later.captureSnapshot(A, MEMBER, { profileWordCount: 9 }),
    ).toBe(true);
    const [result] = ok(
      await later.evaluate(A, [{ memberId: MEMBER, observed: {} }]),
    );
    expect(result?.placement).toBe("qualified");
    const newest = (await repositories.profileSnapshots.list(A)).sort((a, b) =>
      b.capturedAt.localeCompare(a.capturedAt),
    )[0];
    expect(newest).toMatchObject({
      verification: true,
      photoCount: 4,
      profileWordCount: 9,
      joinedEarliest: "2025-09-23T12:00:00.000Z",
    });
  });

  it("drops a value of the wrong shape instead of storing it", async () => {
    await triage.captureSnapshot(A, MEMBER, {
      photoCount: -3 as never,
      profileWordCount: 7,
    });
    const [snapshot] = await repositories.profileSnapshots.list(A);
    expect(snapshot?.photoCount).toBe("unknown");
  });
});

describe("revision marker", () => {
  it("never reports a committed write as failed when the marker fails", async () => {
    const broken = new MemorySettingsArea();
    broken.set = () => Promise.reject(new Error("storage.local unavailable"));
    const brokenTrust = new TrustService(undefined, undefined, broken);
    const brokenRules = new RuleService(undefined, broken);
    const brokenTriage = new TriageService(
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      broken,
    );
    await expect(
      brokenTrust.logOutcome(A, MEMBER, "positive"),
    ).resolves.toBeDefined();
    await expect(
      brokenRules.saveGlobalRule(A, photoRule()),
    ).resolves.toBeDefined();
    await expect(
      brokenTriage.setOverride(A, MEMBER, "qualified"),
    ).resolves.toBeUndefined();
    expect(await repositories.trustSignals.list(A)).toHaveLength(1);
  });

  it("changes on every write that can move a placement", async () => {
    const revisions = new Set<unknown>();
    const record = () => revisions.add(settings.items.get(TRIAGE_REVISION_KEY));
    await rules.saveGlobalRule(A, photoRule());
    record();
    await triage.setOverride(A, MEMBER, "quarantined");
    record();
    await trust.logOutcome(A, MEMBER, "positive");
    record();
    await trust.undoLastOutcome(A, MEMBER);
    record();
    await triage.captureSnapshot(A, MEMBER, { photoCount: 2 });
    record();
    await rules.deleteGlobalRule(A);
    record();
    expect(revisions.size).toBe(6);
    expect(revisions.has(undefined)).toBe(false);
  });
});

describe("TrustService", () => {
  it("runs a log and an undo from two tabs one after another", async () => {
    await trust.logOutcome(A, MEMBER, "negative");
    // Two tabs, one background service: neither call waits for the other.
    const logging = trust.logOutcome(A, MEMBER, "positive");
    const undoing = trust.undoLastOutcome(A, MEMBER);
    await Promise.all([logging, undoing]);
    expect(
      (await trust.listSignals(A, MEMBER)).map((signal) => signal.kind),
    ).toEqual(["negative"]);
  });

  it("undo removes the outcome logged last, even in the same millisecond", async () => {
    // Random IDs that sort against logging order, at one fixed instant.
    const ids = ["zzzz", "aaaa"];
    const sameTime = new TrustService(
      undefined,
      undefined,
      settings,
      () => NOW.toISOString(),
      () => ids.shift() ?? "x",
    );
    await sameTime.logOutcome(A, MEMBER, "positive");
    await sameTime.logOutcome(A, MEMBER, "negative");
    await sameTime.undoLastOutcome(A, MEMBER);
    expect(
      (await sameTime.listSignals(A, MEMBER)).map((signal) => signal.kind),
    ).toEqual(["positive"]);
  });

  it("undo removes only the newest outcome for that member", async () => {
    let tick = 0;
    const clock = new TrustService(undefined, undefined, settings, () =>
      new Date(NOW.getTime() + (tick += 1000)).toISOString(),
    );
    await clock.logOutcome(A, MEMBER, "positive");
    await clock.logOutcome(A, OTHER, "negative");
    await clock.logOutcome(A, MEMBER, "negative");
    expect(await clock.undoLastOutcome(A, MEMBER)).toBe(true);
    expect(
      (await clock.listSignals(A, MEMBER)).map((signal) => signal.kind),
    ).toEqual(["positive"]);
    expect(await clock.listSignals(A, OTHER)).toHaveLength(1);
    expect(await clock.undoLastOutcome(A, MEMBER)).toBe(true);
    expect(await clock.undoLastOutcome(A, MEMBER)).toBe(false);
  });
});

describe("RuleService", () => {
  it("stores one global rule per account and rejects an invalid one", async () => {
    await rules.saveGlobalRule(A, photoRule());
    await rules.saveGlobalRule(
      A,
      photoRule({ defaultPlacement: "needs-review" }),
    );
    expect(await repositories.contactRules.list(A)).toHaveLength(1);
    expect((await rules.getGlobalRule(A))?.id).toBe(GLOBAL_RULE_ID);
    await expect(
      rules.saveGlobalRule(A, {
        ...photoRule(),
        defaultPlacement: "qualified" as never,
      }),
    ).rejects.toThrow(/defaultPlacement/);
    expect((await rules.getGlobalRule(A))?.defaultPlacement).toBe(
      "needs-review",
    );
  });

  it("does not store fields beyond the rule definition", async () => {
    await rules.saveGlobalRule(A, {
      ...photoRule(),
      extra: "value",
    } as ContactRuleDefinition);
    expect(await rules.getGlobalRule(A)).not.toHaveProperty("extra");
    const withNodeExtra = photoRule();
    Object.assign(withNodeExtra.root.children[0]!, { note: "value" });
    Object.assign(withNodeExtra.root, { label: "value" });
    await rules.saveGlobalRule(A, withNodeExtra);
    const stored = await rules.getGlobalRule(A);
    expect(stored?.root).not.toHaveProperty("label");
    expect(stored?.root.children[0]).not.toHaveProperty("note");
  });
});

describe("background triage handlers", () => {
  let router: MessageRouter;
  let active: string | undefined;
  let opened = 0;

  beforeEach(() => {
    router = new MessageRouter();
    active = A;
    opened = 0;
    registerTriageHandlers(router, {
      triage,
      trust,
      activeAccountId: () => Promise.resolve(active),
      openOptions: () => {
        opened += 1;
        return Promise.resolve();
      },
    });
  });

  const send = (type: string, payload: unknown) =>
    router.route({ type, requestId: "r1", payload } as never);

  it("rejects malformed payloads without calling a service", async () => {
    for (const [type, payload] of [
      ["triage.evaluate", { members: "all" }],
      ["triage.evaluate", { members: [{ memberId: "Name" }] }],
      ["triage.evaluate", { members: [{ memberId: MEMBER, observed: [] }] }],
      [
        "triage.setOverride",
        { accountId: A, memberId: MEMBER, placement: "deleted" },
      ],
      ["trust.log", { accountId: A, memberId: MEMBER, kind: "great" }],
      ["trust.log", { memberId: MEMBER, kind: "positive" }],
      ["snapshot.capture", { accountId: A, memberId: "x" }],
    ] as const)
      expect(await send(type, payload)).toMatchObject({ ok: false });
    expect(await repositories.trustSignals.list(A)).toEqual([]);
  });

  it("drops a write made for an account that is no longer active", async () => {
    // The page's data came from account B; A is active by the time it lands.
    for (const [type, payload] of [
      [
        "triage.setOverride",
        { accountId: B, memberId: MEMBER, placement: "qualified" },
      ],
      ["trust.log", { accountId: B, memberId: MEMBER, kind: "positive" }],
      ["trust.undo", { accountId: B, memberId: MEMBER }],
      [
        "snapshot.capture",
        { accountId: B, memberId: MEMBER, observed: { photoCount: 3 } },
      ],
    ] as const)
      expect(await send(type, payload)).toMatchObject({ ok: true });
    for (const account of [A, B]) {
      expect(await repositories.trustSignals.list(account)).toEqual([]);
      expect(await repositories.profileSnapshots.list(account)).toEqual([]);
      expect(
        await repositories.conversationClassifications.list(account),
      ).toEqual([]);
    }
  });

  it("writes nothing when no account is active", async () => {
    active = undefined;
    expect(
      await send("triage.setOverride", {
        accountId: A,
        memberId: MEMBER,
        placement: "qualified",
      }),
    ).toMatchObject({ ok: true, payload: { done: false } });
    expect(
      await send("trust.log", {
        accountId: A,
        memberId: MEMBER,
        kind: "positive",
      }),
    ).toMatchObject({ ok: true, payload: { done: false } });
    expect(
      await send("snapshot.capture", {
        accountId: A,
        memberId: MEMBER,
        observed: { photoCount: 3 },
      }),
    ).toMatchObject({ ok: true, payload: { stored: false } });
    expect(await send("triage.evaluate", { members: [] })).toMatchObject({
      ok: true,
      payload: { status: "no-account" },
    });
  });

  it("round-trips an evaluation, a trust log and the options request", async () => {
    await rules.saveGlobalRule(A, photoRule());
    expect(
      await send("trust.log", {
        accountId: A,
        memberId: MEMBER,
        kind: "positive",
      }),
    ).toMatchObject({ ok: true, payload: { done: true } });
    const response = await send("triage.evaluate", {
      members: [{ memberId: MEMBER, observed: { photoCount: 5 } }],
    });
    expect(response).toMatchObject({
      ok: true,
      payload: { status: "ok", results: [{ placement: "qualified" }] },
    });
    await send("options.open", {});
    expect(opened).toBe(1);
  });
});

describe("account lock", () => {
  it("never lets an accepted write outlive the account's removal", async () => {
    const accounts = new AccountService(
      repositories.extensionAccounts,
      settings,
    );
    const account = await accounts.createAccount({ joyClubAccountId: "a" });
    const router = new MessageRouter();
    registerTriageHandlers(router, {
      triage,
      trust,
      activeAccountId: async () => (await accounts.getActiveAccount())?.id,
      openOptions: () => Promise.resolve(),
    });
    // The write is accepted, then the account is removed while it runs.
    const writing = router.route({
      type: "trust.log",
      requestId: "r1",
      payload: { accountId: account.id, memberId: MEMBER, kind: "positive" },
    } as never);
    const capturing = router.route({
      type: "snapshot.capture",
      requestId: "r2",
      payload: {
        accountId: account.id,
        memberId: MEMBER,
        observed: { photoCount: 3 },
      },
    } as never);
    await accounts.deleteAccount(account.id);
    await Promise.all([writing, capturing]);
    expect(await repositories.trustSignals.list(account.id)).toEqual([]);
    expect(await repositories.profileSnapshots.list(account.id)).toEqual([]);
    expect(await repositories.joyClubMembers.list(account.id)).toEqual([]);
  });
});
