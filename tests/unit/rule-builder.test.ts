import { describe, expect, it } from "vitest";
import { contactRuleProblem } from "../../src/rules/contact-rule";
import {
  advancedToBuilder,
  builderToAdvanced,
  fromAdvancedForm,
  fromBuilderForm,
  toAdvancedForm,
  toBuilderForm,
  type AdvancedForm,
  type BuilderForm,
} from "../../src/rules/rule-builder";

const form: BuilderForm = {
  enabled: true,
  defaultPlacement: "quarantined",
  all: {
    verified: { whenUnknown: "needs-review" },
    minimumPhotos: { value: 3, whenUnknown: "met" },
  },
  any: { personallyKnown: { whenUnknown: "not-met" } },
};

describe("rule builder form", () => {
  it("round-trips the two-box form through a valid stored rule", () => {
    const rule = fromBuilderForm(form);
    expect(contactRuleProblem(rule)).toBeUndefined();
    expect(toBuilderForm(rule)).toEqual(form);
  });

  it("gives numeric kinds a value and yes/no kinds none", () => {
    const rule = fromBuilderForm(form);
    const all = rule.root.children[0];
    if (all?.type !== "group") throw new Error("expected the All box");
    expect(all.children).toEqual([
      { type: "condition", kind: "verified", whenUnknown: "needs-review" },
      {
        type: "condition",
        kind: "minimumPhotos",
        value: 3,
        whenUnknown: "met",
      },
    ]);
  });

  it("reads a flat All group", () => {
    expect(
      toBuilderForm({
        schemaVersion: 1,
        audience: "all",
        enabled: false,
        defaultPlacement: "needs-review",
        root: {
          type: "group",
          match: "all",
          children: [
            { type: "condition", kind: "verified", whenUnknown: "met" },
          ],
        },
      }),
    ).toEqual({
      enabled: false,
      defaultPlacement: "needs-review",
      all: { verified: { whenUnknown: "met" } },
      any: {},
    });
  });

  it("refuses shapes it cannot show, so the builder never overwrites them", () => {
    const rule = fromBuilderForm(form);
    expect(toBuilderForm({ ...rule, audience: "couple" })).toBeUndefined();
    expect(
      toBuilderForm({
        ...rule,
        root: {
          type: "group",
          match: "all",
          children: [{ type: "group", match: "any", children: [] }],
        },
      }),
    ).toBeUndefined();
    expect(
      toBuilderForm({
        ...rule,
        root: {
          type: "group",
          match: "all",
          children: [
            { type: "condition", kind: "verified", whenUnknown: "met" },
            { type: "condition", kind: "verified", whenUnknown: "not-met" },
          ],
        },
      }),
    ).toBeUndefined();
  });
});

/** The owner's rule: personally known, or verified with 180 days and 3 photos. */
const owner: AdvancedForm = {
  enabled: true,
  defaultPlacement: "quarantined",
  match: "any",
  rules: [
    {
      match: "all",
      conditions: { personallyKnown: { whenUnknown: "not-met" } },
    },
    {
      match: "all",
      conditions: {
        verified: { whenUnknown: "needs-review" },
        minimumPhotos: { value: 3, whenUnknown: "needs-review" },
        minimumAccountAgeDays: { value: 180, whenUnknown: "needs-review" },
      },
    },
  ],
};

describe("advanced form (ADR 0012)", () => {
  it("round-trips rules of conditions as groups, version 1 without not", () => {
    const rule = fromAdvancedForm(owner);
    expect(contactRuleProblem(rule)).toBeUndefined();
    expect(rule.schemaVersion).toBe(1);
    expect(rule.root.children.every((c) => c.type === "group")).toBe(true);
    expect(toAdvancedForm(rule)).toEqual(owner);
    // Several groups do not read as two boxes, so the page opens Advanced.
    expect(toBuilderForm(rule)).toBeUndefined();
  });

  it("stores not as version 2, and the two boxes refuse it", () => {
    const negated: AdvancedForm = {
      ...owner,
      rules: [
        {
          match: "all",
          conditions: {
            minimumPhotos: { value: 3, whenUnknown: "met", negate: true },
          },
        },
      ],
    };
    const rule = fromAdvancedForm(negated);
    expect(rule.schemaVersion).toBe(2);
    expect(contactRuleProblem(rule)).toBeUndefined();
    expect(toAdvancedForm(rule)).toEqual(negated);
    expect(toBuilderForm(rule)).toBeUndefined();
    expect(advancedToBuilder(negated)).toMatch(/not/);
  });

  it("leaves out a rule without conditions", () => {
    const rule = fromAdvancedForm({
      ...owner,
      rules: [...owner.rules, { match: "any", conditions: {} }],
    });
    expect(rule.root.children).toHaveLength(2);
  });

  it("shows the owner's rule as two boxes with the same meaning", () => {
    expect(advancedToBuilder(owner)).toEqual({
      enabled: true,
      defaultPlacement: "quarantined",
      all: {
        verified: { whenUnknown: "needs-review" },
        minimumPhotos: { value: 3, whenUnknown: "needs-review" },
        minimumAccountAgeDays: { value: 180, whenUnknown: "needs-review" },
      },
      any: { personallyKnown: { whenUnknown: "not-met" } },
    });
  });

  it("keeps an OR-only rule out of an empty ALL box", () => {
    const form = advancedToBuilder({
      ...owner,
      rules: [
        {
          match: "any",
          conditions: {
            verified: { whenUnknown: "met" },
            personallyKnown: { whenUnknown: "met" },
          },
        },
      ],
    });
    expect(form).toMatchObject({
      all: { verified: { whenUnknown: "met" } },
      any: { personallyKnown: { whenUnknown: "met" } },
    });
  });

  it("says why the two boxes cannot show a rule", () => {
    expect(advancedToBuilder({ ...owner, match: "all" })).toMatch(/ALL/);
    expect(
      advancedToBuilder({
        ...owner,
        rules: [owner.rules[1]!, owner.rules[1]!],
      }),
    ).toMatch(/more than one rule/);
    expect(
      advancedToBuilder({
        ...owner,
        rules: [owner.rules[1]!, owner.rules[0]!, owner.rules[0]!],
      }),
    ).toMatch(/appears in more than one rule/);
  });

  it("reads the two boxes into rules without an empty ALL rule", () => {
    expect(builderToAdvanced(form)).toEqual({
      enabled: true,
      defaultPlacement: "quarantined",
      match: "any",
      rules: [
        { match: "all", conditions: form.all },
        { match: "all", conditions: form.any },
      ],
    });
    expect(builderToAdvanced({ ...form, all: {}, any: {} }).rules).toEqual([]);
  });

  it("refuses rules nested deeper than conditions", () => {
    const rule = fromAdvancedForm(owner);
    expect(
      toAdvancedForm({
        ...rule,
        root: {
          type: "group",
          match: "any",
          children: [
            {
              type: "group",
              match: "all",
              children: [{ type: "group", match: "any", children: [] }],
            },
          ],
        },
      }),
    ).toBeUndefined();
  });
});
