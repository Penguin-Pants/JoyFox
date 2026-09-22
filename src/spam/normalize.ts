/**
 * Reduce a message to the form the detector compares. Two messages that differ
 * only in casing, spacing, punctuation or Unicode composition normalize to the
 * same string, which is what makes a pasted template recognizable.
 *
 * The steps are fixed and deterministic, in this order:
 *  1. Unicode NFKC, so visually identical characters compare equal.
 *  2. Default-ignorable characters removed (such as U+200B or the variation
 *     selector U+FE0F), which could otherwise split a copied template without
 *     a visible change.
 *  3. Case folding.
 *  4. Punctuation and symbols replaced by a space, never deleted, so "hi,there"
 *     does not become the single token "hithere".
 *  5. Whitespace collapsed to one space, then trimmed.
 */
export function normalizeMessage(text: string): string {
  return text
    .normalize("NFKC")
    .replace(/\p{Default_Ignorable_Code_Point}+/gu, "")
    .toLowerCase()
    .replace(/[\p{P}\p{S}]/gu, " ")
    .replace(/\s+/gu, " ")
    .trim();
}

/** Scripts written without spaces between words. */
const UNSPACED_SCRIPT =
  /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Thai}\p{Script=Lao}\p{Script=Khmer}\p{Script=Myanmar}]/gu;

/**
 * Word count of the normalized form, used by the minimum-length rule. In a
 * script written without spaces a whole sentence is one space-separated
 * token, so each of its characters counts as a word instead; otherwise such a
 * message could never reach the minimum and would never be checked.
 */
export function normalizedWordCount(normalized: string): number {
  if (normalized.length === 0) return 0;
  return normalized.split(" ").reduce((total, token) => {
    const unspaced = token.match(UNSPACED_SCRIPT)?.length ?? 0;
    const rest = token.replace(UNSPACED_SCRIPT, "");
    return total + unspaced + (/[\p{L}\p{N}]/u.test(rest) ? 1 : 0);
  }, 0);
}

/** Whether a normalized text has at least one letter or digit. */
export const hasLetterOrDigit = (normalized: string) =>
  /[\p{L}\p{N}]/u.test(normalized);
