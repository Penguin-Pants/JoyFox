import type { CriterionState, TriagePlacement } from "../domain/types";
import type { FactSource, ProfileFacts } from "./facts";

/**
 * The criteria the MVP evaluates. They translate PRD Section 7.2 directly:
 * verification status, profile completeness (photos, word count) and account
 * maturity (join date). Each is optional, because the user configures which
 * ones their rule uses. No threshold is hardcoded: the PRD states these as
 * user-configured values and gives only an illustrative example.
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
 * the join date is absent or unparseable. A future join date yields a negative
 * age rather than an error, which then simply fails a minimum.
 */
export function accountAgeDays(
  joinedAt: string | "unknown",
  now: Date,
): number | "unknown" {
  if (joinedAt === "unknown") return "unknown";
  const joined = Date.parse(joinedAt);
  if (!Number.isFinite(joined)) return "unknown";
  return Math.floor((now.getTime() - joined) / (24 * 60 * 60 * 1000));
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
  const sourceOf = (field: keyof ProfileFacts): FactSource =>
    input.sources?.[field] ?? "none";
  const criteriaResults: EvaluatedCriterion[] = [];

  if (criteria.requireVerification) {
    const source = sourceOf("verification");
    if (facts.verification === "unknown")
      criteriaResults.push({
        name: "verification",
        state: "unknown",
        reason:
          "Verification status is unknown, so it was not counted for or against.",
        source,
      });
    else
      criteriaResults.push({
        name: "verification",
        state: facts.verification ? "pass" : "fail",
        reason: facts.verification
          ? "The profile is verified, as the rule requires."
          : "The profile is not verified, which the rule requires.",
        source,
      });
  }

  if (criteria.minimumPhotoCount !== undefined)
    criteriaResults.push(
      numericCriterion(
        "photoCount",
        "Photo count",
        facts.photoCount,
        criteria.minimumPhotoCount,
        sourceOf("photoCount"),
      ),
    );

  if (criteria.minimumProfileWordCount !== undefined)
    criteriaResults.push(
      numericCriterion(
        "profileWordCount",
        "Profile word count",
        facts.profileWordCount,
        criteria.minimumProfileWordCount,
        sourceOf("profileWordCount"),
      ),
    );

  if (criteria.minimumAccountAgeDays !== undefined)
    criteriaResults.push(
      numericCriterion(
        "accountAge",
        "Account age in days",
        accountAgeDays(facts.joinedAt, now),
        criteria.minimumAccountAgeDays,
        sourceOf("joinedAt"),
      ),
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
