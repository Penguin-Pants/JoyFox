import type { ExtractionResult } from "../domain/types";
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
 * JoyClub's `verification-status` codes. The evidence (01-inbox.md) saw `1`
 * as a grey shield and `3` as a green shield. The project owner confirmed the
 * labels on 2026-09-23: grey is "geprüft" (checked) and green is "persönlich
 * bekannt" (personally known). Both are verification levels, so both count
 * as verified. Every other code, including `2`, is unconfirmed and reads as
 * unknown. A row with no shield is missing, never "not verified", because
 * the meaning of an absent shield is also unconfirmed.
 */
export const VERIFICATION_CODE_MEANING: Readonly<Record<number, boolean>> =
  Object.freeze({ 1: true, 3: true });

export function verificationFromCode(
  code: ExtractionResult<number>,
): boolean | "unknown" {
  if (code.status !== "found") return "unknown";
  return VERIFICATION_CODE_MEANING[code.value] ?? "unknown";
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
  /** No join date has been found on any page (08-attribute-matrix.md). */
  joinedAt: ExtractionResult<string>;
}

/** The photo badge's `aria-label`, such as "12 Fotos" or "1 Foto". */
const PHOTO_LABEL = /^\s*(\d+)\s+Fotos?\s*$/u;

export function extractProfile(
  root: ParentNode,
  url: string,
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
    joinedAt: missing("profile.joinedAt:no-verified-selector"),
  };
}
