import { describe, expect, it } from "vitest";
import {
  contactRuleProblem,
  evaluateContactRule,
  type ContactRuleDefinition,
  type RuleCondition,
  type RuleInput,
} from "../../src/rules/contact-rule";
import { UNKNOWN_FACTS } from "../../src/qualification/facts";

const now = new Date("2026-09-23T12:00:00.000Z");

const condition = (
  kind: RuleCondition["kind"],
  extra: Partial<RuleCondition> = {},
): RuleCondition => ({
  type: "condition",
  kind,
  whenUnknown: "needs-review",
  ...extra,
});

/** PRD 11.5: all of (verified, 3 photos, 30 days), or any exception. */
const rule = (
  all: RuleCondition[],
  any: RuleCondition[] = [],
  defaultPlacement: ContactRuleDefinition["defaultPlacement"] = "quarantined",
): ContactRuleDefinition => ({
  schemaVersion: 1,
  audience: "all",
  enabled: true,
  defaultPlacement,
  root: {
    type: "group",
    match: "any",
    children: [{ type: "group", match: "all", children: all }, ...any],
  },
});

const input = (overrides: Partial<RuleInput> = {}): RuleInput => ({
  facts: { ...UNKNOWN_FACTS },
  spam: "unknown",
  trust: "unknown",
  now,
  ...overrides,
});

const prdRule = rule([
  condition("verified"),
  condition("minimumPhotos", { value: 3 }),
  condition("minimumAccountAgeDays", { value: 30 }),
]);

describe("evaluateContactRule", () => {
  it("qualifies a sender who meets every condition", () => {
    const result = evaluateContactRule(
      prdRule,
      input({
        facts: {
          ...UNKNOWN_FACTS,
          verification: true,
          photoCount: 5,
          joinedAt: "2025-01-01T00:00:00.000Z",
        },
      }),
    );
    expect(result.placement).toBe("qualified");
    expect(result.evaluatedConditions.map((c) => c.outcome)).toEqual([
      "met",
      "met",
      "met",
    ]);
  });

  it("places a failing sender in the default placement with the failed reason visible", () => {
    const result = evaluateContactRule(
      prdRule,
      input({
        facts: {
          ...UNKNOWN_FACTS,
          verification: true,
          photoCount: 1,
          joinedAt: "2025-01-01T00:00:00.000Z",
        },
      }),
    );
    expect(result.placement).toBe("quarantined");
    expect(result.reasons[0]).toMatch(/does not meet your contact rule/);
    expect(result.reasons).toContain("Photo count is 1, below the required 3.");
    expect(result.reasons).toHaveLength(2);
  });

  it("uses Needs Review as the default placement when the rule says so", () => {
    const result = evaluateContactRule(
      rule([condition("verified")], [], "needs-review"),
      input({ facts: { ...UNKNOWN_FACTS, verification: false } }),
    );
    expect(result.placement).toBe("needs-review");
  });

  it("sends an unknown fact to Needs Review by default, never to Quarantine", () => {
    const result = evaluateContactRule(
      prdRule,
      input({ facts: { ...UNKNOWN_FACTS, verification: true } }),
    );
    expect(result.placement).toBe("needs-review");
    expect(
      result.evaluatedConditions.filter((c) => c.state === "unknown"),
    ).toHaveLength(2);
    expect(result.reasons.slice(1).every((r) => /unknown/i.test(r))).toBe(true);
  });

  it("honors an explicit per-condition unknown handling", () => {
    const facts = { ...UNKNOWN_FACTS, verification: true };
    expect(
      evaluateContactRule(
        rule([
          condition("verified"),
          condition("minimumPhotos", { value: 3, whenUnknown: "met" }),
        ]),
        input({ facts }),
      ).placement,
    ).toBe("qualified");
    const strict = evaluateContactRule(
      rule([
        condition("verified"),
        condition("minimumPhotos", { value: 3, whenUnknown: "not-met" }),
      ]),
      input({ facts }),
    );
    expect(strict.placement).toBe("quarantined");
    expect(strict.evaluatedConditions[1]).toMatchObject({
      state: "unknown",
      outcome: "not-met",
    });
    expect(strict.reasons[1]).toMatch(/counts an unknown value as not met/);
  });

  it("lets an Any exception qualify a sender who fails the All box", () => {
    const result = evaluateContactRule(
      rule([condition("verified")], [condition("personallyKnown")]),
      input({
        facts: { ...UNKNOWN_FACTS, verification: false, personallyKnown: true },
      }),
    );
    expect(result.placement).toBe("qualified");
    // Only the reasons behind the outcome are listed, not the failed box.
    expect(result.reasons.join(" ")).not.toMatch(/not verified/);
  });

  it("does not let a failed exception hide a Needs Review from the main box", () => {
    const result = evaluateContactRule(
      rule([condition("verified")], [condition("personallyKnown")]),
      input({ facts: { ...UNKNOWN_FACTS, personallyKnown: false } }),
    );
    expect(result.placement).toBe("needs-review");
  });

  it("qualifies everyone when the rule has no conditions", () => {
    const result = evaluateContactRule(rule([]), input());
    expect(result.placement).toBe("qualified");
    expect(result.reasons[0]).toMatch(/no conditions/);
  });

  it("reads spam status, including the user's not-spam correction", () => {
    const spamRule = rule([condition("notTemplateSpam")]);
    expect(
      evaluateContactRule(spamRule, input({ spam: "flagged" })).placement,
    ).toBe("quarantined");
    expect(
      evaluateContactRule(spamRule, input({ spam: "overridden" })).placement,
    ).toBe("qualified");
    expect(
      evaluateContactRule(spamRule, input({ spam: "unknown" })).placement,
    ).toBe("needs-review");
  });

  it("reads the trust score, and treats no history as unknown", () => {
    const trustRule = rule([condition("minimumTrustScore", { value: 1 })]);
    expect(
      evaluateContactRule(
        trustRule,
        input({ trust: { score: 2, contributions: [] } }),
      ).placement,
    ).toBe("qualified");
    expect(
      evaluateContactRule(
        trustRule,
        input({ trust: { score: 0, contributions: [] } }),
      ).placement,
    ).toBe("quarantined");
    expect(evaluateContactRule(trustRule, input()).placement).toBe(
      "needs-review",
    );
  });

  it("evaluates nested groups", () => {
    const nested: ContactRuleDefinition = {
      ...rule([]),
      root: {
        type: "group",
        match: "all",
        children: [
          condition("verified"),
          {
            type: "group",
            match: "any",
            children: [
              condition("minimumPhotos", { value: 3 }),
              condition("minimumProfileWords", { value: 50 }),
            ],
          },
        ],
      },
    };
    const facts = {
      ...UNKNOWN_FACTS,
      verification: true,
      photoCount: 0,
      profileWordCount: 80,
    };
    expect(evaluateContactRule(nested, input({ facts })).placement).toBe(
      "qualified",
    );
  });

  it("is pure: the same input gives the same result", () => {
    const value = input({ facts: { ...UNKNOWN_FACTS, verification: true } });
    expect(evaluateContactRule(prdRule, value)).toEqual(
      evaluateContactRule(prdRule, value),
    );
  });
});

describe("contactRuleProblem", () => {
  it("accepts a valid rule", () => {
    expect(contactRuleProblem(prdRule)).toBeUndefined();
  });

  it.each([
    ["a missing root", { ...prdRule, root: undefined }],
    ["a condition as root", { ...prdRule, root: condition("verified") }],
    [
      "qualified as default placement",
      { ...prdRule, defaultPlacement: "qualified" },
    ],
    ["a future schema", { ...prdRule, schemaVersion: 2 }],
    ["an unknown audience", { ...prdRule, audience: "everyone" }],
    ["a missing threshold", rule([condition("minimumPhotos")])],
    [
      "a negative photo threshold",
      rule([condition("minimumPhotos", { value: -1 })]),
    ],
    [
      "a fractional threshold",
      rule([condition("minimumAccountAgeDays", { value: 1.5 })]),
    ],
    [
      "a threshold on a yes/no condition",
      rule([condition("verified", { value: 1 })]),
    ],
    [
      "an unknown condition kind",
      rule([{ ...condition("verified"), kind: "age" as never }]),
    ],
    [
      "an unknown unknown-handling",
      rule([{ ...condition("verified"), whenUnknown: "skip" as never }]),
    ],
  ])("rejects %s", (_label, value) => {
    expect(contactRuleProblem(value)).toBeTypeOf("string");
  });

  it("allows a negative trust threshold", () => {
    expect(
      contactRuleProblem(rule([condition("minimumTrustScore", { value: -2 })])),
    ).toBeUndefined();
  });

  it("rejects a rule nested too deeply or too wide", () => {
    let deep: ContactRuleDefinition["root"] = {
      type: "group",
      match: "all",
      children: [],
    };
    for (let i = 0; i < 5; i += 1)
      deep = { type: "group", match: "all", children: [deep] };
    expect(contactRuleProblem({ ...prdRule, root: deep })).toMatch(/deeply/);
    expect(
      contactRuleProblem(
        rule(Array.from({ length: 33 }, () => condition("verified"))),
      ),
    ).toMatch(/too many/);
  });
});
