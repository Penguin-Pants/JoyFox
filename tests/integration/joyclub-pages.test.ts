// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from "vitest";
import {
  DIAGNOSTICS_KEY,
  DiagnosticsFlag,
  summarizeInbox,
} from "../../src/content/diagnostics";
import { detectPage } from "../../src/content/page-detector";
import {
  extractConversation,
  extractInboxRows,
  extractProfile,
  memberIdFromProfileHref,
  joinWindowFromDuration,
  parseMemberSince,
  personallyKnownFromCode,
  profileTypeFromCode,
  verificationFromCode,
} from "../../src/extraction/joyclub";
import { resolveMemberIdentity } from "../../src/identity/member-identity";
import { evaluateQualification } from "../../src/qualification/engine";
import { mergeProfileFacts } from "../../src/qualification/facts";
import conversationHtml from "../fixtures/joyclub/conversation.html?raw";
import inboxHtml from "../fixtures/joyclub/inbox.html?raw";
import profileHtml from "../fixtures/joyclub/profile.html?raw";

const FIXTURES: Record<string, string> = {
  inbox: inboxHtml,
  conversation: conversationHtml,
  profile: profileHtml,
};
const fixture = (name: string) => FIXTURES[name] ?? "";

const INBOX_URL = "https://www.joyclub.de/clubmail/";
const CONVERSATION_URL =
  "https://www.joyclub.de/clubmail/conversation/conversation-wrapper-personal-1234567-7654321/";
const PROFILE_URL = "https://www.joyclub.de/profile/1234567.synthetic_one.html";

function load(name: string): Document {
  document.body.innerHTML = fixture(name);
  return document;
}

beforeEach(() => {
  document.body.innerHTML = "";
});

describe("F1/F2 page detection from verified selectors", () => {
  it("detects each verified page once its root has rendered", () => {
    expect(detectPage(INBOX_URL, load("inbox"))).toMatchObject({
      status: "found",
      value: "inbox",
    });
    expect(detectPage(CONVERSATION_URL, load("conversation"))).toMatchObject({
      status: "found",
      value: "conversation",
    });
    expect(detectPage(PROFILE_URL, load("profile"))).toMatchObject({
      status: "found",
      value: "profile",
    });
  });

  it("lets the URL decide while the inbox list stays rendered", () => {
    document.body.innerHTML = fixture("inbox") + fixture("conversation");
    expect(detectPage(CONVERSATION_URL, document)).toMatchObject({
      value: "conversation",
    });
  });

  it("waits while a matching page has not rendered its root", () => {
    expect(detectPage(PROFILE_URL, document)).toEqual({
      status: "missing",
      source: "profile:root-not-rendered",
    });
  });

  it("detects nothing on unverified hosts, paths or URLs", () => {
    load("inbox");
    expect(detectPage("https://www.joyce.app/clubmail/", document)).toEqual({
      status: "missing",
      source: "host-unverified",
    });
    expect(detectPage("https://www.joyclub.de/search/", document).status).toBe(
      "missing",
    );
    expect(
      detectPage("https://www.joyclub.de/clubmail/other/", document).status,
    ).toBe("missing");
    expect(detectPage("not a url", document).status).toBe("invalid");
  });
});

describe("F1 extraction from the verified inbox", () => {
  it("reads member IDs and codes without the nickname or the name", () => {
    const rows = extractInboxRows(load("inbox"), INBOX_URL);
    expect(rows).toHaveLength(3);
    expect(rows[0]).toMatchObject({
      memberId: { status: "found", value: "1234567" },
      verificationCode: { status: "found", value: 3 },
      genderCode: { status: "found", value: 1 },
      readState: { status: "found", value: "received" },
    });
    expect(rows[1]).toMatchObject({
      memberId: { status: "found", value: "98765432" },
      readState: { status: "found", value: "read" },
    });
    const serialized = JSON.stringify(
      rows.map((row) => [
        row.memberId,
        row.verificationCode,
        row.genderCode,
        row.readState,
      ]),
    );
    expect(serialized).not.toMatch(/synthetic_one|Synthetic One|preview/);
  });

  it("reads the sender name for display only (F2 proof of concept)", () => {
    const rows = extractInboxRows(load("inbox"), INBOX_URL);
    expect(rows.map((row) => row.senderName)).toEqual([
      { status: "found", value: "Synthetic One", source: "inbox.senderName" },
      { status: "found", value: "Synthetic Two", source: "inbox.senderName" },
      { status: "found", value: "Synthetic Three", source: "inbox.senderName" },
    ]);
  });

  it("summarizes an inbox for diagnostics with counts only", () => {
    const summary = summarizeInbox(extractInboxRows(load("inbox"), INBOX_URL));
    expect(summary).toBe(
      "inbox.extracted rows=3 senderName=3 memberId=2 verificationCode=2 readState=2",
    );
    expect(summary).not.toMatch(/Synthetic|1234567|98765432/);
  });

  it("reports a row without avatar or icons as missing, never as a value", () => {
    const [, , bare] = extractInboxRows(load("inbox"), INBOX_URL);
    expect(bare).toMatchObject({
      memberId: { status: "missing" },
      verificationCode: { status: "missing" },
      genderCode: { status: "missing" },
      readState: { status: "missing" },
    });
  });

  it("rejects a profile link of an unexpected shape", () => {
    for (const href of ["/profile/abc.name.html", "/clubmail/", "/profile/1"])
      expect(memberIdFromProfileHref(href, INBOX_URL, "t").status).toBe(
        "invalid",
      );
    expect(memberIdFromProfileHref("", INBOX_URL, "t").status).toBe("missing");
  });

  it("resolves a stable member identity from the verified member ID field", () => {
    const [row] = extractInboxRows(load("inbox"), INBOX_URL);
    if (!row) throw new Error("fixture has no row");
    expect(
      resolveMemberIdentity({
        page: "inbox",
        field: "memberId",
        extraction: row.memberId,
      }),
    ).toEqual({
      status: "resolved",
      memberId: "1234567",
      source: "inbox.memberId",
    });
    expect(
      resolveMemberIdentity({
        page: "inbox",
        field: "senderName",
        extraction: { status: "found", value: "Synthetic One", source: "t" },
      }),
    ).toEqual({ status: "unresolved", reason: "unstable-identifier" });
  });
});

describe("F1 extraction from the verified conversation", () => {
  it("reads the conversation ID from the URL and the sender from the header", () => {
    expect(extractConversation(load("conversation"), CONVERSATION_URL)).toEqual(
      {
        conversationId: {
          status: "found",
          value: "personal-1234567-7654321",
          source: "conversation.url",
        },
        memberId: {
          status: "found",
          value: "1234567",
          source: "conversation.memberId",
        },
        verificationCode: {
          status: "found",
          value: 3,
          source: "conversation.verificationCode",
        },
        genderCode: {
          status: "found",
          value: 1,
          source: "conversation.genderCode",
        },
        descriptionWordCount: {
          status: "found",
          value: 4,
          source: "conversation.profileDescription",
        },
      },
    );
  });

  it("ignores a header that still shows the previous conversation", () => {
    // Client-side switch: the URL names a new conversation, the old header is
    // still rendered.
    const result = extractConversation(
      load("conversation"),
      "https://www.joyclub.de/clubmail/conversation/conversation-wrapper-personal-5555555-7654321/",
    );
    expect(result.conversationId).toMatchObject({
      status: "found",
      value: "personal-5555555-7654321",
    });
    for (const field of [
      result.memberId,
      result.verificationCode,
      result.genderCode,
      result.descriptionWordCount,
    ])
      expect(field).toMatchObject({
        status: "missing",
        source: expect.stringContaining("header-not-matched-to-url"),
      });
  });

  it("reports missing fields on an unrendered page", () => {
    const result = extractConversation(document, CONVERSATION_URL);
    expect(result.memberId.status).toBe("missing");
    expect(result.descriptionWordCount.status).toBe("missing");
    expect(result.conversationId.status).toBe("found");
  });
});

describe("F1/F9 extraction from the verified profile", () => {
  it("reads member ID, photo count and word count; join date stays missing", () => {
    const result = extractProfile(load("profile"), PROFILE_URL);
    expect(result).toMatchObject({
      memberId: { status: "found", value: "1234567" },
      verificationCode: { status: "found", value: 3 },
      photoCount: { status: "found", value: 12 },
      // The main text only: the five motto words are not counted.
      profileWordCount: { status: "found", value: 8 },
      joinedAt: { status: "missing" },
    });
  });

  it("reads the membership duration as a join window", () => {
    const now = new Date("2026-09-23T00:00:00.000Z");
    const result = extractProfile(load("profile"), PROFILE_URL, now);
    // "Angemeldet seit 11 Monaten", widened one unit either side.
    expect(result.joinedWindow).toEqual({
      status: "found",
      value: {
        earliest: "2025-09-23T00:00:00.000Z",
        latest: "2025-11-23T00:00:00.000Z",
      },
      source: "profile.memberSince",
    });
    expect(result.joinedAt.status).toBe("missing");
  });

  it("clamps calendar subtraction to the end of a shorter month", () => {
    const window = joinWindowFromDuration(
      { count: 2, unit: "month" },
      new Date("2026-03-31T12:00:00.000Z"),
    );
    // Latest = 1 month ago (widened), clamped to the end of February.
    expect(window.latest).toBe("2026-02-28T12:00:00.000Z");
    expect(window.earliest).toBe("2025-12-31T12:00:00.000Z");
    const leap = joinWindowFromDuration(
      { count: 2, unit: "year" },
      new Date("2028-02-29T00:00:00.000Z"),
    );
    expect(leap.latest).toBe("2027-02-28T00:00:00.000Z");
    expect(leap.earliest).toBe("2025-02-28T00:00:00.000Z");
  });

  it("parses each membership duration form and rejects others", () => {
    expect(parseMemberSince("Angemeldet seit 11 Monaten")).toEqual({
      count: 11,
      unit: "month",
    });
    expect(parseMemberSince("  Angemeldet   seit 2 Jahren ")).toEqual({
      count: 2,
      unit: "year",
    });
    expect(parseMemberSince("Angemeldet seit einem Jahr")).toEqual({
      count: 1,
      unit: "year",
    });
    expect(parseMemberSince("Angemeldet seit einer Woche")).toEqual({
      count: 1,
      unit: "week",
    });
    expect(parseMemberSince("Angemeldet seit 5 Tagen")).toEqual({
      count: 5,
      unit: "day",
    });
    for (const text of [
      "Member since 11 months",
      "Angemeldet seit heute",
      "Angemeldet seit 11 Monaten und 2 Tagen",
      "Angemeldet seit Januar",
    ])
      expect(parseMemberSince(text), text).toBeUndefined();
  });

  it("reports an unexpected membership text as invalid", () => {
    load("profile");
    const badge = Array.from(
      document.querySelectorAll(
        ".profile-sidebar-container__badge-list j-list-item",
      ),
    ).find((item) => item.textContent?.includes("Angemeldet"));
    if (badge) badge.textContent = "Angemeldet seit kurzem";
    expect(extractProfile(document, PROFILE_URL).joinedWindow.status).toBe(
      "invalid",
    );
  });

  it("parses the singular photo label and rejects an unexpected one", () => {
    load("profile");
    const badge = document.querySelector(".amount-badge");
    badge?.setAttribute("aria-label", "1 Foto");
    expect(extractProfile(document, PROFILE_URL).photoCount).toMatchObject({
      status: "found",
      value: 1,
    });
    badge?.setAttribute("aria-label", "Fotos ansehen");
    expect(extractProfile(document, PROFILE_URL).photoCount.status).toBe(
      "invalid",
    );
  });

  it("keeps the word count missing when no main text rendered", () => {
    load("profile");
    document.querySelector(".profile-description-maintext__text")?.remove();
    // The motto is still on the page, but it is not the main text.
    expect(extractProfile(document, PROFILE_URL).profileWordCount.status).toBe(
      "missing",
    );
  });

  it("counts no text outside the main text block", () => {
    load("profile");
    const mainText = document.querySelector(
      ".profile-description-maintext__text",
    );
    mainText?.insertAdjacentHTML(
      "beforebegin",
      "<p>Four more outside words</p>",
    );
    mainText?.insertAdjacentHTML("afterend", "<div>Two more</div>");
    expect(extractProfile(document, PROFILE_URL).profileWordCount).toEqual({
      status: "found",
      value: 8,
      source: "profile.mainText",
    });
  });
});

describe("M1 on verified profile data", () => {
  it("maps only JoyClub's own verification code as verified", () => {
    const code = (value: number) =>
      verificationFromCode({ status: "found", value, source: "t" });
    // 1 = grey "geprüft": verified by JoyClub.
    expect(code(1)).toBe(true);
    // 3 = green "persönlich bekannt" is the viewer's own mark; it hides
    // JoyClub's verification, which is then unknown.
    for (const value of [0, 2, 3, 4])
      expect(code(value), String(value)).toBe("unknown");
    expect(verificationFromCode({ status: "missing", source: "t" })).toBe(
      "unknown",
    );
  });

  it("maps the confirmed profile type codes", () => {
    const code = (value: number) =>
      profileTypeFromCode({ status: "found", value, source: "t" });
    expect(code(1)).toBe("man");
    expect(code(2)).toBe("woman");
    expect(code(3)).toBe("couple");
    for (const value of [0, 4]) expect(code(value)).toBe("unknown");
    expect(profileTypeFromCode({ status: "missing", source: "t" })).toBe(
      "unknown",
    );
  });

  it("reads personally known as its own signal", () => {
    const code = (value: number) =>
      personallyKnownFromCode({ status: "found", value, source: "t" });
    expect(code(3)).toBe(true);
    // Grey means not personally known: green would replace it otherwise.
    expect(code(1)).toBe(false);
    for (const value of [0, 2, 4])
      expect(code(value), String(value)).toBe("unknown");
    expect(personallyKnownFromCode({ status: "missing", source: "t" })).toBe(
      "unknown",
    );
  });

  it("scores extracted facts and leaves hidden or missing facts unknown", () => {
    const extracted = extractProfile(load("profile"), PROFILE_URL);
    const value = <T>(result: { status: string; value?: T }) =>
      result.status === "found" ? (result.value as T) : ("unknown" as const);
    const merged = mergeProfileFacts({
      verification: verificationFromCode(extracted.verificationCode),
      personallyKnown: personallyKnownFromCode(extracted.verificationCode),
      photoCount: value<number>(extracted.photoCount),
      profileWordCount: value<number>(extracted.profileWordCount),
      joinedAt: value<string>(extracted.joinedAt),
      joinedWindow: value<{ earliest: string; latest: string }>(
        extracted.joinedWindow,
      ),
    });
    const result = evaluateQualification({
      facts: merged.facts,
      sources: merged.sources,
      criteria: {
        requireVerification: true,
        requirePersonallyKnown: true,
        minimumPhotoCount: 3,
        minimumProfileWordCount: 8,
        minimumAccountAgeDays: 30,
      },
    });
    expect(result.criteria.map(({ name, state }) => [name, state])).toEqual([
      // The fixture shows code 3 ("persönlich bekannt"), which hides
      // JoyClub's verification but passes the personally-known criterion.
      ["verification", "unknown"],
      ["personallyKnown", "pass"],
      ["photoCount", "pass"],
      ["profileWordCount", "pass"],
      // "Angemeldet seit 11 Monaten" is at least ten months: above 30 days.
      ["accountAge", "pass"],
    ]);
    // Verification is still unknown (hidden by the green shield).
    expect(result.outcome).toBe("partial-information");
  });
});

describe("F2 diagnostics flag", () => {
  it("follows storage changes after the initial read", async () => {
    let listener:
      | ((
          changes: Record<string, { newValue?: unknown }>,
          area: string,
        ) => void)
      | undefined;
    const flag = new DiagnosticsFlag(
      async () => ({ [DIAGNOSTICS_KEY]: true }),
      { addListener: (added) => (listener = added) },
    );
    await flag.ready;
    expect(flag.enabled).toBe(true);
    listener?.({ [DIAGNOSTICS_KEY]: {} }, "local");
    expect(flag.enabled).toBe(false);
    listener?.({ [DIAGNOSTICS_KEY]: { newValue: true } }, "sync");
    expect(flag.enabled).toBe(false);
    listener?.({ [DIAGNOSTICS_KEY]: { newValue: true } }, "local");
    expect(flag.enabled).toBe(true);
  });

  it("keeps a change made while the initial read is pending", async () => {
    for (const [initial, changed] of [
      [true, undefined],
      [false, true],
    ] as const) {
      let listener:
        | ((
            changes: Record<string, { newValue?: unknown }>,
            area: string,
          ) => void)
        | undefined;
      let resolveRead: (value: Record<string, unknown>) => void = () => {};
      const flag = new DiagnosticsFlag(
        () => new Promise((resolve) => (resolveRead = resolve)),
        { addListener: (added) => (listener = added) },
      );
      listener?.({ [DIAGNOSTICS_KEY]: { newValue: changed } }, "local");
      resolveRead({ [DIAGNOSTICS_KEY]: initial });
      await flag.ready;
      expect(flag.enabled).toBe(changed === true);
    }
  });

  it("stays off when storage cannot be read", async () => {
    const flag = new DiagnosticsFlag(async () => {
      throw new Error("synthetic storage failure");
    });
    await flag.ready;
    expect(flag.enabled).toBe(false);
  });

  it("M10: a default-on flag (the template picker) is off only when false", async () => {
    const key = "joyfox.templatePicker";
    let listener:
      | ((
          changes: Record<string, { newValue?: unknown }>,
          area: string,
        ) => void)
      | undefined;
    const flag = new DiagnosticsFlag(
      async () => ({}),
      { addListener: (added) => (listener = added) },
      key,
      true,
    );
    expect(flag.enabled).toBe(true);
    await flag.ready;
    expect(flag.enabled).toBe(true);
    listener?.({ [key]: { newValue: false } }, "local");
    expect(flag.enabled).toBe(false);
    // Removing the key restores the default.
    listener?.({ [key]: {} }, "local");
    expect(flag.enabled).toBe(true);
    const failing = new DiagnosticsFlag(
      async () => {
        throw new Error("synthetic storage failure");
      },
      undefined,
      key,
      true,
    );
    await failing.ready;
    expect(failing.enabled).toBe(true);
  });
});
