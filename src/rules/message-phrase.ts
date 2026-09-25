/**
 * Matching for the "First message contains" condition (ADR 0013). A member
 * profile can ask the reader to start a first message with a word, phrase or
 * emoji; the condition checks for it.
 *
 * The match is loose: anywhere in the message, ignoring upper and lower case
 * and extra spaces. Unicode NFKC makes visually identical letters compare
 * equal, and the emoji variation selectors (U+FE0E, U+FE0F) are removed, so
 * "❤" and "❤️" match. Every other character, including skin tone modifiers,
 * must match exactly. Punctuation is kept, so a phrase such as "Hi!" needs
 * its "!".
 */
export function normalizePhrase(text: string): string {
  return text
    .normalize("NFKC")
    .replace(/[︎️]/gu, "")
    .toLowerCase()
    .replace(/\s+/gu, " ")
    .trim();
}

/** The longest phrase a rule may hold, in characters as typed. */
export const MAX_PHRASE_LENGTH = 100;

/**
 * The longest normalized phrase stored with a match. NFKC can lengthen a
 * phrase (a ligature becomes several letters), so this is larger than
 * `MAX_PHRASE_LENGTH`.
 */
export const MAX_NORMALIZED_PHRASE_LENGTH = 400;

/**
 * The most message preview text the inbox sends per row. A preview longer
 * than this is cut; a phrase after the cut is not found and reads as
 * unknown, never as a failure.
 */
export const MAX_PREVIEW_LENGTH = 2_000;

/** The normalized phrases, of those given, that a message contains. */
export function phrasesIn(
  message: string,
  phrases: Iterable<string>,
): Set<string> {
  const normalized = normalizePhrase(message);
  const found = new Set<string>();
  for (const phrase of phrases)
    if (phrase.length > 0 && normalized.includes(phrase)) found.add(phrase);
  return found;
}
