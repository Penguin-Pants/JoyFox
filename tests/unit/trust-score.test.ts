import { describe, expect, it } from "vitest";
import { computeTrustScore } from "../../src/trust/trust-score";

const signals = (...kinds: Array<"positive" | "negative" | "neutral">) =>
  kinds.map((kind) => ({ kind }));

describe("computeTrustScore", () => {
  it("is unknown with no history, never a neutral zero", () => {
    expect(
      computeTrustScore({
        signals: [],
        spam: "unknown",
        personallyKnown: "unknown",
      }),
    ).toBe("unknown");
  });

  it("counts +1 per positive, -1 per negative and 0 per neutral outcome", () => {
    const score = computeTrustScore({
      signals: signals("positive", "positive", "negative", "neutral"),
      spam: "not-flagged",
      personallyKnown: false,
    });
    expect(score).not.toBe("unknown");
    if (score === "unknown") return;
    expect(score.score).toBe(1);
    expect(score.contributions).toEqual([
      { points: 2, reason: "You logged 2 positive outcomes." },
      { points: -1, reason: "You logged 1 negative outcome." },
      { points: 0, reason: "You logged 1 neutral outcome, which count 0." },
    ]);
  });

  it("adds +1 for personally known and -1 for an open spam flag", () => {
    const score = computeTrustScore({
      signals: [],
      spam: "flagged",
      personallyKnown: true,
    });
    expect(score).toEqual({
      score: 0,
      contributions: [
        { points: 1, reason: "You marked this member as personally known." },
        {
          points: -1,
          reason: "A message from this member looks like a copied template.",
        },
      ],
    });
  });

  it("drops the spam point once the user marks the sender not spam", () => {
    const score = computeTrustScore({
      signals: signals("positive"),
      spam: "overridden",
      personallyKnown: "unknown",
    });
    expect(score !== "unknown" && score.score).toBe(1);
  });

  it("lists a contribution for every point, so the explanation adds up", () => {
    const score = computeTrustScore({
      signals: signals("negative", "negative", "positive"),
      spam: "flagged",
      personallyKnown: true,
    });
    if (score === "unknown") throw new Error("expected a score");
    expect(
      score.contributions.reduce((sum, item) => sum + item.points, 0),
    ).toBe(score.score);
  });
});
