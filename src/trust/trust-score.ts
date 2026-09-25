import type { TrustSignal } from "../domain/types";
import { message, type Message } from "../i18n/message";
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
  reason: Message;
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

/** Catalog key of the note that says what the score is based on. */
export const TRUST_SCOPE_NOTE = "trust.scopeNote";

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
      reason: message("trust.reason.positive", { count: positive }),
    });
  if (negative > 0)
    contributions.push({
      points: -negative,
      reason: message("trust.reason.negative", { count: negative }),
    });
  if (neutral > 0)
    contributions.push({
      points: 0,
      reason: message("trust.reason.neutral", { count: neutral }),
    });
  if (input.personallyKnown === true)
    contributions.push({
      points: 1,
      reason: message("trust.reason.personallyKnown"),
    });
  if (input.spam === "flagged")
    contributions.push({
      points: -1,
      reason: message("trust.reason.spamFlagged"),
    });
  if (contributions.length === 0) return "unknown";
  return {
    score: contributions.reduce((sum, item) => sum + item.points, 0),
    contributions,
    logged: positive + negative + neutral,
  };
}
