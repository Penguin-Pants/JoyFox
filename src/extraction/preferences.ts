import { verifiedSelector } from "../selectors/registry";

/**
 * V1-2: the "Vorlieben" checklist on a profile page (13-preferences.md). A
 * profile lists only its selected tags, each in one of six levels. The
 * German label is a tag's only key, so tags are matched by label.
 */

/** The six levels, in page order (site vocabulary). */
export const PREFERENCE_LEVELS = [
  "Unbedingt",
  "Steh ich drauf",
  "Situationsabhängig",
  "Mag ich nicht so",
  "Geht gar nicht",
  "Möchte ich gerne ausprobieren",
] as const;
export type PreferenceLevel = (typeof PREFERENCE_LEVELS)[number];

/** The levels that count as shared when both profiles have a tag at one (D5). */
export const POSITIVE_LEVELS: ReadonlySet<PreferenceLevel> = new Set([
  "Unbedingt",
  "Steh ich drauf",
  "Situationsabhängig",
  "Möchte ich gerne ausprobieren",
]);

/** The most tags JoyFox stores for one profile; a storage guard. */
export const MAX_PREFERENCE_TAGS = 500;
export const MAX_PREFERENCE_LABEL_LENGTH = 100;

/** One space between words, no space at either end. */
export const normalizeLabel = (label: string) =>
  label.replace(/\s+/gu, " ").trim();

export interface PreferenceEntry {
  /** JoyClub's `j-tag` element, which the profile highlight marks. */
  tag: Element;
  label: string;
  level: PreferenceLevel;
}

export type PreferenceReading =
  /** `positive`: sorted, unique labels at a positive level for any person. */
  | { status: "found"; entries: PreferenceEntry[]; positive: string[] }
  /** No checklist on the page (not rendered, or JoyClub changed it). */
  | { status: "missing" }
  /**
   * A checklist is there, but a level or a tag could not be read. Its
   * `j-tag` elements may not have drawn their labels yet, or JoyClub changed
   * a level name. Nothing is stored from such a reading: a partial list
   * would give a wrong count.
   */
  | { status: "unreadable" };

/**
 * The label a `j-tag` shows. It is in the element's shadow root, which
 * Firefox gives a content script through `openOrClosedShadowRoot`.
 */
function tagLabel(tag: Element, labelSelector: string): string | undefined {
  const host = tag as Element & { openOrClosedShadowRoot?: ShadowRoot | null };
  const shadow = host.openOrClosedShadowRoot ?? tag.shadowRoot;
  const text = shadow?.querySelector(labelSelector)?.textContent;
  const label = text === undefined || text === null ? "" : normalizeLabel(text);
  return label.length > 0 && label.length <= MAX_PREFERENCE_LABEL_LENGTH
    ? label
    : undefined;
}

/**
 * Every tag on the page with its level. A couple profile shows one list per
 * partner, and each list has a hidden copy for another layout; all are read.
 * A tag counts as positive when any partner has it at a positive level
 * (owner decision, 2026-09-26: "either partner").
 */
export function readPreferences(root: ParentNode): PreferenceReading {
  const sectionSelector = verifiedSelector("profile", "preferenceSection");
  const levelSelector = verifiedSelector("profile", "preferenceLevel");
  const titleSelector = verifiedSelector("profile", "preferenceLevelTitle");
  const tagSelector = verifiedSelector("profile", "preferenceTag");
  const labelSelector = verifiedSelector("profile", "preferenceTagLabel");
  if (
    !sectionSelector ||
    !levelSelector ||
    !titleSelector ||
    !tagSelector ||
    !labelSelector
  )
    return { status: "missing" };
  const sections = Array.from(root.querySelectorAll(sectionSelector));
  if (sections.length === 0) return { status: "missing" };
  const entries: PreferenceEntry[] = [];
  for (const section of sections)
    for (const group of Array.from(section.querySelectorAll(levelSelector))) {
      const title = normalizeLabel(
        group.querySelector(titleSelector)?.textContent ?? "",
      );
      const level = PREFERENCE_LEVELS.find((name) => name === title);
      if (!level) return { status: "unreadable" };
      for (const tag of Array.from(group.querySelectorAll(tagSelector))) {
        const label = tagLabel(tag, labelSelector);
        if (label === undefined) return { status: "unreadable" };
        entries.push({ tag, label, level });
      }
    }
  const positive = [
    ...new Set(
      entries
        .filter((entry) => POSITIVE_LEVELS.has(entry.level))
        .map((entry) => entry.label),
    ),
  ].sort();
  if (positive.length > MAX_PREFERENCE_TAGS) return { status: "unreadable" };
  return { status: "found", entries, positive };
}

/**
 * Whether the page is the viewer's own profile: only there JoyClub shows
 * the "Account" headline (13-preferences.md).
 */
export function isOwnProfile(root: ParentNode): boolean {
  const selector = verifiedSelector("profile", "ownProfileHeadline");
  if (!selector) return false;
  return Array.from(root.querySelectorAll(selector)).some(
    (headline) => normalizeLabel(headline.textContent ?? "") === "Account",
  );
}

/** The labels both lists have: the shared preferences, sorted. */
export function sharedPreferences(
  own: readonly string[],
  other: readonly string[],
): string[] {
  const mine = new Set(own);
  return [...new Set(other)].filter((label) => mine.has(label)).sort();
}
