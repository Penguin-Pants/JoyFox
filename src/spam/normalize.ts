/**
 * Reduce a message to the form the detector compares. Two messages that differ
 * only in casing, spacing, punctuation or Unicode composition normalize to the
 * same string, which is what makes a pasted template recognizable.
 *
 * The steps are fixed and deterministic, in this order:
 *  1. Unicode NFKC, so visually identical characters compare equal.
 *  2. Case folding.
 *  3. Punctuation and symbols replaced by a space, never deleted, so "hi,there"
 *     does not become the single token "hithere".
 *  4. Whitespace collapsed to one space, then trimmed.
 */
export function normalizeMessage(text: string): string {
  return text
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[\p{P}\p{S}]/gu, " ")
    .replace(/\s+/gu, " ")
    .trim();
}

/** Word count of the normalized form, used by the minimum-length rule. */
export function normalizedWordCount(normalized: string): number {
  return normalized.length === 0 ? 0 : normalized.split(" ").length;
}
