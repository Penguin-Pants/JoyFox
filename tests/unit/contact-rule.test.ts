import { describe, expect, it } from "vitest";
import {
  contactRuleProblem,
  evaluateContactRule,
  rulePhrases,
  schemaVersionFor,
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

  it("lists only the conditions that caused the outcome", () => {
    // ALL fails on verification although photos pass; the exception qualifies.
    const result = evaluateContactRule(
      rule(
        [condition("verified"), condition("minimumPhotos", { value: 3 })],
        [condition("personallyKnown")],
      ),
      input({
        facts: {
          ...UNKNOWN_FACTS,
          verification: false,
          photoCount: 5,
          personallyKnown: true,
        },
      }),
    );
    expect(result.placement).toBe("qualified");
    expect(result.reasons).toEqual([
      "This sender meets your contact rule.",
      "You marked this member as personally known, as the rule requires.",
    ]);
    // Every checked condition is still in the full list.
    expect(result.evaluatedConditions).toHaveLength(3);
  });

  it("does not credit an exception when an empty ALL box already qualifies", () => {
    const result = evaluateContactRule(
      rule([], [condition("verified")]),
      input({ facts: { ...UNKNOWN_FACTS, verification: true } }),
    );
    expect(result.placement).toBe("qualified");
    expect(result.reasons).toEqual([
      "Your contact rule has no required conditions, so every sender qualifies.",
    ]);
  });

  it("qualifies everyone when the rule has no conditions", () => {
    const result = evaluateContactRule(rule([]), input());
    expect(result.placement).toBe("qualified");
    expect(result.reasons[0]).toMatch(/no required conditions/);
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
        input({ trust: { score: 2, contributions: [], logged: 1 } }),
      ).placement,
    ).toBe("qualified");
    expect(
      evaluateContactRule(
        trustRule,
        input({ trust: { score: 0, contributions: [], logged: 1 } }),
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
    ["a future schema", { ...prdRule, schemaVersion: 4 }],
    [
      "negate in schema version 1",
      rule([condition("verified", { negate: true })]),
    ],
    [
      "negate set to false",
      {
        ...rule([condition("verified", { negate: false as never })]),
        schemaVersion: 2,
      },
    ],
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

/** The owner's rule: personally known, or verified with 3 photos and 180 days. */
const advanced = (
  negate = false,
  match: "all" | "any" = "any",
): ContactRuleDefinition => ({
  schemaVersion: negate ? 2 : 1,
  audience: "all",
  enabled: true,
  defaultPlacement: "quarantined",
  root: {
    type: "group",
    match,
    children: [
      { type: "group", match: "all", children: [condition("personallyKnown")] },
      {
        type: "group",
        match: "all",
        children: [
          condition("verified"),
          condition("minimumPhotos", {
            value: 3,
            ...(negate ? { negate: true } : {}),
          }),
          condition("minimumAccountAgeDays", { value: 180 }),
        ],
      },
    ],
  },
});

const known = (value: boolean, photos: number | "unknown") =>
  input({
    facts: {
      ...UNKNOWN_FACTS,
      personallyKnown: value,
      verification: true,
      photoCount: photos,
      joinedAt: "2025-01-01T00:00:00.000Z",
    },
  });

describe("rule groups and not (ADR 0012)", () => {
  it("qualifies an unverified sender who is personally known, naming the rule", () => {
    const result = evaluateContactRule(
      advanced(),
      input({ facts: { ...UNKNOWN_FACTS, personallyKnown: true } }),
    );
    expect(result.placement).toBe("qualified");
    expect(result.reasons[1]).toMatch(/^Rule 1: /);
  });

  it("qualifies a verified sender with enough photos and days by rule 2", () => {
    const result = evaluateContactRule(advanced(), known(false, 3));
    expect(result.placement).toBe("qualified");
    expect(result.reasons.slice(1).every((r) => r.startsWith("Rule 2: "))).toBe(
      true,
    );
  });

  it("names every rule that failed", () => {
    const result = evaluateContactRule(advanced(), known(false, 2));
    expect(result.placement).toBe("quarantined");
    expect(result.reasons.slice(1).map((r) => r.slice(0, 7))).toEqual([
      "Rule 1:",
      "Rule 2:",
    ]);
  });

  it("combines rules with ALL", () => {
    expect(
      evaluateContactRule(advanced(false, "all"), known(false, 3)).placement,
    ).toBe("quarantined");
    expect(
      evaluateContactRule(advanced(false, "all"), known(true, 3)).placement,
    ).toBe("qualified");
  });

  it("turns a number condition into fewer than", () => {
    const rule = advanced(true);
    expect(contactRuleProblem(rule)).toBeUndefined();
    expect(evaluateContactRule(rule, known(false, 2)).placement).toBe(
      "qualified",
    );
    const result = evaluateContactRule(rule, known(false, 3));
    expect(result.placement).toBe("quarantined");
    const photos = result.evaluatedConditions.find(
      (c) => c.kind === "minimumPhotos",
    );
    expect(photos).toMatchObject({
      negate: true,
      state: "pass",
      outcome: "not-met",
    });
    expect(photos?.reason).toContain('"not Minimum photos"');
  });

  it("keeps the unknown choice for a turned-around condition", () => {
    const rule = advanced(true);
    const result = evaluateContactRule(rule, known(false, "unknown"));
    const photos = result.evaluatedConditions.find(
      (c) => c.kind === "minimumPhotos",
    );
    expect(photos).toMatchObject({ state: "unknown", outcome: "needs-review" });
    expect(result.placement).toBe("needs-review");
  });

  it("does not number the two-box shape", () => {
    const result = evaluateContactRule(
      prdRule,
      input({ facts: { ...UNKNOWN_FACTS, verification: false } }),
    );
    expect(result.reasons.some((r) => r.startsWith("Rule "))).toBe(false);
  });

  it("writes version 2 only when a rule uses not", () => {
    expect(schemaVersionFor(advanced().root)).toBe(1);
    expect(schemaVersionFor(advanced(true).root)).toBe(2);
    expect(
      contactRuleProblem({ ...advanced(), schemaVersion: 2 }),
    ).toBeUndefined();
  });
});

describe("First message contains (ADR 0013)", () => {
  const phraseRule = (
    extra: Partial<RuleCondition> = {},
  ): ContactRuleDefinition => ({
    ...rule([
      condition("firstMessageContains", { text: "Blue Heron", ...extra }),
    ]),
    schemaVersion: 3,
  });
  const messages = (
    seenNow: string[],
    seenBefore: string[] = [],
    previewShown = true,
  ) => ({
    messages: {
      previewShown,
      seenNow: new Set(seenNow),
      seenBefore: new Set(seenBefore),
    },
  });
  const phraseCondition = (result: ReturnType<typeof evaluateContactRule>) =>
    result.evaluatedConditions.find((c) => c.kind === "firstMessageContains");

  it("is met when the preview on screen contains the phrase", () => {
    const result = evaluateContactRule(
      phraseRule(),
      input(messages(["blue heron"])),
    );
    expect(result.placement).toBe("qualified");
    expect(phraseCondition(result)).toMatchObject({
      state: "pass",
      source: "observed",
    });
    expect(phraseCondition(result)?.reason).toContain('"Blue Heron"');
  });

  it("stays met from an earlier match after a later message", () => {
    const result = evaluateContactRule(
      phraseRule(),
      input(messages([], ["blue heron"])),
    );
    expect(result.placement).toBe("qualified");
    expect(phraseCondition(result)).toMatchObject({
      state: "pass",
      source: "cached",
    });
  });

  it("counts a preview without the phrase as unknown, never as failed", () => {
    const result = evaluateContactRule(phraseRule(), input(messages([])));
    expect(result.placement).toBe("needs-review");
    expect(phraseCondition(result)).toMatchObject({
      state: "unknown",
      outcome: "needs-review",
    });
    expect(phraseCondition(result)?.reason).toContain(
      "shows only the latest message",
    );
  });

  it("follows the unknown choice, so the user can filter hard", () => {
    const result = evaluateContactRule(
      phraseRule({ whenUnknown: "not-met" }),
      input(messages([])),
    );
    expect(result.placement).toBe("quarantined");
  });

  it("is unknown when no message was seen, as on a profile page", () => {
    const result = evaluateContactRule(phraseRule(), input());
    expect(phraseCondition(result)).toMatchObject({
      state: "unknown",
      source: "none",
    });
  });

  it("turns around with not", () => {
    const result = evaluateContactRule(
      phraseRule({ negate: true }),
      input(messages(["blue heron"])),
    );
    expect(result.placement).toBe("quarantined");
  });

  it("collects the rule's phrases in normalized form", () => {
    expect(rulePhrases(phraseRule().root)).toEqual(new Set(["blue heron"]));
  });

  it("writes version 3 for a rule with a text condition", () => {
    expect(schemaVersionFor(phraseRule().root)).toBe(3);
    expect(schemaVersionFor(phraseRule({ negate: true }).root)).toBe(3);
    expect(contactRuleProblem(phraseRule())).toBeUndefined();
  });

  it.each([
    ["an older schema version", { ...phraseRule(), schemaVersion: 2 }],
    ["no text", phraseRule({ text: undefined })],
    ["empty text", phraseRule({ text: "" })],
    ["text with spaces at an end", phraseRule({ text: " heron" })],
    ["text that is too long", phraseRule({ text: "x".repeat(101) })],
    [
      "text on another condition",
      {
        ...rule([condition("verified", { text: "heron" })]),
        schemaVersion: 3,
      },
    ],
  ])("rejects %s", (_name, value) => {
    expect(contactRuleProblem(value)).toBeTypeOf("string");
  });

  it("accepts an emoji", () => {
    expect(contactRuleProblem(phraseRule({ text: "🦊" }))).toBeUndefined();
  });
});
