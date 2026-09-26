import { describe, expect, it } from "vitest";
import {
  contactRuleProblem,
  evaluateContactRule,
  type RuleInput,
} from "../../src/rules/contact-rule";
import {
  UNKNOWN_FACTS,
  type ProfileFacts,
} from "../../src/qualification/facts";
import {
  COMPLETE_PROFILE,
  HIGH_TRUST_ACCOUNT_DAYS,
  isRulePresetId,
  presetForm,
  RULE_PRESET_IDS,
} from "../../src/rules/presets";
import { fromBuilderForm, toBuilderForm } from "../../src/rules/rule-builder";

const base = { enabled: true, defaultPlacement: "quarantined" } as const;

describe("rule presets (V1-11, ADR 0016)", () => {
  it("offers the five PRD 11.3 presets in order", () => {
    expect(RULE_PRESET_IDS).toEqual([
      "open",
      "complete",
      "verified",
      "highTrust",
      "custom",
    ]);
    expect(isRulePresetId("highTrust")).toBe(true);
    expect(isRulePresetId("")).toBe(false);
    expect(isRulePresetId("toString")).toBe(false);
  });

  it("uses the D8 values", () => {
    expect(COMPLETE_PROFILE).toEqual({ photos: 3, words: 50 });
    expect(HIGH_TRUST_ACCOUNT_DAYS).toBe(180);
  });

  it("fills the ALL box with each preset's conditions", () => {
    const unknown = { whenUnknown: "needs-review" };
    expect(presetForm("open", base).all).toEqual({});
    expect(presetForm("custom", base).all).toEqual({});
    expect(presetForm("verified", base).all).toEqual({ verified: unknown });
    expect(presetForm("complete", base).all).toEqual({
      minimumPhotos: { value: 3, ...unknown },
      minimumProfileWords: { value: 50, ...unknown },
    });
    expect(presetForm("highTrust", base).all).toEqual({
      verified: unknown,
      minimumPhotos: { value: 3, ...unknown },
      minimumProfileWords: { value: 50, ...unknown },
      minimumAccountAgeDays: { value: 180, ...unknown },
    });
    for (const id of RULE_PRESET_IDS)
      expect(presetForm(id, base).any).toEqual({});
  });

  it("has no trust-score condition in High-trust members", () => {
    expect(presetForm("highTrust", base).all.minimumTrustScore).toBeUndefined();
  });

  it("keeps the user's on switch and failing placement", () => {
    const form = presetForm("verified", {
      enabled: false,
      defaultPlacement: "needs-review",
    });
    expect(form.enabled).toBe(false);
    expect(form.defaultPlacement).toBe("needs-review");
  });

  it("gives a valid rule that reads back into the Simple editor", () => {
    for (const id of RULE_PRESET_IDS) {
      const form = presetForm(id, base);
      const definition = fromBuilderForm(form);
      expect(contactRuleProblem(definition)).toBeUndefined();
      expect(definition.schemaVersion).toBe(1);
      expect(toBuilderForm(definition)).toEqual(form);
    }
  });

  it("qualifies a sender who meets High-trust members, and no one short of it", () => {
    const rule = fromBuilderForm(presetForm("highTrust", base));
    const now = new Date("2026-09-26T12:00:00Z");
    const input = (facts: Partial<ProfileFacts>): RuleInput => ({
      facts: {
        ...UNKNOWN_FACTS,
        verification: true,
        photoCount: 3,
        profileWordCount: 50,
        joinedAt: "2026-03-01T00:00:00.000Z",
        ...facts,
      },
      spam: "unknown",
      trust: "unknown",
      now,
    });
    expect(evaluateContactRule(rule, input({})).placement).toBe("qualified");
    expect(evaluateContactRule(rule, input({ photoCount: 2 })).placement).toBe(
      "quarantined",
    );
    expect(
      evaluateContactRule(rule, input({ joinedAt: "2026-04-01T00:00:00.000Z" }))
        .placement,
    ).toBe("quarantined");
    expect(
      evaluateContactRule(rule, input({ verification: "unknown" })).placement,
    ).toBe("needs-review");
  });
});
