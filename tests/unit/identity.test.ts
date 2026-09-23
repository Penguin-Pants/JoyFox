import { describe, expect, it } from "vitest";
import {
  canPersistForMember,
  IDENTITY_UNAVAILABLE_TEXT,
  knownMemberIdentity,
  resolveMemberIdentity,
  UNSTABLE_IDENTITY_FIELDS,
  type SelectorLookup,
} from "../../src/identity/member-identity";
import { verifiedSelector } from "../../src/selectors/registry";

const verified: SelectorLookup = () => ".synthetic-member-id";
const found = (value: string) =>
  ({ status: "found", value, source: "synthetic" }) as const;

describe("M5 member identity resolution", () => {
  it("refuses a field the shipped registry has not verified", () => {
    expect(
      resolveMemberIdentity({
        page: "search",
        field: "memberId",
        extraction: found("member-1"),
      }),
    ).toEqual({ status: "unresolved", reason: "selector-unverified" });
    expect(verifiedSelector("search", "memberId")).toBeUndefined();
    expect(verifiedSelector("profile", "memberId")).toBeDefined();
  });

  it("refuses a verified field that is not an identity field", () => {
    for (const field of ["readStatus", "verificationCode", "row", "MemberId"])
      expect(
        resolveMemberIdentity(
          { page: "inbox", field, extraction: found("received") },
          verified,
        ),
      ).toEqual({ status: "unresolved", reason: "not-identity-field" });
  });

  it("refuses display-name fields even when their selector is verified", () => {
    for (const field of [
      ...UNSTABLE_IDENTITY_FIELDS,
      "senderName",
      "DisplayName",
    ])
      expect(
        resolveMemberIdentity(
          { page: "inbox", field, extraction: found("Some Person") },
          verified,
        ),
      ).toEqual({ status: "unresolved", reason: "unstable-identifier" });
  });

  it("resolves a verified, well-formed identifier", () => {
    expect(
      resolveMemberIdentity(
        {
          page: "profile",
          field: "memberId",
          extraction: found("synthetic-member-1"),
        },
        verified,
      ),
    ).toEqual({
      status: "resolved",
      memberId: "synthetic-member-1",
      source: "synthetic",
    });
  });

  it("maps failed extraction to its own reason", () => {
    expect(
      resolveMemberIdentity(
        {
          page: "profile",
          field: "memberId",
          extraction: { status: "missing", source: "synthetic" },
        },
        verified,
      ),
    ).toEqual({ status: "unresolved", reason: "missing" });
    expect(
      resolveMemberIdentity(
        {
          page: "profile",
          field: "memberId",
          extraction: {
            status: "invalid",
            source: "synthetic",
            reason: "shape",
          },
        },
        verified,
      ),
    ).toEqual({ status: "unresolved", reason: "invalid" });
  });

  it("rejects identifiers that cannot serve as a storage key", () => {
    for (const value of [
      "",
      " member-1",
      "member 1",
      "member\n1",
      "a".repeat(129),
    ])
      expect(
        resolveMemberIdentity(
          { page: "profile", field: "memberId", extraction: found(value) },
          verified,
        ),
      ).toEqual({ status: "unresolved", reason: "invalid" });
  });

  it("accepts a stored identifier without consulting the registry", () => {
    const identity = knownMemberIdentity("synthetic-member-2", "storage");
    expect(identity).toEqual({
      status: "resolved",
      memberId: "synthetic-member-2",
      source: "storage",
    });
    expect(canPersistForMember(identity)).toBe(true);
    expect(canPersistForMember(knownMemberIdentity("", "storage"))).toBe(false);
  });

  it("explains every unresolved reason without naming the member", () => {
    for (const text of Object.values(IDENTITY_UNAVAILABLE_TEXT))
      expect(text).toContain("Nothing was stored.");
  });
});
