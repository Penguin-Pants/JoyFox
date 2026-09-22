import { describe, expect, it } from "vitest";
import type { ProfileSnapshot } from "../../src/domain/types";
import { ExtensionError } from "../../src/errors";
import {
  accountAgeDays,
  isStrictIsoDate,
  defaultPlacement,
  evaluateQualification,
  mergeProfileFacts,
  UNKNOWN_FACTS,
  type QualificationCriteria,
} from "../../src/qualification/qualification-engine";

const NOW = "2026-06-01T00:00:00.000Z";
const MEMBER = "synthetic-member-1";
const ALL: QualificationCriteria = {
  requireVerification: true,
  minimumPhotoCount: 3,
  minimumProfileWordCount: 50,
  minimumAccountAgeDays: 30,
};

function snapshot(
  overrides: Partial<ProfileSnapshot> & { id: string; capturedAt: string },
): ProfileSnapshot {
  return {
    accountId: "account-a",
    memberId: MEMBER,
    verification: "unknown",
    photoCount: "unknown",
    profileWordCount: "unknown",
    joinedAt: "unknown",
    createdAt: overrides.capturedAt,
    updatedAt: overrides.capturedAt,
    ...overrides,
  };
}

const observedOnly = (facts: Parameters<typeof mergeProfileFacts>[1]) =>
  mergeProfileFacts(MEMBER, facts, []);

describe("M1 qualification engine", () => {
  it("qualifies a member who meets every configured criterion", () => {
    const result = evaluateQualification(
      observedOnly({
        verification: true,
        photoCount: 3,
        profileWordCount: 50,
        joinedAt: "2026-05-02T00:00:00.000Z",
      }),
      ALL,
      NOW,
    );
    expect(result.overall).toBe("qualified");
    expect(result.criteria.map((c) => c.state)).toEqual([
      "pass",
      "pass",
      "pass",
      "pass",
    ]);
  });

  it("reports every missing fact as unknown and never as a pass or fail", () => {
    const result = evaluateQualification(observedOnly(UNKNOWN_FACTS), ALL, NOW);
    expect(result.overall).toBe("partial");
    expect(result.criteria.every((c) => c.state === "unknown")).toBe(true);
    expect(result.criteria.every((c) => c.source.kind === "none")).toBe(true);
  });

  it("treats an unsafe integer count as unknown", () => {
    expect(observedOnly({ photoCount: 2 ** 60 }).photoCount.value).toBe(
      "unknown",
    );
    expect(observedOnly({ photoCount: 2.5 }).photoCount.value).toBe("unknown");
  });

  it("treats a malformed extraction as unknown", () => {
    const result = evaluateQualification(
      observedOnly({
        verification: "yes" as never,
        photoCount: -1,
        profileWordCount: Number.MAX_SAFE_INTEGER + 1,
        joinedAt: "not a date",
      }),
      ALL,
      NOW,
    );
    expect(result.criteria.map((c) => c.state)).toEqual([
      "unknown",
      "unknown",
      "unknown",
      "unknown",
    ]);
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
      expect(observedOnly({ joinedAt }).joinedAt.value).toBe("unknown");
    }
    for (const joinedAt of [
      "2024-02-29",
      "2026-03-01T01:00:00+02:00",
      "2026-03-01T00:30:00.123Z",
    ])
      expect(isStrictIsoDate(joinedAt)).toBe(true);
  });

  it("lets one explicit failure outrank unknown facts", () => {
    const result = evaluateQualification(
      observedOnly({ verification: false }),
      ALL,
      NOW,
    );
    expect(result.overall).toBe("does-not-meet");
    expect(result.criteria[0]).toMatchObject({
      criterion: "verification",
      state: "fail",
      reason: "The member is not verified; verification is required.",
    });
  });

  it("explains each threshold in plain words", () => {
    const result = evaluateQualification(
      observedOnly({ photoCount: 2 }),
      { minimumPhotoCount: 3 },
      NOW,
    );
    expect(result.criteria[0]?.reason).toBe(
      "The photo count is 2; the minimum is 3.",
    );
  });

  it("evaluates nothing and qualifies under the Open preset", () => {
    expect(evaluateQualification(observedOnly({}), {}, NOW)).toEqual({
      overall: "qualified",
      criteria: [],
    });
  });

  it("does not evaluate verification when it is not required", () => {
    const result = evaluateQualification(
      observedOnly({ verification: false }),
      { requireVerification: false },
      NOW,
    );
    expect(result).toEqual({ overall: "qualified", criteria: [] });
  });

  it("rejects thresholds that would pass every sender", () => {
    for (const criteria of [
      { minimumPhotoCount: -1 },
      { minimumAccountAgeDays: Number.NaN },
      { minimumProfileWordCount: Number.POSITIVE_INFINITY },
      { requireVerification: "yes" as never },
    ])
      expect(() =>
        evaluateQualification(observedOnly({}), criteria, NOW),
      ).toThrow(ExtensionError);
  });

  it("computes account age in whole days and refuses a future join date", () => {
    expect(accountAgeDays("2026-05-02T00:00:00.000Z", NOW)).toBe(30);
    expect(accountAgeDays("2026-05-02T00:00:01.000Z", NOW)).toBe(29);
    expect(accountAgeDays("2026-07-01T00:00:00.000Z", NOW)).toBe("unknown");
    const result = evaluateQualification(
      observedOnly({ joinedAt: "2027-01-01T00:00:00.000Z" }),
      { minimumAccountAgeDays: 1 },
      NOW,
    );
    expect(result.criteria[0]?.state).toBe("unknown");
  });

  it("fills gaps from the newest snapshot that knows the fact", () => {
    const merged = mergeProfileFacts(MEMBER, { verification: true }, [
      snapshot({
        id: "old",
        capturedAt: "2026-01-01T00:00:00Z",
        photoCount: 1,
      }),
      snapshot({
        id: "new",
        capturedAt: "2026-03-01T00:00:00Z",
        photoCount: 4,
        verification: false,
      }),
      snapshot({
        id: "newest",
        capturedAt: "2026-04-01T00:00:00Z",
        profileWordCount: 80,
      }),
    ]);
    expect(merged.verification).toEqual({
      value: true,
      source: { kind: "observed" },
    });
    expect(merged.photoCount).toEqual({
      value: 4,
      source: {
        kind: "snapshot",
        snapshotId: "new",
        capturedAt: "2026-03-01T00:00:00Z",
      },
    });
    expect(merged.profileWordCount.value).toBe(80);
    expect(merged.joinedAt).toEqual({
      value: "unknown",
      source: { kind: "none" },
    });
  });

  it("orders snapshots by instant, not by text", () => {
    const merged = mergeProfileFacts(MEMBER, {}, [
      // 23:00 UTC on 28 February: older, but sorts after the other as text.
      snapshot({
        id: "older",
        capturedAt: "2026-03-01T01:00:00+02:00",
        photoCount: 1,
      }),
      snapshot({
        id: "newer",
        capturedAt: "2026-03-01T00:30:00Z",
        photoCount: 6,
      }),
    ]);
    expect(merged.photoCount.value).toBe(6);
  });

  it("ignores snapshots that belong to another member", () => {
    const merged = mergeProfileFacts(MEMBER, {}, [
      snapshot({
        id: "other",
        capturedAt: "2026-03-01T00:00:00Z",
        memberId: "someone-else",
        verification: true,
      }),
    ]);
    expect(merged.verification.value).toBe("unknown");
  });

  it("maps results to the documented F9 default placement", () => {
    expect(defaultPlacement("qualified")).toBe("qualified");
    expect(defaultPlacement("partial")).toBe("needs-review");
    expect(defaultPlacement("does-not-meet")).toBe("quarantined");
  });
});

describe("M1 unknown facts default", () => {
  it("cannot be mutated by a caller", () => {
    expect(Object.isFrozen(UNKNOWN_FACTS)).toBe(true);
  });
});
