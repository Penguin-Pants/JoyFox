/**
 * Pure, deterministic M3 template detector. No DOM, storage or network access,
 * and no AI (build plan Section 10). Triage depends only on the
 * `TemplateClassifier` interface, so a later classifier can replace this one.
 */
import { ExtensionError } from "../errors";

export interface DetectorSettings {
  /** Messages with fewer normalized characters are never flagged. */
  minimumMessageLength: number;
  /** Jaccard similarity to one prior message that counts as a template. */
  priorMessageThreshold: number;
  /** Share of a phrase's word pairs found in the message that counts as a match. */
  phraseThreshold: number;
}

/**
 * Starting values chosen by this implementation, not measured from JoyClub.
 * The acceptable false-positive threshold is an open decision (Section 30), so
 * every value is a setting rather than a constant.
 */
export const DEFAULT_DETECTOR_SETTINGS: DetectorSettings = {
  minimumMessageLength: 40,
  // One substituted name breaks two word pairs on each side, so a 16-word copy
  // scores about 0.78. 0.7 catches that; unrelated text shares far fewer pairs.
  priorMessageThreshold: 0.7,
  phraseThreshold: 0.8,
};

export interface PriorMessage {
  /** A local reference only. The prior text is never echoed in a reason. */
  id: string;
  text: string;
}

export interface PhraseEntry {
  id: string;
  phrase: string;
}

export type TemplateMatch =
  | { kind: "prior-message"; priorMessageId: string; similarity: number }
  | { kind: "phrase"; phraseId: string; phrase: string; similarity: number };

export type TemplateVerdict =
  | { status: "flagged"; matches: TemplateMatch[]; reasons: string[] }
  | { status: "clear"; reasons: string[] }
  | { status: "too-short"; reasons: string[] };

export interface TemplateInput {
  text: string;
  /** When set, a prior message with this ID is the message itself and is skipped. */
  messageId?: string;
  priorMessages: readonly PriorMessage[];
  phrases: readonly PhraseEntry[];
}

export interface TemplateClassifier {
  classify(input: TemplateInput): TemplateVerdict;
}

export function validateDetectorSettings(settings: DetectorSettings): void {
  if (
    !Number.isInteger(settings.minimumMessageLength) ||
    settings.minimumMessageLength < 0
  )
    throw new ExtensionError(
      "RuleEvaluationError",
      "minimumMessageLength must be a non-negative integer",
    );
  for (const field of ["priorMessageThreshold", "phraseThreshold"] as const) {
    const value = settings[field];
    // A threshold of zero would flag every message, so it is refused.
    if (!Number.isFinite(value) || value <= 0 || value > 1)
      throw new ExtensionError(
        "RuleEvaluationError",
        `${field} must be greater than 0 and at most 1`,
      );
  }
}

/**
 * Normalize for comparison: compatibility-fold Unicode, lowercase, turn
 * punctuation and symbols into spaces, and collapse whitespace. Letters and
 * digits in any script are kept, so German umlauts compare as typed.
 */
export function normalizeMessage(text: string): string {
  return text
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[\p{P}\p{S}]+/gu, " ")
    .replace(/\s+/gu, " ")
    .trim();
}

/**
 * Word pairs, so word order matters but a single substituted name only breaks
 * two pairs. A one-word text is its own single shingle.
 */
export function shingles(normalized: string): Set<string> {
  const words = normalized.length === 0 ? [] : normalized.split(" ");
  if (words.length < 2) return new Set(words);
  const result = new Set<string>();
  for (let i = 0; i < words.length - 1; i++)
    result.add(`${words[i]} ${words[i + 1]}`);
  return result;
}

function intersectionSize(a: Set<string>, b: Set<string>): number {
  const [small, large] = a.size <= b.size ? [a, b] : [b, a];
  let count = 0;
  for (const item of small) if (large.has(item)) count++;
  return count;
}

export function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 && b.size === 0) return 0;
  const shared = intersectionSize(a, b);
  return shared / (a.size + b.size - shared);
}

/** Share of the phrase's shingles that also occur in the message. */
export function containment(phrase: Set<string>, message: Set<string>): number {
  if (phrase.size === 0) return 0;
  return intersectionSize(phrase, message) / phrase.size;
}

const percent = (value: number) => `${Math.round(value * 100)}%`;

function matchReason(match: TemplateMatch): string {
  return match.kind === "phrase"
    ? `Matches the saved spam phrase "${match.phrase}" (${percent(match.similarity)}).`
    : `Is ${percent(match.similarity)} similar to an earlier message.`;
}

export class RuleBasedTemplateDetector implements TemplateClassifier {
  readonly settings: DetectorSettings;

  constructor(settings: Partial<DetectorSettings> = {}) {
    this.settings = { ...DEFAULT_DETECTOR_SETTINGS, ...settings };
    validateDetectorSettings(this.settings);
  }

  classify(input: TemplateInput): TemplateVerdict {
    const normalized = normalizeMessage(input.text);
    if (normalized.length < this.settings.minimumMessageLength)
      return {
        status: "too-short",
        reasons: [
          `The message is shorter than ${this.settings.minimumMessageLength} characters, so it is not checked. Short openers are too often identical by chance.`,
        ],
      };
    const message = shingles(normalized);
    const matches: TemplateMatch[] = [];

    for (const entry of input.phrases) {
      const phrase = normalizeMessage(entry.phrase);
      if (phrase.length === 0) continue;
      // An exact phrase inside the message is a full match, even when the
      // phrase is a single word and has no word pairs to compare.
      const exact = ` ${normalized} `.includes(` ${phrase} `);
      const similarity = exact ? 1 : containment(shingles(phrase), message);
      if (similarity >= this.settings.phraseThreshold)
        matches.push({
          kind: "phrase",
          phraseId: entry.id,
          phrase: entry.phrase,
          similarity,
        });
    }

    for (const prior of input.priorMessages) {
      if (prior.id === input.messageId) continue;
      const other = normalizeMessage(prior.text);
      if (other.length < this.settings.minimumMessageLength) continue;
      const similarity =
        other === normalized ? 1 : jaccard(message, shingles(other));
      if (similarity >= this.settings.priorMessageThreshold)
        matches.push({
          kind: "prior-message",
          priorMessageId: prior.id,
          similarity,
        });
    }

    if (matches.length === 0)
      return {
        status: "clear",
        reasons: ["No saved spam phrase or earlier message is similar."],
      };
    matches.sort((a, b) => b.similarity - a.similarity);
    return { status: "flagged", matches, reasons: matches.map(matchReason) };
  }
}
