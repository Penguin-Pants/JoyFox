import type { PlainKey } from "../i18n/catalog/en";
import type { ConditionKind } from "./contact-rule";
import type { BoxEntry, BuilderForm } from "./rule-builder";

/**
 * The completeness level of "Complete profiles only" and "High-trust
 * members" (D8, ADR 0016). V1-10's incomplete-profile badge uses the same
 * level.
 */
export const COMPLETE_PROFILE = { photos: 3, words: 50 } as const;

/** The account age of "High-trust members", in days (D8, ADR 0016). */
export const HIGH_TRUST_ACCOUNT_DAYS = 180;

/** The PRD 11.3 presets, in the order the options page offers them. */
export const RULE_PRESET_IDS = [
  "open",
  "complete",
  "verified",
  "highTrust",
  "custom",
] as const;

export type RulePresetId = (typeof RULE_PRESET_IDS)[number];

export const PRESET_TEXT: Record<RulePresetId, PlainKey> = {
  open: "rule.preset.open",
  complete: "rule.preset.complete",
  verified: "rule.preset.verified",
  highTrust: "rule.preset.highTrust",
  custom: "rule.preset.custom",
};

/**
 * Each preset's conditions (ADR 0016). All go in the ALL box. Open and Custom
 * set none: Open because every sender qualifies, Custom because the user
 * picks the conditions. "High-trust members" has no trust-score condition,
 * since a first sender almost never has a local score.
 */
const PRESET_CONDITIONS: Record<
  RulePresetId,
  ReadonlyArray<readonly [ConditionKind, number?]>
> = {
  open: [],
  complete: [
    ["minimumPhotos", COMPLETE_PROFILE.photos],
    ["minimumProfileWords", COMPLETE_PROFILE.words],
  ],
  verified: [["verified"]],
  highTrust: [
    ["verified"],
    ["minimumPhotos", COMPLETE_PROFILE.photos],
    ["minimumProfileWords", COMPLETE_PROFILE.words],
    ["minimumAccountAgeDays", HIGH_TRUST_ACCOUNT_DAYS],
  ],
  custom: [],
};

export function isRulePresetId(value: string): value is RulePresetId {
  return (RULE_PRESET_IDS as readonly string[]).includes(value);
}

/**
 * A preset as the two-box form. It sets only the conditions: whether triage
 * is on and where a failing sender goes stay as the user chose. A fact
 * JoyFox cannot see sends the sender to Needs Review, as a condition the
 * user ticks does by default.
 */
export function presetForm(
  id: RulePresetId,
  base: Pick<BuilderForm, "enabled" | "defaultPlacement">,
): BuilderForm {
  const all: Partial<Record<ConditionKind, BoxEntry>> = {};
  for (const [kind, value] of PRESET_CONDITIONS[id])
    all[kind] = {
      ...(value !== undefined ? { value } : {}),
      whenUnknown: "needs-review",
    };
  return {
    enabled: base.enabled,
    defaultPlacement: base.defaultPlacement,
    all,
    any: {},
  };
}
