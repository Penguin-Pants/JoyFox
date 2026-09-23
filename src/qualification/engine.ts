import type { CriterionState, TriagePlacement } from "../domain/types";
import {
  isJoinWindow,
  isStrictIsoDate,
  type FactSource,
  type JoinWindow,
  type ProfileFacts,
} from "./facts";

/**
 * The criteria the MVP evaluates. They translate PRD Section 7.2 directly:
 * verification status, profile completeness (photos, word count) and account
 * maturity (join date). Each is optional, because the user configures which
 * ones their rule uses. No threshold is hardcoded: the PRD states these as
 * user-configured values and gives only an illustrative example.
 */
export interface QualificationCriteria {
  /** JoyClub's own verification ("geprüft"). */
  requireVerification?: boolean;
  /**
   * The logged-in user has met this member ("persönlich bekannt"). Its own
   * criterion, separate from and stricter than verification.
   */
  requirePersonallyKnown?: boolean;
  minimumPhotoCount?: number;
  minimumProfileWordCount?: number;
  minimumAccountAgeDays?: number;
}

export type CriterionName =
  | "verification"
  | "personallyKnown"
  | "photoCount"
  | "profileWordCount"
  | "accountAge";

export interface EvaluatedCriterion {
  name: CriterionName;
  state: CriterionState;
  /** Plain-language reason, safe to show and safe to log. */
  reason: string;
  source: FactSource;
}

/**
 * The three display states from the build plan, Section 8. Deliberately not a
 * number: no scoring formula is defined, so presenting a percentage would
 * imply precision the inputs do not have.
 */
export type QualificationOutcome =
  | "qualified"
  | "partial-information"
  | "does-not-meet-rule";

export interface QualificationResult {
  outcome: QualificationOutcome;
  placement: TriagePlacement;
  criteria: EvaluatedCriterion[];
  /** One line per criterion that drove the outcome, in evaluation order. */
  reasons: string[];
}

const OUTCOME_PLACEMENT: Record<QualificationOutcome, TriagePlacement> = {
  qualified: "qualified",
  // F9's decision: a partial result is Needs Review, never a failure.
  "partial-information": "needs-review",
  "does-not-meet-rule": "quarantined",
};

export const OUTCOME_TEXT: Record<QualificationOutcome, string> = {
  qualified: "Qualified",
  "partial-information": "Partial information",
  "does-not-meet-rule": "Does not meet rule",
};

function numericCriterion(
  name: CriterionName,
  label: string,
  value: number | "unknown",
  minimum: number,
  source: FactSource,
): EvaluatedCriterion {
  if (value === "unknown")
    return {
      name,
      state: "unknown",
      reason: `${label} is unknown, so it was not counted for or against.`,
      source,
    };
  return value >= minimum
    ? {
        name,
        state: "pass",
        reason: `${label} is ${value}, at or above the required ${minimum}.`,
        source,
      }
    : {
        name,
        state: "fail",
        reason: `${label} is ${value}, below the required ${minimum}.`,
        source,
      };
}

/**
 * Whole days between the join date and the reference time, or `unknown` when
 * the join date is absent, not a strict ISO date, or in the future. A future
 * join date is an extraction error, and build plan Section 8 requires
 * extraction failures to appear as Unknown rather than as a failed criterion.
 */
export function accountAgeDays(
  joinedAt: string | "unknown",
  now: Date,
): number | "unknown" {
  if (joinedAt === "unknown" || !isStrictIsoDate(joinedAt)) return "unknown";
  const elapsed = now.getTime() - Date.parse(joinedAt);
  if (!Number.isFinite(elapsed) || elapsed < 0) return "unknown";
  return Math.floor(elapsed / (24 * 60 * 60 * 1000));
}

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * The possible account age in whole days for a join window: the minimum from
 * the latest possible join, the maximum from the earliest. `unknown` when the
 * window is unusable or any part of it lies in the future.
 */
export function accountAgeRange(
  window: JoinWindow | "unknown",
  now: Date,
): { min: number; max: number } | "unknown" {
  if (!isJoinWindow(window)) return "unknown";
  const min = Math.floor((now.getTime() - Date.parse(window.latest)) / DAY_MS);
  const max = Math.floor(
    (now.getTime() - Date.parse(window.earliest)) / DAY_MS,
  );
  // Any possible join in the future makes the window unusable, like a future
  // exact date: an extraction or clock error, never a basis for a failure.
  if (!Number.isFinite(min) || !Number.isFinite(max) || min < 0)
    return "unknown";
  return { min, max };
}

/**
 * Account age against a minimum, from an exact join date when one is known,
 * otherwise from a join window. A window passes only when even its youngest
 * possible age meets the minimum, and fails only when even its oldest does
 * not; in between it is unknown, so a rounded duration never decides alone.
 */
function accountAgeCriterion(
  facts: ProfileFacts,
  minimum: number,
  now: Date,
  sourceOf: (field: keyof ProfileFacts) => FactSource,
): EvaluatedCriterion {
  const exact = accountAgeDays(facts.joinedAt, now);
  if (exact !== "unknown" || facts.joinedWindow === "unknown")
    return numericCriterion(
      "accountAge",
      "Account age in days",
      exact,
      minimum,
      sourceOf("joinedAt"),
    );
  const source = sourceOf("joinedWindow");
  const range = accountAgeRange(facts.joinedWindow, now);
  if (range === "unknown")
    return numericCriterion(
      "accountAge",
      "Account age in days",
      "unknown",
      minimum,
      source,
    );
  const span = `between ${range.min} and ${range.max} days`;
  if (range.min >= minimum)
    return {
      name: "accountAge",
      state: "pass",
      reason: `Account age is ${span}, at or above the required ${minimum}.`,
      source,
    };
  if (range.max < minimum)
    return {
      name: "accountAge",
      state: "fail",
      reason: `Account age is ${span}, below the required ${minimum}.`,
      source,
    };
  return {
    name: "accountAge",
    state: "unknown",
    reason: `Account age is ${span}, which is too coarse to compare with the required ${minimum}, so it was not counted for or against.`,
    source,
  };
}

/** One criterion with its parameter, as a contact rule condition names it. */
export type SingleCriterion =
  | { name: "verification" }
  | { name: "personallyKnown" }
  | { name: "photoCount"; minimum: number }
  | { name: "profileWordCount"; minimum: number }
  | { name: "accountAge"; minimumDays: number };

/**
 * Evaluate one criterion against merged facts. Pure, like the whole engine:
 * the contact rule (M4) calls it once per condition so a criterion reads the
 * same way on a badge and in a rule explanation.
 */
export function evaluateCriterion(
  criterion: SingleCriterion,
  facts: ProfileFacts,
  sources: Partial<Record<keyof ProfileFacts, FactSource>> = {},
  now: Date = new Date(),
): EvaluatedCriterion {
  const sourceOf = (field: keyof ProfileFacts): FactSource =>
    sources[field] ?? "none";
  switch (criterion.name) {
    case "verification": {
      const source = sourceOf("verification");
      if (facts.verification === "unknown")
        return {
          name: "verification",
          state: "unknown",
          reason:
            "Verification status is unknown, so it was not counted for or against.",
          source,
        };
      return {
        name: "verification",
        state: facts.verification ? "pass" : "fail",
        reason: facts.verification
          ? "The profile is verified, as the rule requires."
          : "The profile is not verified, which the rule requires.",
        source,
      };
    }
    case "personallyKnown": {
      const source = sourceOf("personallyKnown");
      return facts.personallyKnown === "unknown"
        ? {
            name: "personallyKnown",
            state: "unknown",
            reason:
              "Whether you know this member personally is unknown, so it was not counted for or against.",
            source,
          }
        : {
            name: "personallyKnown",
            state: facts.personallyKnown ? "pass" : "fail",
            reason: facts.personallyKnown
              ? "You marked this member as personally known, as the rule requires."
              : "You have not marked this member as personally known, which the rule requires.",
            source,
          };
    }
    case "photoCount":
      return numericCriterion(
        "photoCount",
        "Photo count",
        facts.photoCount,
        criterion.minimum,
        sourceOf("photoCount"),
      );
    case "profileWordCount":
      return numericCriterion(
        "profileWordCount",
        "Profile word count",
        facts.profileWordCount,
        criterion.minimum,
        sourceOf("profileWordCount"),
      );
    case "accountAge":
      return accountAgeCriterion(facts, criterion.minimumDays, now, sourceOf);
  }
}

/**
 * Evaluate the configured criteria against merged profile facts.
 *
 * Pure by contract: it reads no DOM and no storage, exactly as the build plan
 * requires of rule evaluation, so the same inputs always give the same result
 * and the engine is testable without a browser.
 *
 * The outcome follows F9's decision. A missing fact is `unknown`, `unknown` is
 * never a failure, and a result with any unknown is Needs Review unless a
 * criterion explicitly failed, which warrants Quarantine.
 */
export function evaluateQualification(input: {
  facts: ProfileFacts;
  criteria: QualificationCriteria;
  sources?: Partial<Record<keyof ProfileFacts, FactSource>>;
  now?: Date;
}): QualificationResult {
  const { facts, criteria } = input;
  const now = input.now ?? new Date();
  const selected: SingleCriterion[] = [];
  if (criteria.requireVerification) selected.push({ name: "verification" });
  if (criteria.requirePersonallyKnown)
    selected.push({ name: "personallyKnown" });
  if (criteria.minimumPhotoCount !== undefined)
    selected.push({ name: "photoCount", minimum: criteria.minimumPhotoCount });
  if (criteria.minimumProfileWordCount !== undefined)
    selected.push({
      name: "profileWordCount",
      minimum: criteria.minimumProfileWordCount,
    });
  if (criteria.minimumAccountAgeDays !== undefined)
    selected.push({
      name: "accountAge",
      minimumDays: criteria.minimumAccountAgeDays,
    });
  const criteriaResults = selected.map((criterion) =>
    evaluateCriterion(criterion, facts, input.sources, now),
  );

  const outcome: QualificationOutcome = criteriaResults.some(
    (criterion) => criterion.state === "fail",
  )
    ? "does-not-meet-rule"
    : criteriaResults.some((criterion) => criterion.state === "unknown")
      ? "partial-information"
      : "qualified";

  // An empty rule qualifies everyone. Saying so out loud beats a badge with no
  // stated reason, which would look like the score simply failed to run.
  if (criteriaResults.length === 0)
    return {
      outcome: "qualified",
      placement: OUTCOME_PLACEMENT.qualified,
      criteria: [],
      reasons: [
        "No qualification criteria are configured, so every sender qualifies.",
      ],
    };

  return {
    outcome,
    placement: OUTCOME_PLACEMENT[outcome],
    criteria: criteriaResults,
    reasons: criteriaResults
      .filter((criterion) =>
        outcome === "does-not-meet-rule"
          ? criterion.state === "fail"
          : outcome === "partial-information"
            ? criterion.state === "unknown"
            : true,
      )
      .map((criterion) => criterion.reason),
  };
}
