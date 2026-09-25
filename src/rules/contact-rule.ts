import type { CriterionState, TriagePlacement } from "../domain/types";
import {
  evaluateCriterion,
  type SingleCriterion,
} from "../qualification/engine";
import type { FactSource, ProfileFacts } from "../qualification/facts";
import type { TrustScore } from "../trust/trust-score";
import { MAX_PHRASE_LENGTH, normalizePhrase } from "./message-phrase";

/**
 * The contact rule (M4), in the schema V1 will use, so per-audience rules and
 * nested groups need no migration (build plan Section 11). The MVP stores one
 * global rule with audience `all`, and its builder edits the two-box shape
 * PRD Section 11.5 describes.
 */
export const CONTACT_RULE_SCHEMA_VERSION = 3;

/**
 * The versions JoyFox reads. Version 2 adds `negate` (ADR 0012). Version 3
 * adds the "First message contains" condition and its `text` (ADR 0013). A
 * rule is written with the lowest version that holds it, so a JoyFox build
 * from before a version can still read a rule that does not use it.
 */
export type ContactRuleSchemaVersion =
  | 1
  | 2
  | typeof CONTACT_RULE_SCHEMA_VERSION;

/** What a condition counts as when JoyFox cannot see its fact. */
export type UnknownHandling = "needs-review" | "met" | "not-met";

export type ConditionKind =
  | "verified"
  | "personallyKnown"
  | "minimumPhotos"
  | "minimumProfileWords"
  | "minimumAccountAgeDays"
  | "notTemplateSpam"
  | "minimumTrustScore"
  | "firstMessageContains";

/** Kinds that take a numeric threshold in `value`. */
export const NUMERIC_CONDITION_KINDS: ReadonlySet<ConditionKind> = new Set([
  "minimumPhotos",
  "minimumProfileWords",
  "minimumAccountAgeDays",
  "minimumTrustScore",
]);

/** Kinds that take a word, phrase or emoji in `text`. */
export const TEXT_CONDITION_KINDS: ReadonlySet<ConditionKind> = new Set([
  "firstMessageContains",
]);

export const CONDITION_KINDS: readonly ConditionKind[] = [
  "verified",
  "personallyKnown",
  "minimumPhotos",
  "minimumProfileWords",
  "minimumAccountAgeDays",
  "notTemplateSpam",
  "minimumTrustScore",
  "firstMessageContains",
];

/** Plain-language names, shared by the page UI and the rule builder. */
export const CONDITION_TEXT: Record<ConditionKind, string> = {
  verified: "Verified by JoyClub",
  personallyKnown: "Personally known",
  minimumPhotos: "Minimum photos",
  minimumProfileWords: "Minimum profile words",
  minimumAccountAgeDays: "Minimum account age in days",
  notTemplateSpam: "Not flagged as template spam",
  minimumTrustScore: "Minimum local trust score",
  firstMessageContains: "First message contains",
};

export interface RuleCondition {
  type: "condition";
  kind: ConditionKind;
  /** The threshold, for numeric kinds only. */
  value?: number;
  /**
   * The word, phrase or emoji, for text kinds only, as the user typed it
   * (trimmed). Matching normalizes it (`normalizePhrase`). Schema version 3.
   */
  text?: string;
  whenUnknown: UnknownHandling;
  /**
   * "not": the condition is met when its fact fails. For a number this means
   * "fewer than". An unknown fact still counts as `whenUnknown`, never the
   * opposite. Schema version 2 only.
   */
  negate?: true;
}

export interface ConditionGroup {
  type: "group";
  /** Shown as "All of these conditions" or "Any of these conditions". */
  match: "all" | "any";
  children: RuleNode[];
}

export type RuleNode = RuleCondition | ConditionGroup;

/** V1 applies a rule per sender profile type; the MVP uses `all` only. */
export type RuleAudience = "all" | "man" | "woman" | "couple";

/** The placement for a sender who does not meet the rule. */
export type FailPlacement = Exclude<TriagePlacement, "qualified">;

export interface ContactRuleDefinition {
  schemaVersion: ContactRuleSchemaVersion;
  audience: RuleAudience;
  /** Off means JoyFox shows no triage UI and changes nothing on the page. */
  enabled: boolean;
  /**
   * PRD Section 11.2's default placement: where a sender goes who does not
   * meet the conditions. A sender who meets them is Qualified.
   */
  defaultPlacement: FailPlacement;
  root: ConditionGroup;
}

/** Limits that keep a stored rule small and its evaluation bounded. */
export const RULE_LIMITS = Object.freeze({
  maxDepth: 4,
  maxChildren: 32,
  maxValue: 100_000,
  minTrustValue: -1_000,
  maxTextLength: MAX_PHRASE_LENGTH,
});

/**
 * Why a value is not a valid rule definition, or `undefined` when it is. A
 * string rather than an exception, so storage validation and the options page
 * can both use it.
 */
export function contactRuleProblem(value: unknown): string | undefined {
  if (!value || typeof value !== "object") return "The rule must be an object";
  const rule = value as Record<string, unknown>;
  if (![1, 2, 3].includes(rule.schemaVersion as number))
    return "Unsupported rule schema version";
  if (!["all", "man", "woman", "couple"].includes(rule.audience as string))
    return "Unsupported rule audience";
  if (typeof rule.enabled !== "boolean") return "enabled must be a boolean";
  if (
    !["needs-review", "quarantined"].includes(rule.defaultPlacement as string)
  )
    return "defaultPlacement must be needs-review or quarantined";
  return nodeProblem(rule.root, 1, rule.schemaVersion, true);
}

/** The lowest schema version that can hold `root`. */
export function schemaVersionFor(
  root: ConditionGroup,
): ContactRuleSchemaVersion {
  const uses = (test: (condition: RuleCondition) => boolean) => {
    const walk = (node: RuleNode): boolean =>
      node.type === "group" ? node.children.some(walk) : test(node);
    return walk(root);
  };
  if (uses((condition) => TEXT_CONDITION_KINDS.has(condition.kind))) return 3;
  return uses((condition) => condition.negate === true) ? 2 : 1;
}

/** The normalized phrases a rule's text conditions look for. */
export function rulePhrases(root: ConditionGroup): Set<string> {
  const phrases = new Set<string>();
  const walk = (node: RuleNode): void => {
    if (node.type === "group") node.children.forEach(walk);
    else if (TEXT_CONDITION_KINDS.has(node.kind) && node.text !== undefined) {
      const phrase = normalizePhrase(node.text);
      if (phrase.length > 0) phrases.add(phrase);
    }
  };
  walk(root);
  return phrases;
}

function nodeProblem(
  value: unknown,
  depth: number,
  version: unknown,
  mustBeGroup = false,
): string | undefined {
  if (!value || typeof value !== "object")
    return "A rule node must be an object";
  const node = value as Record<string, unknown>;
  if (node.type === "group") {
    if (depth > RULE_LIMITS.maxDepth) return "The rule is nested too deeply";
    if (node.match !== "all" && node.match !== "any")
      return "A group must match all or any";
    if (!Array.isArray(node.children)) return "A group needs a children array";
    if (node.children.length > RULE_LIMITS.maxChildren)
      return "A group has too many conditions";
    for (const child of node.children) {
      const problem = nodeProblem(child, depth + 1, version);
      if (problem) return problem;
    }
    return undefined;
  }
  if (mustBeGroup) return "The rule root must be a group";
  if (node.type !== "condition") return "Unknown rule node type";
  if (!CONDITION_KINDS.includes(node.kind as ConditionKind))
    return "Unknown condition kind";
  if (!["needs-review", "met", "not-met"].includes(node.whenUnknown as string))
    return "whenUnknown has an unsupported value";
  if (node.negate !== undefined && (node.negate !== true || version === 1))
    return "negate must be true, and needs rule schema version 2";
  const kind = node.kind as ConditionKind;
  if (TEXT_CONDITION_KINDS.has(kind)) {
    if (version === 1 || version === 2)
      return "This condition needs rule schema version 3";
    const text = node.text;
    if (
      typeof text !== "string" ||
      text !== text.trim() ||
      text.length > RULE_LIMITS.maxTextLength ||
      normalizePhrase(text).length === 0
    )
      return `A condition text must be 1 to ${RULE_LIMITS.maxTextLength} characters, with no space at either end`;
  } else if (node.text !== undefined) return "This condition takes no text";
  if (NUMERIC_CONDITION_KINDS.has(kind)) {
    const minimum =
      kind === "minimumTrustScore" ? RULE_LIMITS.minTrustValue : 0;
    if (
      typeof node.value !== "number" ||
      !Number.isSafeInteger(node.value) ||
      node.value < minimum ||
      node.value > RULE_LIMITS.maxValue
    )
      return "A condition threshold must be a whole number in range";
  } else if (node.value !== undefined)
    return "This condition takes no threshold";
  return undefined;
}

/**
 * The sender's template spam status as triage sees it. `overridden` is the
 * user's own "not spam" correction for this sender (M3).
 */
export type SpamStatus = "flagged" | "not-flagged" | "overridden" | "unknown";

export type ConditionOutcome = "met" | "not-met" | "needs-review";

export interface EvaluatedCondition {
  kind: ConditionKind;
  /** Set when the rule turns this condition around ("not"). */
  negate?: true;
  /** What the fact showed, before the unknown handling applied. */
  state: CriterionState;
  /** What the condition counted as in the rule. */
  outcome: ConditionOutcome;
  /** Plain-language reason, safe to show and safe to log. */
  reason: string;
  source: FactSource;
}

export interface RuleEvaluation {
  placement: TriagePlacement;
  reasons: string[];
  evaluatedConditions: EvaluatedCondition[];
}

/**
 * What JoyFox saw of this sender's messages, for "First message contains".
 * Only the inbox shows a message, and only the latest one (ADR 0013).
 */
export interface MessageEvidence {
  /** Whether the page shows this sender's latest message now. */
  previewShown: boolean;
  /** Normalized rule phrases the message on screen contains. */
  seenNow: ReadonlySet<string>;
  /** Normalized rule phrases an earlier message was seen to contain. */
  seenBefore: ReadonlySet<string>;
}

export interface RuleInput {
  facts: ProfileFacts;
  sources?: Partial<Record<keyof ProfileFacts, FactSource>>;
  spam: SpamStatus;
  /** `unknown` when the user logged nothing about this member. */
  trust: TrustScore | "unknown";
  /** Left out when no message from this sender is known. */
  messages?: MessageEvidence;
  now?: Date;
}

export const PLACEMENT_TEXT: Record<TriagePlacement, string> = {
  qualified: "Qualified",
  "needs-review": "Needs Review",
  quarantined: "Quarantined",
};

const CRITERION_FOR: Partial<
  Record<ConditionKind, (value: number) => SingleCriterion>
> = {
  verified: () => ({ name: "verification" }),
  personallyKnown: () => ({ name: "personallyKnown" }),
  minimumPhotos: (minimum) => ({ name: "photoCount", minimum }),
  minimumProfileWords: (minimum) => ({ name: "profileWordCount", minimum }),
  minimumAccountAgeDays: (minimumDays) => ({ name: "accountAge", minimumDays }),
};

/** A fact's raw state and reason, before unknown handling. */
function readCondition(
  condition: RuleCondition,
  input: RuleInput,
  now: Date,
): { state: CriterionState; reason: string; source: FactSource } {
  const criterion = CRITERION_FOR[condition.kind];
  if (criterion) {
    const result = evaluateCriterion(
      criterion(condition.value ?? 0),
      input.facts,
      input.sources,
      now,
    );
    return {
      state: result.state,
      reason: result.reason,
      source: result.source,
    };
  }
  if (condition.kind === "notTemplateSpam")
    switch (input.spam) {
      case "flagged":
        return {
          state: "fail",
          reason: "A message from this sender looks like a copied template.",
          source: "observed",
        };
      case "not-flagged":
        return {
          state: "pass",
          reason: "No message from this sender looks like a copied template.",
          source: "observed",
        };
      case "overridden":
        return {
          state: "pass",
          reason: "You marked this sender as not spam.",
          source: "cached",
        };
      case "unknown":
        return {
          state: "unknown",
          reason:
            "JoyFox has not checked this sender's messages for templates, so spam status is unknown.",
          source: "none",
        };
    }
  if (condition.kind === "firstMessageContains")
    return readMessagePhrase(condition.text ?? "", input.messages);
  // minimumTrustScore
  const minimum = condition.value ?? 0;
  if (input.trust === "unknown")
    return {
      state: "unknown",
      reason:
        "You have logged nothing about this member, so the local trust score is unknown.",
      source: "none",
    };
  return input.trust.score >= minimum
    ? {
        state: "pass",
        reason: `Your local trust score is ${input.trust.score}, at or above the required ${minimum}.`,
        source: "cached",
      }
    : {
        state: "fail",
        reason: `Your local trust score is ${input.trust.score}, below the required ${minimum}.`,
        source: "cached",
      };
}

/**
 * A phrase seen in a message is met. A message without it is unknown, never
 * failed: the inbox shows only the latest message, so the first one may
 * still have held it. The condition's unknown choice then decides.
 */
function readMessagePhrase(
  text: string,
  messages: MessageEvidence | undefined,
): { state: CriterionState; reason: string; source: FactSource } {
  const phrase = normalizePhrase(text);
  if (messages?.seenNow.has(phrase))
    return {
      state: "pass",
      reason: `The latest message from this sender contains "${text}".`,
      source: "observed",
    };
  if (messages?.seenBefore.has(phrase))
    return {
      state: "pass",
      reason: `An earlier message from this sender, seen in your inbox, contains "${text}".`,
      source: "cached",
    };
  if (messages?.previewShown)
    return {
      state: "unknown",
      reason: `The latest message from this sender does not contain "${text}". The inbox shows only the latest message, so JoyFox cannot see if the first message contained it.`,
      source: "observed",
    };
  return {
    state: "unknown",
    reason: `JoyFox has not seen a message from this sender that contains "${text}". Only the inbox shows messages to JoyFox.`,
    source: "none",
  };
}

const UNKNOWN_SUFFIX: Record<UnknownHandling, string> = {
  "needs-review": " Your rule sends unknown values to Needs Review.",
  met: " Your rule counts an unknown value as met.",
  "not-met": " Your rule counts an unknown value as not met.",
};

function evaluateCondition(
  condition: RuleCondition,
  input: RuleInput,
  now: Date,
): EvaluatedCondition {
  const read = readCondition(condition, input, now);
  const negate = condition.negate === true;
  const base = { kind: condition.kind, ...(negate ? { negate } : {}) };
  if (read.state !== "unknown") {
    const met = (read.state === "pass") !== negate;
    return {
      ...base,
      state: read.state,
      outcome: met ? "met" : "not-met",
      reason: negate
        ? `${read.reason} Your rule says "not ${CONDITION_TEXT[condition.kind]}", so this counts as ${met ? "met" : "not met"}.`
        : read.reason,
      source: read.source,
    };
  }
  return {
    ...base,
    state: "unknown",
    outcome: condition.whenUnknown,
    reason: read.reason + UNKNOWN_SUFFIX[condition.whenUnknown],
    source: read.source,
  };
}

interface GroupResult {
  outcome: ConditionOutcome;
  /** Only the reasons that caused this outcome. */
  reasons: string[];
}

/**
 * Three-valued group logic. "All": any unmet condition fails the group, else
 * any condition needing review makes the group need review. "Any": any met
 * condition passes the group, else any needing review makes it need review.
 * An empty group is met, so a rule without conditions qualifies everyone.
 *
 * The reasons follow the cause through the tree: a failed "All" reports its
 * unmet children; a met "Any" reports only its first met child, since that
 * child alone was enough. A condition inside a group that did not decide the
 * outcome is never listed as a reason (it still appears in the full list).
 */
function evaluateGroup(
  group: ConditionGroup,
  input: RuleInput,
  now: Date,
  collected: EvaluatedCondition[],
  numberRules = false,
): GroupResult {
  if (group.children.length === 0) return { outcome: "met", reasons: [] };
  const results = group.children.map((child, index): GroupResult => {
    if (child.type === "group") {
      const result = evaluateGroup(child, input, now, collected);
      if (!numberRules) return result;
      return {
        ...result,
        reasons: result.reasons.map((reason) => `Rule ${index + 1}: ${reason}`),
      };
    }
    const evaluated = evaluateCondition(child, input, now);
    collected.push(evaluated);
    return { outcome: evaluated.outcome, reasons: [evaluated.reason] };
  });
  const having = (outcome: ConditionOutcome) =>
    results.filter((result) => result.outcome === outcome);
  const combine = (outcome: ConditionOutcome): GroupResult => ({
    outcome,
    reasons: having(outcome).flatMap((result) => result.reasons),
  });
  if (group.match === "all") {
    if (having("not-met").length > 0) return combine("not-met");
    if (having("needs-review").length > 0) return combine("needs-review");
    return combine("met");
  }
  const [firstMet] = having("met");
  if (firstMet) return firstMet;
  if (having("needs-review").length > 0) return combine("needs-review");
  return combine("not-met");
}

/**
 * Evaluate the contact rule for one sender.
 *
 * Pure by contract (build plan Section 11): it reads no DOM and no storage.
 * The caller supplies merged profile facts, the spam status and the trust
 * score, and receives the placement, the reasons and every evaluated
 * condition. An unknown fact never fails a condition on its own: what it
 * counts as is the user's explicit per-condition choice.
 */
export function evaluateContactRule(
  rule: ContactRuleDefinition,
  input: RuleInput,
): RuleEvaluation {
  const now = input.now ?? new Date();
  const evaluatedConditions: EvaluatedCondition[] = [];
  // The advanced editor's rules are the root's groups, numbered as the
  // options page shows them, so a reason can name the rule that decided.
  const { children } = rule.root;
  const numberRules =
    children.length > 1 && children.every((child) => child.type === "group");
  const { outcome, reasons } = evaluateGroup(
    rule.root,
    input,
    now,
    evaluatedConditions,
    numberRules,
  );
  const placement: TriagePlacement =
    outcome === "met"
      ? "qualified"
      : outcome === "needs-review"
        ? "needs-review"
        : rule.defaultPlacement;
  const headline =
    outcome === "met"
      ? reasons.length === 0
        ? "Your contact rule has no required conditions, so every sender qualifies."
        : "This sender meets your contact rule."
      : outcome === "needs-review"
        ? "JoyFox could not decide, because some information is unknown."
        : `This sender does not meet your contact rule, so it goes to ${PLACEMENT_TEXT[rule.defaultPlacement]}.`;
  return {
    placement,
    reasons: [headline, ...reasons],
    evaluatedConditions,
  };
}
