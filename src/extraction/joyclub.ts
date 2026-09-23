import type { ExtractionResult } from "../domain/types";
import type { JoinWindow } from "../qualification/facts";
import {
  FROM_URL,
  selectorRegistry,
  verifiedSelector,
} from "../selectors/registry";

/**
 * Pure extractors for the verified JoyClub pages. Each reads only the DOM it
 * is given, returns an ExtractionResult per field, and never throws on
 * unexpected markup: a field that cannot be read is `missing` or `invalid`,
 * so qualification shows Unknown rather than a guess.
 *
 * Identity comes from the numeric member ID only (build plan Section 12).
 * The inbox sender name is read for display alone, as the F2 proof of concept
 * requires: it is never an identity, never stored and never logged. Message
 * text is not extracted at all.
 */

const found = <T>(value: T, source: string): ExtractionResult<T> => ({
  status: "found",
  value,
  source,
});
const missing = <T>(source: string): ExtractionResult<T> => ({
  status: "missing",
  source,
});
const invalid = <T>(source: string, reason: string): ExtractionResult<T> => ({
  status: "invalid",
  source,
  reason,
});

/**
 * A verified page's path pattern, whose first capture group is the ID the
 * page carries in its URL. One source of truth: the registry.
 */
function pagePath(page: "conversation" | "profile"): RegExp | undefined {
  const definition = selectorRegistry[page];
  return definition.status === "verified" && definition.path
    ? new RegExp(definition.path)
    : undefined;
}

export function memberIdFromProfileHref(
  href: string | null,
  base: string,
  source: string,
): ExtractionResult<string> {
  if (href === null || href.trim() === "") return missing(source);
  let path: string;
  try {
    path = new URL(href, base).pathname;
  } catch {
    return invalid(source, "Unparseable profile link");
  }
  // The digit run in `/profile/<digits>.<nickname>.html`; the nickname is dropped.
  const match = pagePath("profile")?.exec(path);
  return match?.[1]
    ? found(match[1], source)
    : invalid(source, "Profile link has an unexpected shape");
}

/** A non-negative integer attribute such as `verification-status="3"`. */
function codeAttribute(
  scope: ParentNode,
  selector: string | undefined,
  attribute: string,
  source: string,
): ExtractionResult<number> {
  if (!selector) return missing(source);
  const element = scope.querySelector(selector);
  const raw = element?.getAttribute(attribute);
  if (raw === null || raw === undefined) return missing(source);
  return /^\d+$/.test(raw.trim())
    ? found(Number(raw.trim()), source)
    : invalid(source, `${attribute} is not a numeric code`);
}

/**
 * JoyClub's `verification-status` codes, confirmed by the project owner on
 * 2026-09-23:
 *
 * - `1`, grey shield "geprüft": verified by JoyClub.
 * - `3`, green shield "persönlich bekannt": the logged-in user marked this
 *   member as met in person. It is the viewer's own mark, not JoyClub's
 *   verification.
 *
 * The icon shows one state: green replaces grey for a member who is both, and
 * a member can be personally known without being verified (owner, same day).
 * So code `3` says nothing about JoyClub's verification, which reads as
 * unknown, and code `1` means "not personally known". By the owner's
 * decision, "personally known" is a separate signal, not a substitute for
 * verification. Code `2`, any other code and a missing shield are unconfirmed
 * and read as unknown for both signals.
 */
export const VERIFICATION_CODE_MEANING: Readonly<Record<number, boolean>> =
  Object.freeze({ 1: true });

/** The `verification-status` code for "persönlich bekannt". */
export const PERSONALLY_KNOWN_CODE = 3;

/** JoyClub's own verification, as the qualification rule uses it. */
export function verificationFromCode(
  code: ExtractionResult<number>,
): boolean | "unknown" {
  if (code.status !== "found") return "unknown";
  return VERIFICATION_CODE_MEANING[code.value] ?? "unknown";
}

/** The `verification-status` code for "geprüft" without the green mark. */
export const VERIFIED_ONLY_CODE = 1;

/**
 * Whether the logged-in user marked this member as met in person. Code `3`
 * is "yes". Code `1` is "no", because green would replace grey if the member
 * were also personally known. Other codes and a missing shield are unknown.
 */
export function personallyKnownFromCode(
  code: ExtractionResult<number>,
): boolean | "unknown" {
  if (code.status !== "found") return "unknown";
  if (code.value === PERSONALLY_KNOWN_CODE) return true;
  if (code.value === VERIFIED_ONLY_CODE) return false;
  return "unknown";
}

/** The member's profile type, as JoyClub shows it with its gender icon. */
export type ProfileType = "man" | "woman" | "couple";

/**
 * `universal-gender` codes, confirmed by the project owner on 2026-09-23 by
 * inspecting profiles: `1` man, `2` woman, `3` couple (drawn as a male and a
 * female icon side by side). Other codes, for example other couple
 * compositions if JoyClub has them, read as unknown.
 */
export const PROFILE_TYPE_CODE_MEANING: Readonly<Record<number, ProfileType>> =
  Object.freeze({ 1: "man", 2: "woman", 3: "couple" });

export function profileTypeFromCode(
  code: ExtractionResult<number>,
): ProfileType | "unknown" {
  if (code.status !== "found") return "unknown";
  return PROFILE_TYPE_CODE_MEANING[code.value] ?? "unknown";
}

const countWords = (text: string) =>
  text.trim() === "" ? 0 : text.trim().split(/\s+/u).length;

export interface InboxRowExtraction {
  row: Element;
  /** Display only. Never persist, log or use it as an identity. */
  senderName: ExtractionResult<string>;
  memberId: ExtractionResult<string>;
  verificationCode: ExtractionResult<number>;
  genderCode: ExtractionResult<number>;
  /** The BEM modifier, such as `received` or `read`. */
  readState: ExtractionResult<string>;
}

export function extractInboxRows(
  root: ParentNode,
  base: string,
): InboxRowExtraction[] {
  const rowSelector = verifiedSelector("inbox", "row");
  if (!rowSelector) return [];
  const linkSelector = verifiedSelector("inbox", "memberId");
  const readSelector = verifiedSelector("inbox", "readStatus");
  const nameSelector = verifiedSelector("inbox", "senderName");
  return Array.from(root.querySelectorAll(rowSelector)).map((row) => {
    const readIcon = readSelector ? row.querySelector(readSelector) : null;
    const modifier = Array.from(readIcon?.classList ?? [])
      .map((name) => /__read-status--([a-z-]+)$/.exec(name)?.[1])
      .find((value) => value !== undefined);
    const name = nameSelector
      ? row.querySelector(nameSelector)?.textContent?.trim()
      : undefined;
    return {
      row,
      senderName: name
        ? found(name, "inbox.senderName")
        : missing("inbox.senderName"),
      memberId: memberIdFromProfileHref(
        linkSelector
          ? (row.querySelector(linkSelector)?.getAttribute("href") ?? null)
          : null,
        base,
        "inbox.memberId",
      ),
      verificationCode: codeAttribute(
        row,
        verifiedSelector("inbox", "verificationCode"),
        "verification-status",
        "inbox.verificationCode",
      ),
      genderCode: codeAttribute(
        row,
        verifiedSelector("inbox", "genderCode"),
        "universal-gender",
        "inbox.genderCode",
      ),
      readState: modifier
        ? found(modifier, "inbox.readStatus")
        : missing("inbox.readStatus"),
    };
  });
}

export interface ConversationExtraction {
  /** Opaque ID from the URL, such as `personal-123-456`. */
  conversationId: ExtractionResult<string>;
  memberId: ExtractionResult<string>;
  verificationCode: ExtractionResult<number>;
  genderCode: ExtractionResult<number>;
  /** Word count of the sender's short profile description in the header. */
  descriptionWordCount: ExtractionResult<number>;
}

export function extractConversation(
  root: ParentNode,
  url: string,
): ConversationExtraction {
  let path = "";
  try {
    path = new URL(url).pathname;
  } catch {
    // An unparseable URL leaves the conversation ID missing below.
  }
  const conversationMatch = pagePath("conversation")?.exec(path);
  const conversationId = conversationMatch?.[1];
  const headerLink = verifiedSelector("conversation", "memberId");
  const descriptionSelector = verifiedSelector(
    "conversation",
    "profileDescription",
  );
  const description = descriptionSelector
    ? root.querySelector(descriptionSelector)
    : null;
  const conversation: ExtractionResult<string> = conversationId
    ? found(conversationId, "conversation.url")
    : missing("conversation.url");
  const memberId = memberIdFromProfileHref(
    headerLink
      ? (root.querySelector(headerLink)?.getAttribute("href") ?? null)
      : null,
    url,
    "conversation.memberId",
  );
  // Switching conversations is a client-side route (09-navigation.md), so the
  // URL can change before the header re-renders. Header data is used only when
  // the header's member ID is one of the numbers in the conversation ID;
  // otherwise it may belong to the previous conversation and reads as
  // missing. This fails closed: it assumes the URL numbers are participant
  // member IDs, and if they are not, header data is simply never used.
  const headerMatchesUrl =
    conversationId !== undefined &&
    memberId.status === "found" &&
    conversationId.split("-").includes(memberId.value);
  if (!headerMatchesUrl) {
    const stale = <T>(field: string): ExtractionResult<T> =>
      missing(`conversation.${field}:header-not-matched-to-url`);
    return {
      conversationId: conversation,
      memberId:
        memberId.status === "found" ? stale<string>("memberId") : memberId,
      verificationCode: stale<number>("verificationCode"),
      genderCode: stale<number>("genderCode"),
      descriptionWordCount: stale<number>("profileDescription"),
    };
  }
  return {
    conversationId: conversation,
    memberId,
    verificationCode: codeAttribute(
      root,
      verifiedSelector("conversation", "verificationCode"),
      "verification-status",
      "conversation.verificationCode",
    ),
    genderCode: codeAttribute(
      root,
      verifiedSelector("conversation", "genderCode"),
      "universal-gender",
      "conversation.genderCode",
    ),
    descriptionWordCount: description
      ? found(
          countWords(description.textContent ?? ""),
          "conversation.profileDescription",
        )
      : missing("conversation.profileDescription"),
  };
}

export interface ProfileExtraction {
  memberId: ExtractionResult<string>;
  verificationCode: ExtractionResult<number>;
  genderCode: ExtractionResult<number>;
  photoCount: ExtractionResult<number>;
  /** Words in the motto and the main text together. */
  profileWordCount: ExtractionResult<number>;
  /** No exact join date has been found on any page. */
  joinedAt: ExtractionResult<string>;
  /** The join window from the "Angemeldet seit ..." badge. */
  joinedWindow: ExtractionResult<JoinWindow>;
}

type DurationUnit = "day" | "week" | "month" | "year";

const UNIT_WORDS: Readonly<Record<string, DurationUnit>> = {
  tag: "day",
  tagen: "day",
  woche: "week",
  wochen: "week",
  monat: "month",
  monaten: "month",
  jahr: "year",
  jahren: "year",
};

/**
 * "Angemeldet seit 11 Monaten" was observed live (2026-09-23). The singular
 * forms and "einem"/"einer" follow German grammar and are not yet observed.
 */
const MEMBER_SINCE =
  /^Angemeldet seit (\d+|einem|einer) (Tag|Tagen|Woche|Wochen|Monat|Monaten|Jahr|Jahren)$/u;

export function parseMemberSince(
  text: string,
): { count: number; unit: DurationUnit } | undefined {
  const match = MEMBER_SINCE.exec(text.replace(/\s+/gu, " ").trim());
  if (!match?.[1] || !match[2]) return undefined;
  const count = /^\d+$/.test(match[1]) ? Number(match[1]) : 1;
  const unit = UNIT_WORDS[match[2].toLowerCase()];
  return unit && Number.isSafeInteger(count) ? { count, unit } : undefined;
}

function subtractUnits(from: Date, unit: DurationUnit, count: number): Date {
  const date = new Date(from.getTime());
  if (unit === "day") date.setUTCDate(date.getUTCDate() - count);
  else if (unit === "week") date.setUTCDate(date.getUTCDate() - 7 * count);
  else {
    // Calendar months and years, with the day clamped to the target month's
    // last day: 31 March minus one month is 28 or 29 February, not 3 March.
    const months = unit === "month" ? count : 12 * count;
    const total = date.getUTCFullYear() * 12 + date.getUTCMonth() - months;
    const year = Math.floor(total / 12);
    const month = total - year * 12;
    const lastDay = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
    date.setUTCFullYear(year, month, Math.min(date.getUTCDate(), lastDay));
  }
  return date;
}

/**
 * Turn "for <n> units" into the window the member joined in. It is not
 * confirmed whether JoyClub rounds down or to the nearest unit, so the window
 * is widened to one unit either side: from n + 1 units ago to n - 1 units ago.
 */
export function joinWindowFromDuration(
  duration: { count: number; unit: DurationUnit },
  now: Date,
): JoinWindow {
  return {
    earliest: subtractUnits(
      now,
      duration.unit,
      duration.count + 1,
    ).toISOString(),
    latest: subtractUnits(
      now,
      duration.unit,
      Math.max(duration.count - 1, 0),
    ).toISOString(),
  };
}

/** The photo badge's `aria-label`, such as "12 Fotos" or "1 Foto". */
const PHOTO_LABEL = /^\s*(\d+)\s+Fotos?\s*$/u;

export function extractProfile(
  root: ParentNode,
  url: string,
  now: Date = new Date(),
): ProfileExtraction {
  let pathname = "";
  try {
    pathname = new URL(url).pathname;
  } catch {
    // An unparseable URL leaves the member ID missing below.
  }
  const memberField = verifiedSelector("profile", "memberId");
  const photoSelector = verifiedSelector("profile", "photoCount");
  const photoLabel = photoSelector
    ? (root.querySelector(photoSelector)?.getAttribute("aria-label") ?? null)
    : null;
  const photoMatch = photoLabel === null ? null : PHOTO_LABEL.exec(photoLabel);
  const textSelectors = [
    verifiedSelector("profile", "profileMotto"),
    verifiedSelector("profile", "profileMainText"),
  ].filter((selector): selector is string => selector !== undefined);
  const textBlocks = textSelectors
    .map((selector) => root.querySelector(selector))
    .filter((element): element is Element => element !== null);
  return {
    memberId:
      memberField === FROM_URL
        ? memberIdFromProfileHref(pathname || null, url, "profile.url")
        : missing("profile.url"),
    verificationCode: codeAttribute(
      root,
      verifiedSelector("profile", "verificationCode"),
      "verification-status",
      "profile.verificationCode",
    ),
    genderCode: codeAttribute(
      root,
      verifiedSelector("profile", "genderCode"),
      "universal-gender",
      "profile.genderCode",
    ),
    photoCount:
      photoLabel === null
        ? missing("profile.photoCount")
        : photoMatch?.[1]
          ? found(Number(photoMatch[1]), "profile.photoCount")
          : invalid("profile.photoCount", "Unexpected photo badge label"),
    // No text block at all is "not rendered", which is not the same as a
    // profile with zero words, so it stays missing.
    profileWordCount:
      textBlocks.length === 0
        ? missing("profile.text")
        : found(
            textBlocks.reduce(
              (total, element) => total + countWords(element.textContent ?? ""),
              0,
            ),
            "profile.text",
          ),
    joinedAt: missing("profile.joinedAt:no-exact-date-on-site"),
    joinedWindow: memberSinceWindow(root, now),
  };
}

function memberSinceWindow(
  root: ParentNode,
  now: Date,
): ExtractionResult<JoinWindow> {
  const selector = verifiedSelector("profile", "memberSinceBadge");
  if (!selector) return missing("profile.memberSince");
  const badge = Array.from(root.querySelectorAll(selector))
    .map((element) => (element.textContent ?? "").replace(/\s+/gu, " ").trim())
    .find((text) => text.startsWith("Angemeldet seit"));
  if (badge === undefined) return missing("profile.memberSince");
  const duration = parseMemberSince(badge);
  return duration
    ? found(joinWindowFromDuration(duration, now), "profile.memberSince")
    : invalid("profile.memberSince", "Unexpected membership duration text");
}
