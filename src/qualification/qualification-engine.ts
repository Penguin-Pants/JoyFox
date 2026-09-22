import type {
  CriterionState,
  ProfileSnapshot,
  TriagePlacement,
} from "../domain/types";
import { ExtensionError } from "../errors";

/**
 * Pure M1 qualification logic. Nothing here reads the DOM or storage: callers
 * pass observed facts and cached snapshots in, and receive an explained result.
 */

export type ProfileFactName =
  | "verification"
  | "photoCount"
  | "profileWordCount"
  | "joinedAt";

/**
 * One observation of the facts M1 scores. Every field accepts `unknown`
 * because a field hidden from the viewer, absent on the current surface, or
 * unreadable after a markup change must never be treated as a negative value.
 */
export interface ProfileFacts {
  verification: boolean | "unknown";
  photoCount: number | "unknown";
  profileWordCount: number | "unknown";
  joinedAt: string | "unknown";
}

/** Frozen, because callers spread it as a starting point and must not change it. */
export const UNKNOWN_FACTS: Readonly<ProfileFacts> = Object.freeze({
  verification: "unknown",
  photoCount: "unknown",
  profileWordCount: "unknown",
  joinedAt: "unknown",
});

export type FactSource =
  | { kind: "observed" }
  | { kind: "snapshot"; snapshotId: string; capturedAt: string }
  | { kind: "none" };

export interface MergedFact<T> {
  value: T | "unknown";
  source: FactSource;
}

export interface MergedProfileFacts {
  verification: MergedFact<boolean>;
  photoCount: MergedFact<number>;
  profileWordCount: MergedFact<number>;
  joinedAt: MergedFact<string>;
}

/**
 * The user's own bar. An absent criterion is not evaluated, so an empty object
 * is the PRD's "Open" preset (Section 11.3): nothing can fail.
 */
export interface QualificationCriteria {
  requireVerification?: boolean;
  minimumPhotoCount?: number;
  minimumProfileWordCount?: number;
  minimumAccountAgeDays?: number;
}

export type CriterionName =
  | "verification"
  | "photoCount"
  | "profileWordCount"
  | "accountAge";

export interface CriterionResult {
  criterion: CriterionName;
  state: CriterionState;
  /** Plain-language explanation for the expandable badge. */
  reason: string;
  source: FactSource;
}

/** The three overall displays from build plan Section 8. */
export type QualificationOverall = "qualified" | "partial" | "does-not-meet";

export interface QualificationResult {
  overall: QualificationOverall;
  criteria: CriterionResult[];
}

export const OVERALL_LABEL: Record<QualificationOverall, string> = {
  qualified: "Qualified",
  partial: "Partial information",
  "does-not-meet": "Does not meet rule",
};

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * A safe integer only: above `Number.MAX_SAFE_INTEGER` the extracted value may
 * already be rounded, so it cannot be trusted as a count.
 */
function isCount(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
}

function isThreshold(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0;
}

/**
 * Reject criteria that cannot be evaluated honestly. A negative or NaN
 * threshold would silently pass every sender, which is a false pass.
 */
export function validateCriteria(criteria: QualificationCriteria): void {
  if (
    criteria.requireVerification !== undefined &&
    typeof criteria.requireVerification !== "boolean"
  )
    throw new ExtensionError(
      "RuleEvaluationError",
      "requireVerification must be a boolean",
    );
  for (const field of [
    "minimumPhotoCount",
    "minimumProfileWordCount",
    "minimumAccountAgeDays",
  ] as const) {
    const value = criteria[field];
    if (value !== undefined && !isThreshold(value))
      throw new ExtensionError(
        "RuleEvaluationError",
        `${field} must be a non-negative finite number`,
      );
  }
}

const ISO_DATE =
  /^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2})(?::(\d{2})(?:\.\d{1,9})?)?(?:Z|[+-](\d{2}):(\d{2})))?$/;

/**
 * Accept only an ISO 8601 date or date-time with a real calendar date and
 * clock time. `Date.parse` alone repairs `2026-02-30` to 2 March and accepts
 * trailing text, which would turn an extraction error into a known fact.
 */
export function isStrictIsoDate(value: string): boolean {
  const match = ISO_DATE.exec(value);
  if (!match) return false;
  const [, y, m, d, hh, mm, ss, oh, om] = match;
  const year = Number(y);
  const month = Number(m);
  const day = Number(d);
  const calendar = new Date(Date.UTC(year, month - 1, day));
  if (
    calendar.getUTCFullYear() !== year ||
    calendar.getUTCMonth() !== month - 1 ||
    calendar.getUTCDate() !== day
  )
    return false;
  if (hh !== undefined && (Number(hh) > 23 || Number(mm) > 59)) return false;
  if (ss !== undefined && Number(ss) > 59) return false;
  if (oh !== undefined && (Number(oh) > 23 || Number(om) > 59)) return false;
  return Number.isFinite(Date.parse(value));
}

/**
 * Coerce an observation into known-or-unknown. A value of the wrong shape is
 * an extraction problem, so it becomes `unknown` rather than a guess.
 */
function sanitize(facts: Partial<ProfileFacts>): ProfileFacts {
  return {
    verification:
      typeof facts.verification === "boolean" ? facts.verification : "unknown",
    photoCount: isCount(facts.photoCount) ? facts.photoCount : "unknown",
    profileWordCount: isCount(facts.profileWordCount)
      ? facts.profileWordCount
      : "unknown",
    joinedAt:
      typeof facts.joinedAt === "string" && isStrictIsoDate(facts.joinedAt)
        ? facts.joinedAt
        : "unknown",
  };
}

/**
 * Compare instants, not strings: valid ISO dates with different offsets or
 * precision do not sort by time as text.
 */
export const newestSnapshotFirst = (
  a: Pick<ProfileSnapshot, "capturedAt" | "id">,
  b: Pick<ProfileSnapshot, "capturedAt" | "id">,
) =>
  Date.parse(b.capturedAt) - Date.parse(a.capturedAt) ||
  b.id.localeCompare(a.id);

/**
 * Merge what the current surface shows with cached snapshots of the same
 * member. A fact observed now wins. Otherwise the newest snapshot that knows
 * the fact supplies it, with its capture time kept so the UI can show age.
 * Snapshots for another member are ignored rather than trusted.
 */
export function mergeProfileFacts(
  memberId: string,
  observed: Partial<ProfileFacts>,
  snapshots: readonly ProfileSnapshot[],
): MergedProfileFacts {
  const current = sanitize(observed);
  const cached = snapshots
    .filter((snapshot) => snapshot.memberId === memberId)
    .sort(newestSnapshotFirst);

  function pick<K extends ProfileFactName>(
    field: K,
  ): MergedFact<Exclude<ProfileFacts[K], "unknown">> {
    type Known = Exclude<ProfileFacts[K], "unknown">;
    if (current[field] !== "unknown")
      return { value: current[field] as Known, source: { kind: "observed" } };
    for (const snapshot of cached) {
      const value = sanitize(snapshot)[field];
      if (value !== "unknown")
        return {
          value: value as Known,
          source: {
            kind: "snapshot",
            snapshotId: snapshot.id,
            capturedAt: snapshot.capturedAt,
          },
        };
    }
    return { value: "unknown", source: { kind: "none" } };
  }

  return {
    verification: pick("verification"),
    photoCount: pick("photoCount"),
    profileWordCount: pick("profileWordCount"),
    joinedAt: pick("joinedAt"),
  };
}

function minimumCriterion(
  criterion: CriterionName,
  fact: MergedFact<number>,
  minimum: number,
  noun: string,
): CriterionResult {
  if (fact.value === "unknown")
    return {
      criterion,
      state: "unknown",
      reason: `The ${noun} is not available, so this criterion is unknown.`,
      source: fact.source,
    };
  const passed = fact.value >= minimum;
  return {
    criterion,
    state: passed ? "pass" : "fail",
    reason: `The ${noun} is ${fact.value}; the minimum is ${minimum}.`,
    source: fact.source,
  };
}

/** Whole days between two instants, or `unknown` for a join date in the future. */
export function accountAgeDays(
  joinedAt: string,
  now: string,
): number | "unknown" {
  const elapsed = Date.parse(now) - Date.parse(joinedAt);
  if (!Number.isFinite(elapsed) || elapsed < 0) return "unknown";
  return Math.floor(elapsed / DAY_MS);
}

/**
 * Evaluate each configured criterion as pass, fail or unknown, then classify:
 * any fail gives "does-not-meet", otherwise any unknown gives "partial",
 * otherwise "qualified". Unknown never becomes a pass or a fail.
 */
export function evaluateQualification(
  facts: MergedProfileFacts,
  criteria: QualificationCriteria,
  now: string,
): QualificationResult {
  validateCriteria(criteria);
  const results: CriterionResult[] = [];

  if (criteria.requireVerification === true) {
    const fact = facts.verification;
    results.push(
      fact.value === "unknown"
        ? {
            criterion: "verification",
            state: "unknown",
            reason:
              "Verification status is not available, so this criterion is unknown.",
            source: fact.source,
          }
        : {
            criterion: "verification",
            state: fact.value ? "pass" : "fail",
            reason: fact.value
              ? "The member is verified."
              : "The member is not verified; verification is required.",
            source: fact.source,
          },
    );
  }

  if (criteria.minimumPhotoCount !== undefined)
    results.push(
      minimumCriterion(
        "photoCount",
        facts.photoCount,
        criteria.minimumPhotoCount,
        "photo count",
      ),
    );

  if (criteria.minimumProfileWordCount !== undefined)
    results.push(
      minimumCriterion(
        "profileWordCount",
        facts.profileWordCount,
        criteria.minimumProfileWordCount,
        "profile word count",
      ),
    );

  if (criteria.minimumAccountAgeDays !== undefined) {
    const joined = facts.joinedAt;
    const age =
      joined.value === "unknown"
        ? ("unknown" as const)
        : accountAgeDays(joined.value, now);
    results.push(
      minimumCriterion(
        "accountAge",
        { value: age, source: joined.source },
        criteria.minimumAccountAgeDays,
        "account age in days",
      ),
    );
  }

  const overall: QualificationOverall = results.some((r) => r.state === "fail")
    ? "does-not-meet"
    : results.some((r) => r.state === "unknown")
      ? "partial"
      : "qualified";
  return { overall, criteria: results };
}

/**
 * The documented F9 default (build plan Section 6, F9): missing information is
 * unknown, unknown is not a failure, and a partial result goes to Needs Review
 * unless an explicit failure warrants Quarantine. M2 and M4 own the final
 * placement; this mapping is the default they start from.
 */
export function defaultPlacement(
  overall: QualificationOverall,
): TriagePlacement {
  switch (overall) {
    case "qualified":
      return "qualified";
    case "partial":
      return "needs-review";
    case "does-not-meet":
      return "quarantined";
  }
}
