import { en, type MessageKey } from "../src/i18n/catalog/en";
import { paramsOf, type Message } from "../src/i18n/message";
import { setLocale, t } from "../src/i18n/translator";

/** The text of one message, in the current language (English by default). */
export const text = (message: Message | undefined): string =>
  message ? t(message) : "";

/** The text of each message, in order. */
export const texts = (messages: readonly Message[]): string[] =>
  messages.map((message) => t(message));

const BRANDS = /JoyFox|JoyClub|JOYCE|ClubMail/gu;
/** Stands in for each param, so only the fixed text is left around it. */
const MARK = "\u2063";

/**
 * Every piece of English catalog text that German must not show: each plain
 * value that differs in German, and the fixed text around the params of
 * each function. Brand names alone do not count.
 */
export function englishFragments(): string[] {
  const english = new Set<string>();
  const german = new Set<string>();
  const germanTexts: string[] = [];
  for (const key of Object.keys(en) as MessageKey[]) {
    const params: Record<string, unknown> = {};
    for (const [name, kind] of Object.entries(paramsOf(key) ?? {}))
      params[name] =
        kind === "number"
          ? 7
          : kind === "string"
            ? MARK
            : { key: "legacy.text", params: { text: MARK } };
    const value = { key, params } as unknown as Message;
    for (const [locale, into] of [
      ["en", english],
      ["de", german],
    ] as const) {
      setLocale(locale);
      const shown = paramsOf(key) === null ? t({ key } as Message) : t(value);
      if (locale === "de") germanTexts.push(shown);
      for (const piece of shown.split(/\u2063|\d+/u)) into.add(piece.trim());
    }
  }
  setLocale("en");
  // A word German uses too ("Import") is no leak.
  const allGerman = germanTexts.join("\n");
  return [...english].filter(
    (piece) =>
      !german.has(piece) &&
      (piece.replace(BRANDS, "").match(/\p{L}/gu) ?? []).length >= 3 &&
      leakedEnglish(allGerman, [piece]).length === 0,
  );
}

/** The English fragments that appear as whole words in `shown`. */
export function leakedEnglish(shown: string, fragments: string[]): string[] {
  return fragments.filter((piece) =>
    new RegExp(
      `(?<!\\p{L})${piece.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&")}(?!\\p{L})`,
      "u",
    ).test(shown),
  );
}

/** The text and the labels of every element under `roots`. */
export function shownText(roots: Iterable<Element>): string {
  const parts: string[] = [];
  for (const root of roots)
    for (const node of [root, ...Array.from(root.querySelectorAll("*"))]) {
      for (const name of ["aria-label", "title", "placeholder"]) {
        const value = node.getAttribute(name);
        if (value) parts.push(value);
      }
      for (const child of Array.from(node.childNodes))
        if (child.nodeType === 3) parts.push(child.textContent ?? "");
    }
  return parts.join("\n");
}
