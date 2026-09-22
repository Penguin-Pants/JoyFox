import type { ExtractionResult } from "../domain/types";
import { verifiedSelector, type PageType } from "../selectors/registry";

/**
 * Field names that describe a member but are not an identity. The build plan
 * (Section 12) forbids keying stored data to a display name, so these are
 * rejected before any other check, even if a selector for them is verified.
 * Entries are lowercase because the comparison ignores case.
 */
export const UNSTABLE_IDENTITY_FIELDS: readonly string[] = [
  "displayname",
  "handle",
  "membername",
  "nickname",
  "profilename",
  "sendername",
  "username",
];

export type IdentityUnavailableReason =
  | "selector-unverified"
  | "unstable-identifier"
  | "missing"
  | "invalid";

export type MemberIdentity =
  | { status: "resolved"; memberId: string; source: string }
  | { status: "unresolved"; reason: IdentityUnavailableReason };

const unresolved = (reason: IdentityUnavailableReason): MemberIdentity => ({
  status: "unresolved",
  reason,
});

/**
 * A conservative shape guard, not a claim about JoyClub's identifier format.
 * No verified observation of that format exists yet, so this only rejects
 * values that cannot serve as a storage key: empty, padded, or containing
 * whitespace or control characters.
 */
function isUsableIdentifier(value: string): boolean {
  return (
    value.length > 0 &&
    value.length <= 128 &&
    value === value.trim() &&
    // eslint-disable-next-line no-control-regex
    !/[\s\u0000-\u001f\u007f]/.test(value)
  );
}

/**
 * Decide whether an extracted value may be used as a member identity. Returns
 * `unresolved` whenever the answer is not certain: callers must then disable
 * persistence rather than fall back to a weaker identifier.
 */
export type SelectorLookup = (
  page: Exclude<PageType, "unknown">,
  field: string,
) => string | undefined;

export function resolveMemberIdentity(
  input: {
    page: Exclude<PageType, "unknown">;
    field: string;
    extraction: ExtractionResult<string>;
  },
  /** Injectable so tests can prove the verified path without editing the
   * shipped registry, which must stay unverified until F1 supplies evidence. */
  lookup: SelectorLookup = verifiedSelector,
): MemberIdentity {
  // Compared case-insensitively: a registry that spells the field
  // `SenderName` must be refused exactly like `senderName`.
  if (UNSTABLE_IDENTITY_FIELDS.includes(input.field.toLowerCase()))
    return unresolved("unstable-identifier");
  if (lookup(input.page, input.field) === undefined)
    return unresolved("selector-unverified");
  if (input.extraction.status === "missing") return unresolved("missing");
  if (input.extraction.status === "invalid") return unresolved("invalid");
  return isUsableIdentifier(input.extraction.value)
    ? {
        status: "resolved",
        memberId: input.extraction.value,
        source: input.extraction.source,
      }
    : unresolved("invalid");
}

/**
 * Build an identity from an identifier that is already known to be stable, for
 * example one read back from storage or supplied by a synthetic fixture. This
 * never consults the selector registry, so it must not be used on values taken
 * straight from the live page.
 */
export function knownMemberIdentity(
  memberId: string,
  source: string,
): MemberIdentity {
  return isUsableIdentifier(memberId)
    ? { status: "resolved", memberId, source }
    : unresolved("invalid");
}

export function canPersistForMember(identity: MemberIdentity): boolean {
  return identity.status === "resolved";
}

export const IDENTITY_UNAVAILABLE_TEXT: Record<
  IdentityUnavailableReason,
  string
> = {
  "selector-unverified":
    "Saving is off because this page has no verified member identifier yet. Nothing was stored.",
  "unstable-identifier":
    "Saving is off because only a display name is available, which is not a stable identity. Nothing was stored.",
  missing:
    "Saving is off because the member identifier was not found on this page. Nothing was stored.",
  invalid:
    "Saving is off because the member identifier on this page could not be read. Nothing was stored.",
};
