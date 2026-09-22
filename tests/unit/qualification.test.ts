import { describe, expect, it } from "vitest";
import type { ProfileSnapshot } from "../../src/domain/types";
import {
  mergeProfileFacts,
  newestSnapshot,
  UNKNOWN_FACTS,
} from "../../src/qualification/facts";
import {
  accountAgeDays,
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
    // A join date in the future is an age below any minimum, not an error.
    expect(accountAgeDays("2026-10-01T00:00:00.000Z", NOW)).toBeLessThan(0);
  });
});
