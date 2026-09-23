import { describe, expect, it } from "vitest";
import { contactRuleProblem } from "../../src/rules/contact-rule";
import {
  fromBuilderForm,
  toBuilderForm,
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
