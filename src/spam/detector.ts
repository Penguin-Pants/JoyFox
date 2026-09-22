import { normalizeMessage, normalizedWordCount } from "./normalize";
import { defaultSimilarityEngine, type SimilarityEngine } from "./similarity";

export interface PriorMessage {
  id: string;
  memberId: string;
  normalizedText: string;
}

export interface KnownPhrase {
  id: string;
  phrase: string;
}

export interface SpamDetectionOptions {
  /**
   * Messages shorter than this many words are never flagged. A short opener
   * matches many other short openers by chance, and flagging those would make
   * the feature untrustworthy.
   */
  minimumWordCount: number;
  /** Similarity at or above this against a prior message counts as a match. */
  duplicateThreshold: number;
  /** Similarity at or above this against a known phrase counts as a match. */
  phraseThreshold: number;
}

/**
 * Provisional defaults. The build plan, Section 30, keeps "exact acceptable
 * triage false-positive threshold" an open decision, so these are starting
 * points to be tuned against a real inbox, not settled values. They are
 * configurable for exactly that reason and are recorded in
 * `docs/known-limitations.md`.
 */
export const DEFAULT_SPAM_OPTIONS: SpamDetectionOptions = {
  minimumWordCount: 8,
  duplicateThreshold: 0.85,
  phraseThreshold: 0.9,
};

export type SpamFindingKind =
  | "duplicate-message"
  | "known-phrase"
  | "below-minimum-length"
  | "sender-override"
  | "no-match";

export interface SpamFinding {
  kind: SpamFindingKind;
  /** Plain-language explanation, with no message text in it. */
  detail: string;
  similarity?: number;
  priorMessageId?: string;
  priorMemberId?: string;
  phraseId?: string;
}

export interface SpamDetectionResult {
  flagged: boolean;
  findings: SpamFinding[];
  /** The `detail` lines, in order, for direct display. */
  explanation: string[];
  engine: string;
}

function result(
  flagged: boolean,
  findings: SpamFinding[],
  engine: string,
): SpamDetectionResult {
  return {
    flagged,
    findings,
    explanation: findings.map((finding) => finding.detail),
    engine,
  };
}

/**
 * Decide whether a message looks like a pasted template.
 *
 * Pure: it reads no DOM and no storage, so the same inputs always give the
 * same verdict. Persistence and DOM reading belong to the caller.
 *
 * A sender override always wins, and it is reported rather than applied
 * silently, so the user can see that their own earlier correction is why this
 * message is unflagged.
 */
export function detectTemplateSpam(input: {
  text: string;
  priorMessages?: readonly PriorMessage[];
  knownPhrases?: readonly KnownPhrase[];
  senderOverridden?: boolean;
  options?: Partial<SpamDetectionOptions>;
  engine?: SimilarityEngine;
}): SpamDetectionResult {
  const engine = input.engine ?? defaultSimilarityEngine;
  const options = { ...DEFAULT_SPAM_OPTIONS, ...input.options };
  if (input.senderOverridden)
    return result(
      false,
      [
        {
          kind: "sender-override",
          detail:
            "You marked this sender as not spam, so their messages are never flagged.",
        },
      ],
      engine.name,
    );

  const normalized = normalizeMessage(input.text);
  const words = normalizedWordCount(normalized);
  if (words < options.minimumWordCount)
    return result(
      false,
      [
        {
          kind: "below-minimum-length",
          detail: `The message has ${words} words, below the ${options.minimumWordCount} needed before template matching runs.`,
        },
      ],
      engine.name,
    );

  const findings: SpamFinding[] = [];

  let best: { prior: PriorMessage; similarity: number } | undefined;
  for (const prior of input.priorMessages ?? []) {
    const similarity = engine.score(normalized, prior.normalizedText);
    if (
      similarity >= options.duplicateThreshold &&
      similarity > (best?.similarity ?? 0)
    )
      best = { prior, similarity };
  }
  if (best)
    findings.push({
      kind: "duplicate-message",
      detail: `This message closely matches an earlier message you received (${Math.round(best.similarity * 100)}% similar).`,
      similarity: best.similarity,
      priorMessageId: best.prior.id,
      priorMemberId: best.prior.memberId,
    });

  for (const known of input.knownPhrases ?? []) {
    const phrase = normalizeMessage(known.phrase);
    if (phrase.length === 0) continue;
    if (normalized.includes(phrase)) {
      findings.push({
        kind: "known-phrase",
        detail: "The message contains a phrase from your known-template list.",
        similarity: 1,
        phraseId: known.id,
      });
      continue;
    }
    const similarity = engine.score(normalized, phrase);
    if (similarity >= options.phraseThreshold)
      findings.push({
        kind: "known-phrase",
        detail: `The message closely matches a phrase from your known-template list (${Math.round(similarity * 100)}% similar).`,
        similarity,
        phraseId: known.id,
      });
  }

  return findings.length > 0
    ? result(true, findings, engine.name)
    : result(
        false,
        [
          {
            kind: "no-match",
            detail:
              "The message matched no earlier message and no known template phrase.",
          },
        ],
        engine.name,
      );
}
