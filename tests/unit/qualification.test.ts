import { describe, expect, it } from "vitest";
import type { ProfileSnapshot } from "../../src/domain/types";
import {
  isStrictIsoDate,
  mergeProfileFacts,
  newestSnapshot,
  UNKNOWN_FACTS,
} from "../../src/qualification/facts";
import {
  accountAgeDays,
  accountAgeRange,
  evaluateQualification,
  OUTCOME_TEXT,
  type QualificationCriteria,
} from "../../src/qualification/engine";

const NOW = new Date("2026-09-22T00:00:00.000Z");
const strict: QualificationCriteria = {
  requireVerification: true,
  minimumPhotoCount: 3,
  minimumAccountAgeDays: 30,
};

const snapshot = (
  overrides: Partial<ProfileSnapshot> = {},
): ProfileSnapshot => ({
  id: "snapshot-1",
  accountId: "account-a",
  memberId: "member-1",
  capturedAt: "2026-09-01T00:00:00.000Z",
  verification: "unknown",
  photoCount: "unknown",
  profileWordCount: "unknown",
  joinedAt: "unknown",
  createdAt: "2026-09-01T00:00:00.000Z",
  updatedAt: "2026-09-01T00:00:00.000Z",
  ...overrides,
});

describe("M1 profile fact merge", () => {
  it("prefers a fact observed now over the cached one", () => {
    const merged = mergeProfileFacts(
      { photoCount: 5 },
      snapshot({ photoCount: 2 }),
    );
    expect(merged.facts.photoCount).toBe(5);
    expect(merged.sources.photoCount).toBe("observed");
  });

  it("fills a fact the current surface did not render from the cache", () => {
    const merged = mergeProfileFacts(
      { photoCount: "unknown" },
      snapshot({ photoCount: 2 }),
    );
    expect(merged.facts.photoCount).toBe(2);
    expect(merged.sources.photoCount).toBe("cached");
  });

  it("leaves a fact unknown when neither source has it", () => {
    const merged = mergeProfileFacts({}, snapshot());
    expect(merged.facts).toEqual(UNKNOWN_FACTS);
    expect(Object.values(merged.sources).every((s) => s === "none")).toBe(true);
  });

  it("never lets a cached value overwrite an observed false", () => {
    const merged = mergeProfileFacts(
      { verification: false },
      snapshot({ verification: true }),
    );
    expect(merged.facts.verification).toBe(false);
  });

  it("picks the newest snapshot deterministically", () => {
    const older = snapshot({ id: "a", capturedAt: "2026-09-01T00:00:00.000Z" });
    const newer = snapshot({ id: "b", capturedAt: "2026-09-10T00:00:00.000Z" });
    expect(newestSnapshot([older, newer])?.id).toBe("b");
    expect(newestSnapshot([newer, older])?.id).toBe("b");
    expect(newestSnapshot([])).toBeUndefined();
  });
});

describe("M1 qualification engine", () => {
  it("qualifies when every configured criterion passes", () => {
    const result = evaluateQualification({
      facts: {
        verification: true,
        personallyKnown: "unknown",
        joinedWindow: "unknown",
        photoCount: 4,
        profileWordCount: 120,
        joinedAt: "2026-01-01T00:00:00.000Z",
      },
      criteria: strict,
      now: NOW,
    });
    expect(result.outcome).toBe("qualified");
    expect(result.placement).toBe("qualified");
    expect(result.criteria.every((c) => c.state === "pass")).toBe(true);
  });

  it("treats an unknown fact as Needs Review, never as a failure", () => {
    const result = evaluateQualification({
      facts: { ...UNKNOWN_FACTS, verification: true, photoCount: 4 },
      criteria: strict,
      now: NOW,
    });
    expect(result.outcome).toBe("partial-information");
    expect(result.placement).toBe("needs-review");
    expect(result.criteria.some((c) => c.state === "fail")).toBe(false);
    expect(result.reasons).toEqual([
      "Account age in days is unknown, so it was not counted for or against.",
    ]);
  });

  it("quarantines on an explicit failure even when other facts are unknown", () => {
    const result = evaluateQualification({
      facts: { ...UNKNOWN_FACTS, photoCount: 1 },
      criteria: strict,
      now: NOW,
    });
    expect(result.outcome).toBe("does-not-meet-rule");
    expect(result.placement).toBe("quarantined");
    expect(result.reasons).toEqual(["Photo count is 1, below the required 3."]);
  });

  it("evaluates only the criteria that are configured", () => {
    const result = evaluateQualification({
      facts: { ...UNKNOWN_FACTS, photoCount: 1 },
      criteria: { minimumProfileWordCount: 10 },
      now: NOW,
    });
    expect(result.criteria.map((c) => c.name)).toEqual(["profileWordCount"]);
    expect(result.outcome).toBe("partial-information");
  });

  it("says so when no criteria are configured", () => {
    const result = evaluateQualification({
      facts: UNKNOWN_FACTS,
      criteria: {},
      now: NOW,
    });
    expect(result.outcome).toBe("qualified");
    expect(result.reasons).toEqual([
      "No qualification criteria are configured, so every sender qualifies.",
    ]);
  });

  it("reports the source of each evaluated fact", () => {
    const merged = mergeProfileFacts(
      { photoCount: 4 },
      snapshot({ verification: true }),
    );
    const result = evaluateQualification({
      facts: merged.facts,
      sources: merged.sources,
      criteria: { minimumPhotoCount: 3, requireVerification: true },
      now: NOW,
    });
    expect(
      Object.fromEntries(result.criteria.map((c) => [c.name, c.source])),
    ).toEqual({ photoCount: "observed", verification: "cached" });
  });

  it("offers no numeric score, only the three documented states", () => {
    expect(Object.values(OUTCOME_TEXT)).toEqual([
      "Qualified",
      "Partial information",
      "Does not meet rule",
    ]);
    const result = evaluateQualification({
      facts: UNKNOWN_FACTS,
      criteria: strict,
      now: NOW,
    });
    expect(result).not.toHaveProperty("score");
    expect(JSON.stringify(result)).not.toMatch(/%/);
  });

  it("computes account age and refuses an unusable join date", () => {
    expect(accountAgeDays("2026-09-12T00:00:00.000Z", NOW)).toBe(10);
    expect(accountAgeDays("unknown", NOW)).toBe("unknown");
    expect(accountAgeDays("not a date", NOW)).toBe("unknown");
    // A future join date is an extraction error, so it is unknown rather
    // than a failed minimum (build plan Section 8).
    expect(accountAgeDays("2026-10-01T00:00:00.000Z", NOW)).toBe("unknown");
    const result = evaluateQualification({
      facts: { ...UNKNOWN_FACTS, joinedAt: "2026-10-01T00:00:00.000Z" },
      criteria: { minimumAccountAgeDays: 1 },
      now: NOW,
    });
    expect(result.outcome).toBe("partial-information");
  });

  it("treats a date that Date.parse would repair as unknown", () => {
    for (const joinedAt of [
      "2026-02-30",
      "2026-01-01junk",
      "2026-13-01T00:00:00Z",
      "2026-01-01T24:00:00Z",
      "1 March 2026",
    ]) {
      expect(isStrictIsoDate(joinedAt)).toBe(false);
      expect(accountAgeDays(joinedAt, NOW)).toBe("unknown");
      expect(mergeProfileFacts({ joinedAt }).facts.joinedAt).toBe("unknown");
    }
    for (const joinedAt of [
      "2024-02-29",
      "2026-03-01T01:00:00+02:00",
      "2026-03-01T00:30:00.123Z",
    ])
      expect(isStrictIsoDate(joinedAt)).toBe(true);
  });

  it("treats a malformed or unsafe count as not observed", () => {
    for (const photoCount of [-1, 2.5, Number.NaN, 2 ** 60])
      expect(mergeProfileFacts({ photoCount }).facts.photoCount).toBe(
        "unknown",
      );
    const merged = mergeProfileFacts(
      { photoCount: -1, verification: "yes" as never },
      snapshot({ photoCount: 4, verification: true }),
    );
    expect(merged.facts).toMatchObject({ photoCount: 4, verification: true });
    expect(merged.sources.photoCount).toBe("cached");
  });

  it("orders snapshots by instant, not by text", () => {
    // 23:00 UTC on 28 February: older, but it sorts after the other as text.
    const older = snapshot({
      id: "older",
      capturedAt: "2026-03-01T01:00:00+02:00",
    });
    const newer = snapshot({ id: "newer", capturedAt: "2026-03-01T00:30:00Z" });
    expect(newestSnapshot([older, newer])?.id).toBe("newer");
  });

  it("evaluates personally known as its own criterion", () => {
    const evaluate = (personallyKnown: boolean | "unknown") =>
      evaluateQualification({
        facts: { ...UNKNOWN_FACTS, verification: true, personallyKnown },
        criteria: { requireVerification: true, requirePersonallyKnown: true },
        now: NOW,
      });
    expect(evaluate(true).outcome).toBe("qualified");
    expect(evaluate(false)).toMatchObject({
      outcome: "does-not-meet-rule",
      reasons: [
        "You have not marked this member as personally known, which the rule requires.",
      ],
    });
    expect(evaluate("unknown").outcome).toBe("partial-information");
    // Verification alone does not satisfy the personally-known criterion.
    expect(
      evaluate("unknown").criteria.map(({ name, state }) => [name, state]),
    ).toEqual([
      ["verification", "pass"],
      ["personallyKnown", "unknown"],
    ]);
  });

  it("never fills personally known from a cached snapshot", () => {
    const merged = mergeProfileFacts({}, {
      ...snapshot(),
      personallyKnown: true,
    } as never);
    expect(merged.facts.personallyKnown).toBe("unknown");
    expect(merged.sources.personallyKnown).toBe("none");
    expect(mergeProfileFacts({ personallyKnown: true }).sources).toMatchObject({
      personallyKnown: "observed",
    });
  });

  it("passes, fails or leaves unknown an account age from a join window", () => {
    // NOW is 2026-09-22. The window is 300 to 330 days before it.
    const window = {
      earliest: "2025-10-27T00:00:00.000Z",
      latest: "2025-11-26T00:00:00.000Z",
    };
    expect(accountAgeRange(window, NOW)).toEqual({ min: 300, max: 330 });
    const state = (minimum: number) =>
      evaluateQualification({
        facts: { ...UNKNOWN_FACTS, joinedWindow: window },
        criteria: { minimumAccountAgeDays: minimum },
        now: NOW,
      }).criteria[0]?.state;
    expect(state(300)).toBe("pass");
    expect(state(331)).toBe("fail");
    expect(state(315)).toBe("unknown");
    expect(accountAgeRange("unknown", NOW)).toBe("unknown");
    expect(
      accountAgeRange({ earliest: "2027-01-01", latest: "2027-02-01" }, NOW),
    ).toBe("unknown");
  });

  it("prefers an exact join date over a window", () => {
    const result = evaluateQualification({
      facts: {
        ...UNKNOWN_FACTS,
        joinedAt: "2026-09-12T00:00:00.000Z",
        joinedWindow: {
          earliest: "2020-01-01T00:00:00.000Z",
          latest: "2020-02-01T00:00:00.000Z",
        },
      },
      criteria: { minimumAccountAgeDays: 30 },
      now: NOW,
    });
    expect(result.criteria[0]?.state).toBe("fail");
  });

  it("fills a join window from a cached snapshot", () => {
    const merged = mergeProfileFacts(
      {},
      snapshot({
        joinedEarliest: "2025-10-27T00:00:00.000Z",
        joinedLatest: "2025-11-26T00:00:00.000Z",
      }),
    );
    expect(merged.facts.joinedWindow).toEqual({
      earliest: "2025-10-27T00:00:00.000Z",
      latest: "2025-11-26T00:00:00.000Z",
    });
    expect(merged.sources.joinedWindow).toBe("cached");
    // An inverted window is unusable.
    expect(
      mergeProfileFacts({
        joinedWindow: {
          earliest: "2025-12-01T00:00:00.000Z",
          latest: "2025-11-01T00:00:00.000Z",
        },
      }).facts.joinedWindow,
    ).toBe("unknown");
  });

  it("keeps the unknown default immutable", () => {
    expect(Object.isFrozen(UNKNOWN_FACTS)).toBe(true);
  });
});
