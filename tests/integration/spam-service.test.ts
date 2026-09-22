import "../setup-indexeddb";
import { beforeEach, describe, expect, it } from "vitest";
import { ExtensionError } from "../../src/errors";
import {
  knownMemberIdentity,
  type MemberIdentity,
} from "../../src/identity/member-identity";
import type { PersistenceOutcome } from "../../src/identity/persistence-outcome";
import { COMPARISON_WINDOW, SpamService } from "../../src/spam/spam-service";
import { repositories } from "../../src/storage/repositories";
import { freshDatabase } from "../setup-indexeddb";

const ACCOUNT_A = "account-a";
const ACCOUNT_B = "account-b";
const sender = knownMemberIdentity("synthetic-member-1", "test");
const other = knownMemberIdentity("synthetic-member-2", "test");
const unresolved: MemberIdentity = {
  status: "unresolved",
  reason: "selector-unverified",
};
const TEMPLATE =
  "Hello there, I really liked your profile and I would love to get to know you better soon.";

let service: SpamService;

beforeEach(async () => {
  await freshDatabase();
  service = new SpamService();
});

function value<T>(outcome: PersistenceOutcome<T>): T {
  if (outcome.status !== "ok")
    throw new Error(`Expected an allowed operation, got ${outcome.reason}`);
  return outcome.value;
}

async function seedPhrase(accountId: string, phrase: string, enabled = true) {
  const now = "2026-09-22T00:00:00.000Z";
  await repositories.spamPhrases.put(accountId, {
    id: `phrase-${phrase.length}-${enabled}`,
    accountId,
    phrase,
    enabled,
    createdAt: now,
    updatedAt: now,
  });
}

describe("M3 spam service hardening", () => {
  it("compares the newest observations by instant, not by text", async () => {
    const ids = ["older", "newer"];
    const clocked = new SpamService(
      undefined,
      undefined,
      undefined,
      () => "2026-09-22T00:00:00.000Z",
      () => ids.shift() ?? "extra",
    );
    // 23:00 UTC on 28 February: older, but it sorts after the other as text.
    value(
      await clocked.record(ACCOUNT_A, other, {
        text: TEMPLATE,
        observedAt: "2026-03-01T01:00:00+02:00",
      }),
    );
    value(
      await clocked.record(ACCOUNT_A, other, {
        text: TEMPLATE,
        observedAt: "2026-03-01T00:30:00Z",
      }),
    );
    const result = value(
      await clocked.classify(ACCOUNT_A, sender, { text: TEMPLATE }),
    );
    expect(result.findings[0]?.priorMessageId).toBe("newer");
  });

  it("ignores an override record that names another sender", async () => {
    value(await service.record(ACCOUNT_A, other, { text: TEMPLATE }));
    const stored = value(await service.markNotSpam(ACCOUNT_A, other));
    await repositories.senderSpamOverrides.put(ACCOUNT_A, {
      ...stored,
      id: `spam-override:${encodeURIComponent("synthetic-member-1")}`,
    });
    const result = value(
      await service.classify(ACCOUNT_A, sender, { text: TEMPLATE }),
    );
    expect(result.flagged).toBe(true);
  });
});

describe("M3 spam service", () => {
  it("flags a repeat of a recorded message from another sender", async () => {
    value(await service.record(ACCOUNT_A, other, { text: TEMPLATE }));
    const result = value(
      await service.classify(ACCOUNT_A, sender, {
        text: TEMPLATE.replace("really", "very"),
      }),
    );
    expect(result.flagged).toBe(true);
    expect(result.findings[0]?.priorMemberId).toBe("synthetic-member-2");
  });

  it("stores only normalized text, never the original message", async () => {
    value(
      await service.record(ACCOUNT_A, sender, { text: "Hello,  THERE!!!" }),
    );
    const stored = await repositories.messageObservations.list(ACCOUNT_A);
    expect(stored).toHaveLength(1);
    expect(stored[0]?.normalizedText).toBe("hello there");
    expect(JSON.stringify(stored)).not.toContain("THERE!!!");
  });

  it("does not store a message that normalizes to nothing", async () => {
    expect(
      value(await service.record(ACCOUNT_A, sender, { text: "!!! ???" })),
    ).toBeUndefined();
    expect(await repositories.messageObservations.list(ACCOUNT_A)).toEqual([]);
  });

  it("classifies before recording, so a message cannot match itself", async () => {
    const result = value(
      await service.classify(ACCOUNT_A, sender, { text: TEMPLATE }),
    );
    expect(result.flagged).toBe(false);
    value(await service.record(ACCOUNT_A, sender, { text: TEMPLATE }));
    const repeat = value(
      await service.classify(ACCOUNT_A, sender, { text: TEMPLATE }),
    );
    expect(repeat.flagged).toBe(true);
  });

  it("uses only enabled known phrases", async () => {
    await seedPhrase(
      ACCOUNT_A,
      "I would love to get to know you better",
      false,
    );
    expect(
      value(await service.classify(ACCOUNT_A, sender, { text: TEMPLATE }))
        .flagged,
    ).toBe(false);
    await seedPhrase(ACCOUNT_A, "I would love to get to know you better", true);
    expect(
      value(await service.classify(ACCOUNT_A, sender, { text: TEMPLATE }))
        .flagged,
    ).toBe(true);
  });

  it("persists a not-spam override for that sender only", async () => {
    value(await service.record(ACCOUNT_A, other, { text: TEMPLATE }));
    expect(
      value(await service.classify(ACCOUNT_A, sender, { text: TEMPLATE }))
        .flagged,
    ).toBe(true);

    value(await service.markNotSpam(ACCOUNT_A, sender, "Wrote to me first"));

    // A fresh service proves the correction survived, not in-memory state.
    const reopened = new SpamService();
    const after = value(
      await reopened.classify(ACCOUNT_A, sender, { text: TEMPLATE }),
    );
    expect(after.flagged).toBe(false);
    expect(after.findings[0]?.kind).toBe("sender-override");
    expect(value(await reopened.getOverride(ACCOUNT_A, sender))?.reason).toBe(
      "Wrote to me first",
    );

    // The correction is per-sender: another sender is still flagged.
    expect(
      value(await reopened.classify(ACCOUNT_A, other, { text: TEMPLATE }))
        .flagged,
    ).toBe(true);
  });

  it("re-flags the sender after the override is cleared", async () => {
    value(await service.record(ACCOUNT_A, other, { text: TEMPLATE }));
    value(await service.markNotSpam(ACCOUNT_A, sender));
    value(await service.clearNotSpam(ACCOUNT_A, sender));
    expect(
      value(await service.classify(ACCOUNT_A, sender, { text: TEMPLATE }))
        .flagged,
    ).toBe(true);
  });

  it("keeps message history and overrides inside one account", async () => {
    value(await service.record(ACCOUNT_A, other, { text: TEMPLATE }));
    value(await service.markNotSpam(ACCOUNT_A, sender));
    const inB = value(
      await service.classify(ACCOUNT_B, sender, { text: TEMPLATE }),
    );
    // Account B has neither A's history nor A's correction.
    expect(inB.flagged).toBe(false);
    expect(inB.findings[0]?.kind).toBe("no-match");
    expect(value(await service.getOverride(ACCOUNT_B, sender))).toBeUndefined();
  });

  it("refuses every operation while the member identity is unresolved", async () => {
    for (const outcome of [
      await service.classify(ACCOUNT_A, unresolved, { text: TEMPLATE }),
      await service.record(ACCOUNT_A, unresolved, { text: TEMPLATE }),
      await service.getOverride(ACCOUNT_A, unresolved),
      await service.markNotSpam(ACCOUNT_A, unresolved),
      await service.clearNotSpam(ACCOUNT_A, unresolved),
    ])
      expect(outcome).toMatchObject({
        status: "disabled",
        reason: "selector-unverified",
      });
    expect(await repositories.messageObservations.list(ACCOUNT_A)).toEqual([]);
    expect(await repositories.senderSpamOverrides.list(ACCOUNT_A)).toEqual([]);
  });

  it("requires an explicit active account", async () => {
    await expect(
      service.classify("  ", sender, { text: TEMPLATE }),
    ).rejects.toThrow(ExtensionError);
  });

  it("compares against a bounded window of the newest messages", async () => {
    let tick = 0;
    const bounded = new SpamService(
      repositories.messageObservations,
      repositories.senderSpamOverrides,
      repositories.spamPhrases,
      () => new Date(Date.UTC(2026, 0, 1, 0, 0, ++tick)).toISOString(),
      () => `observation-${tick}`,
    );
    // The oldest message is the only copy of the template; the window is then
    // filled past its bound with unrelated traffic.
    value(await bounded.record(ACCOUNT_A, other, { text: TEMPLATE }));
    for (let index = 0; index < COMPARISON_WINDOW; index += 1)
      value(
        await bounded.record(ACCOUNT_A, other, {
          text: `Unrelated synthetic message number ${index} about an event in a different city entirely`,
        }),
      );
    const result = value(
      await bounded.classify(ACCOUNT_A, sender, { text: TEMPLATE }),
    );
    expect(result.flagged).toBe(false);
  });
});
