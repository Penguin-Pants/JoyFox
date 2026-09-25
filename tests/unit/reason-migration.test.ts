import { describe, expect, it } from "vitest";
import { migrateReasons } from "../../src/storage/reason-migration";

const legacy = (text: string) => ({ key: "legacy.text", params: { text } });
const moved = (placement: string) => ({
  key: "triage.reason.userMoved",
  params: { placement: { key: `placement.${placement}` } },
});

describe("schema version 4 reason migration", () => {
  it("translates only the exact sentence written for the record's placement", () => {
    expect(
      migrateReasons(
        ["You moved this sender to Needs Review."],
        "needs-review",
      ),
    ).toEqual([moved("needs-review")]);
    expect(
      migrateReasons(["You moved this sender to Qualified."], "qualified"),
    ).toEqual([moved("qualified")]);
  });

  it("keeps any other text verbatim, even when it looks similar", () => {
    for (const [text, placement] of [
      ["You moved this sender to a custom queue.", "quarantined"],
      // Written for another placement than the record holds now.
      ["You moved this sender to Qualified.", "quarantined"],
      ["you moved this sender to quarantined.", "quarantined"],
      ["You moved this sender to Quarantined.", "unknown"],
    ])
      expect(migrateReasons([text], placement)).toEqual([legacy(text!)]);
  });

  it("leaves values that are not strings for validation to judge", () => {
    expect(migrateReasons("not a list", "qualified")).toBe("not a list");
    expect(migrateReasons([7], "qualified")).toEqual([7]);
  });
});
