import "../setup-indexeddb";
import { beforeEach, describe, expect, it } from "vitest";
import { ExtensionError } from "../../src/errors";
import {
  knownMemberIdentity,
  type MemberIdentity,
} from "../../src/identity/member-identity";
import {
  MAX_PHRASE_LENGTH,
  notSpamOverrideId,
  SpamService,
} from "../../src/spam/spam-service";
import { RuleBasedTemplateDetector } from "../../src/spam/template-detector";
import { exportAccount, repositories } from "../../src/storage/repositories";
import { freshDatabase } from "../setup-indexeddb";

const ACCOUNT = "account-a";
const sender = knownMemberIdentity("synthetic-sender-1", "test");
const unresolved: MemberIdentity = {
  status: "unresolved",
  reason: "selector-unverified",
};
const TEMPLATE =
  "Hey there, I really liked your profile and would love to chat more with you soon";
const input = {
  text: TEMPLATE,
  priorMessages: [{ id: "prior-1", text: TEMPLATE }],
};
let service: SpamService;

beforeEach(async () => {
  await freshDatabase();
  service = new SpamService();
});

describe("M3 spam service", () => {
  it("stores, deduplicates and lists phrases", async () => {
    const first = await service.addPhrase(ACCOUNT, "  Would   love to chat ");
    const again = await service.addPhrase(ACCOUNT, "would love to chat!");
    expect(again).toEqual(first);
    expect(first).toMatchObject({
      phrase: "Would love to chat",
      enabled: true,
    });
    expect(await service.listPhrases(ACCOUNT)).toHaveLength(1);
  });

  it("refuses empty and oversized phrases", async () => {
    await expect(service.addPhrase(ACCOUNT, " !!! ")).rejects.toThrow(
      ExtensionError,
    );
    await expect(
      service.addPhrase(ACCOUNT, "a".repeat(MAX_PHRASE_LENGTH + 1)),
    ).rejects.toThrow(ExtensionError);
  });

  it("uses only enabled phrases", async () => {
    const phrase = await service.addPhrase(ACCOUNT, "would love to chat");
    const text = { text: TEMPLATE, priorMessages: [] };
    expect((await service.classify(ACCOUNT, sender, text)).status).toBe(
      "flagged",
    );
    await service.setPhraseEnabled(ACCOUNT, phrase.id, false);
    expect((await service.classify(ACCOUNT, sender, text)).status).toBe(
      "clear",
    );
    expect(await service.setPhraseEnabled(ACCOUNT, "missing", true)).toBe(
      undefined,
    );
    await service.removePhrase(ACCOUNT, phrase.id);
    expect(await service.listPhrases(ACCOUNT)).toEqual([]);
  });

  it("remembers a not-spam correction for that sender and keeps it explained", async () => {
    expect((await service.classify(ACCOUNT, sender, input)).status).toBe(
      "flagged",
    );
    const marked = await service.markNotSpam(ACCOUNT, sender);
    expect(marked.status).toBe("ok");

    const restarted = new SpamService();
    const verdict = await restarted.classify(ACCOUNT, sender, input);
    expect(verdict.status).toBe("overridden");
    if (verdict.status !== "overridden") return;
    expect(verdict.matches).toHaveLength(1);
    expect(verdict.reasons[0]).toContain("You marked this sender as not spam");

    const other = knownMemberIdentity("synthetic-sender-2", "test");
    expect((await restarted.classify(ACCOUNT, other, input)).status).toBe(
      "flagged",
    );
  });

  it("makes the correction reversible", async () => {
    await service.markNotSpam(ACCOUNT, sender);
    await service.clearNotSpam(ACCOUNT, sender);
    expect((await service.classify(ACCOUNT, sender, input)).status).toBe(
      "flagged",
    );
  });

  it("keeps one override record when marked twice", async () => {
    await service.markNotSpam(ACCOUNT, sender);
    await service.markNotSpam(ACCOUNT, sender);
    expect(await repositories.extensionPreferences.list(ACCOUNT)).toHaveLength(
      1,
    );
  });

  it("refuses a correction without a stable sender identity", async () => {
    expect(await service.markNotSpam(ACCOUNT, unresolved)).toMatchObject({
      status: "disabled",
      reason: "selector-unverified",
    });
    expect(await service.clearNotSpam(ACCOUNT, unresolved)).toMatchObject({
      status: "disabled",
    });
    expect(await repositories.extensionPreferences.list(ACCOUNT)).toEqual([]);
    expect((await service.classify(ACCOUNT, unresolved, input)).status).toBe(
      "flagged",
    );
  });

  it("ignores a preference under the override key that is not an override", async () => {
    const id = notSpamOverrideId("synthetic-sender-1");
    await repositories.extensionPreferences.put(ACCOUNT, {
      id,
      accountId: ACCOUNT,
      key: id,
      value: "something else",
      createdAt: "2026-01-01T00:00:00Z",
      updatedAt: "2026-01-01T00:00:00Z",
    });
    expect((await service.classify(ACCOUNT, sender, input)).status).toBe(
      "flagged",
    );
  });

  it("exports the phrase library, the correction and the sender", async () => {
    await service.addPhrase(ACCOUNT, "would love to chat");
    await service.markNotSpam(ACCOUNT, sender);
    const exported = await exportAccount(ACCOUNT);
    expect(exported.entities.spamPhrases).toHaveLength(1);
    expect(exported.entities.extensionPreferences).toHaveLength(1);
    expect(exported.entities.joyClubMembers.map((m) => m.id)).toEqual([
      "synthetic-sender-1",
    ]);
  });

  it("keeps phrases and corrections inside their account", async () => {
    await service.addPhrase("account-b", "would love to chat");
    await service.markNotSpam("account-b", sender);
    const strict = new SpamService(
      new RuleBasedTemplateDetector({ minimumMessageLength: 5 }),
    );
    expect(await strict.listPhrases(ACCOUNT)).toEqual([]);
    expect((await strict.classify(ACCOUNT, sender, input)).status).toBe(
      "flagged",
    );
  });
});
