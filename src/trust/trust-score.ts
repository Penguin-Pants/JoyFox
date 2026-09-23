import type { TrustSignal } from "../domain/types";
import type { SpamStatus } from "../rules/contact-rule";

/**
 * The basic local trust score (M6), on the project owner's decision of
 * 2026-09-23: a simple point count, where every point is listed.
 *
 * - Each outcome the user logged counts +1 (positive), -1 (negative) or 0
 *   (neutral).
 * - An open template-spam flag counts -1. A "not spam" correction removes it.
 * - "Persönlich bekannt" (personally known) counts +1.
 *
 * It answers "what have I observed about this member", never "does this
 * member meet my rule" (qualification), and it is not a community reputation:
 * nothing here comes from other JoyClub members.
 */
export interface TrustContribution {
  points: number;
  reason: string;
}

export interface TrustScore {
  score: number;
  contributions: TrustContribution[];
  /** How many outcomes the user logged, so the UI offers undo only then. */
  logged: number;
}

export interface TrustInput {
  signals: readonly Pick<TrustSignal, "kind">[];
  spam: SpamStatus;
  personallyKnown: boolean | "unknown";
}

export const TRUST_SCOPE_NOTE =
  "Based only on what you logged and saw in this browser. It is not a JoyClub or community rating.";

const plural = (count: number, word: string) =>
  `${count} ${word}${count === 1 ? "" : "s"}`;

/**
 * The score, or `unknown` when nothing contributes: with no history, zero
 * would read as a neutral judgment the user never made.
 */
export function computeTrustScore(input: TrustInput): TrustScore | "unknown" {
  const contributions: TrustContribution[] = [];
  const count = (kind: TrustSignal["kind"]) =>
    input.signals.filter((signal) => signal.kind === kind).length;
  const positive = count("positive");
  const negative = count("negative");
  const neutral = count("neutral");
  if (positive > 0)
    contributions.push({
      points: positive,
      reason: `You logged ${plural(positive, "positive outcome")}.`,
    });
  if (negative > 0)
    contributions.push({
      points: -negative,
      reason: `You logged ${plural(negative, "negative outcome")}.`,
    });
  if (neutral > 0)
    contributions.push({
      points: 0,
      reason: `You logged ${plural(neutral, "neutral outcome")}, which count 0.`,
    });
  if (input.personallyKnown === true)
    contributions.push({
      points: 1,
      reason: "You marked this member as personally known.",
    });
  if (input.spam === "flagged")
    contributions.push({
      points: -1,
      reason: "A message from this member looks like a copied template.",
    });
  if (contributions.length === 0) return "unknown";
  return {
    score: contributions.reduce((sum, item) => sum + item.points, 0),
    contributions,
    logged: positive + negative + neutral,
  };
}
