// @vitest-environment jsdom
import "../setup-indexeddb";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { registerNotesHandlers } from "../../src/background/notes-handlers";
import { registerSignalsHandlers } from "../../src/background/signals-handlers";
import {
  CardSignals,
  HIDE_ATTRIBUTE,
  INCOMPLETE_ATTRIBUTE,
  messageSignalsClient,
} from "../../src/content/card-signals";
import { messageNotesClient } from "../../src/content/member-notes";
import { setLocale } from "../../src/i18n/translator";
import { MessageRouter } from "../../src/messaging/router";
import { NotesService } from "../../src/notes/notes-service";
import { completeness } from "../../src/signals/completeness";
import { SignalsService } from "../../src/signals/signals-service";
import { NOTES_REVISION_KEY } from "../../src/storage/notes-revision";
import { repositories } from "../../src/storage/repositories";
import { MemorySettingsArea } from "../memory-settings";
import { freshDatabase } from "../setup-indexeddb";

// Shapes from docs/live-evidence (03-profile.md, 11-search.md, 01-inbox.md,
// 14-events.md); every value is invented.
const now = "2026-09-26T10:00:00.000Z";
const FULL = "2222222"; // known and complete
const THIN = "3333333"; // known and incomplete
const NEW = "4444444"; // never opened
let active: string | undefined;
let settings: MemorySettingsArea;
let signals: CardSignals;
let router: MessageRouter;

beforeEach(async () => {
  await freshDatabase();
  for (const id of ["account-a", "account-b"])
    await repositories.extensionAccounts.put(id, {
      id,
      accountId: id,
      joyClubAccountId: `synthetic-${id}`,
      createdAt: now,
      updatedAt: now,
    });
  active = "account-a";
  settings = new MemorySettingsArea();
  router = new MessageRouter();
  registerNotesHandlers(router, {
    notes: new NotesService(),
    activeAccountId: () => Promise.resolve(active),
    settings,
  });
  registerSignalsHandlers(router, {
    signals: new SignalsService(),
    activeAccountId: () => Promise.resolve(active),
  });
  signals = new CardSignals(
    document,
    messageSignalsClient((message) => router.route(message)),
    messageNotesClient((message) => router.route(message)),
  );
  const snapshot = (memberId: string, photos: number, words: number) =>
    repositories.profileSnapshots.put("account-a", {
      id: `snapshot:${memberId}`,
      accountId: "account-a",
      memberId,
      capturedAt: now,
      verification: true,
      photoCount: photos,
      profileWordCount: words,
      joinedAt: "unknown",
      createdAt: now,
      updatedAt: now,
    });
  await snapshot(FULL, 5, 120);
  await snapshot(THIN, 1, 20);
  for (const n of [1, 2])
    await repositories.trustSignals.put("account-a", {
      id: `trust:${n}`,
      accountId: "account-a",
      memberId: FULL,
      kind: "positive",
      occurredAt: now,
      createdAt: now,
      updatedAt: now,
    });
});

afterEach(() => {
  document.body.replaceChildren();
  setLocale("en");
});

const flush = async () => {
  for (let round = 0; round < 12; round += 1)
    await new Promise((resolve) => setTimeout(resolve, 0));
};

function profilePage(memberId: string) {
  window.history.replaceState(null, "", `/profile/${memberId}.synthetic.html`);
  document.body.innerHTML = `<div data-e2e="profile-header-base-info">NAME</div>`;
}

function searchPage(members: string[]) {
  window.history.replaceState(null, "", "/member/");
  document.body.innerHTML = `<div class="member_search_list"><div class="grid">${members
    .map(
      (member) =>
        `<div class="item"><a data-e2e="result-item" href="/profile/${member}.synthetic.html"><j-member-card verification-status="1"></j-member-card></a></div>`,
    )
    .join("")}</div></div>`;
}

function inboxPage(members: string[]) {
  window.history.replaceState(null, "", "/clubmail/");
  document.body.innerHTML = `<div class="cm-conversation-list">${members
    .map(
      (member) =>
        `<j-list-item class="cm-conversation-list-item"><j-avatar-image class="cm-conversation-list-item__avatar" href="/profile/${member}.synthetic.html"></j-avatar-image><div class="cm-conversation-list-item__name" data-e2e="conversation-list-item-name">NAME</div></j-list-item>`,
    )
    .join("")}</div>`;
}

function guestPage(members: string[]) {
  window.history.replaceState(null, "", "/event/7777777.synthetic.html");
  document.body.innerHTML = `<h1 class="event_name">Synthetic party</h1><div class="tab-pane" id="guest_alle">${members
    .map(
      (member) =>
        `<div class="ha_2"><a class="card normal" href="/profile/${member}.synthetic.html"><div class="date_moreinfo"><strong>NAME</strong></div></a></div>`,
    )
    .join("")}</div>`;
}

const group = (member: string) =>
  document.querySelector<HTMLElement>(
    `[data-joyfox-ui="card-signals"][data-member="${member}"]`,
  );
const shown = (member: string) => ({
  completeness:
    group(member)?.querySelector(".joyfox-signals__completeness")
      ?.textContent ?? null,
  trust:
    group(member)?.querySelector(".joyfox-signals__trust")?.textContent ?? null,
  tags: Array.from(
    group(member)?.querySelectorAll(".joyfox-signals__tag") ?? [],
    (tag) => tag.textContent,
  ),
});
const editor = () =>
  document.querySelector<HTMLElement>('[data-joyfox-ui="card-editor"]')!;
const editorButton = (text: string) =>
  Array.from(editor().querySelectorAll("button")).find(
    (node) => node.textContent === text,
  )!;
const type = (field: HTMLTextAreaElement | HTMLInputElement, text: string) => {
  field.value = text;
  field.dispatchEvent(new Event("input", { bubbles: true }));
};

describe("V1-10 completeness", () => {
  it("is incomplete below 3 photos or 50 words, complete at both, else unknown", () => {
    const state = (photoCount: number | "unknown", words: number | "unknown") =>
      completeness({
        photoCount,
        profileWordCount: words,
        verification: "unknown",
      }).state;
    expect(state(3, 50)).toBe("complete");
    expect(state(2, 500)).toBe("incomplete");
    expect(state(9, 49)).toBe("incomplete");
    expect(state(1, "unknown")).toBe("incomplete");
    expect(state(3, "unknown")).toBe("unknown");
    expect(state("unknown", "unknown")).toBe("unknown");
  });
});

describe("V1-10 signals on every card", () => {
  it("shows on each surface the same signals as the member's profile page", async () => {
    await new NotesService().addTag(
      "account-a",
      { status: "resolved", memberId: FULL, source: "test" },
      "Met at party",
    );
    profilePage(FULL);
    signals.update("profile");
    await flush();
    const profile = document.querySelector(
      '[data-joyfox-ui="completeness"]',
    )?.textContent;
    expect(profile).toBe("Complete: 5 photos, 120 words, verified");
    const expected = {
      completeness: profile,
      trust: "Trust +2",
      tags: ["Met at party"],
    };
    for (const [page, type] of [
      [() => searchPage([FULL]), "search"],
      [() => inboxPage([FULL]), "inbox"],
      [() => guestPage([FULL]), "event"],
    ] as const) {
      page();
      signals.update(type);
      await flush();
      expect(shown(FULL), type).toEqual(expected);
    }
  });

  it("marks an unknown member unknown, never incomplete", async () => {
    searchPage([NEW]);
    signals.update("search");
    await flush();
    expect(shown(NEW)).toEqual({
      completeness:
        // The card's own shield says verified (11-search.md).
        "Completeness unknown: photos unknown, words unknown, verified",
      trust: "No trust history",
      tags: [],
    });
  });

  it("hides only the loaded results known to be incomplete", async () => {
    searchPage([FULL, THIN, NEW]);
    signals.update("search");
    await flush();
    const item = (member: string) =>
      document.querySelector(`a[href*="${member}"]`)!.parentElement!;
    const toggle = document.querySelector<HTMLInputElement>(
      "#joyfox-hide-incomplete",
    )!;
    expect(toggle.checked).toBe(false);
    expect(item(THIN).getAttribute(INCOMPLETE_ATTRIBUTE)).toBe("yes");
    expect(document.querySelector(`[${HIDE_ATTRIBUTE}]`)).toBeNull();
    toggle.checked = true;
    toggle.dispatchEvent(new Event("change"));
    expect(item(THIN).parentElement?.getAttribute(HIDE_ATTRIBUTE)).toBe("on");
    expect(item(FULL).hasAttribute(INCOMPLETE_ATTRIBUTE)).toBe(false);
    expect(item(NEW).hasAttribute(INCOMPLETE_ATTRIBUTE)).toBe(false);
    expect(
      document.querySelector(".joyfox-signals-filter")?.textContent,
    ).toContain("1 of 3 loaded profiles hidden.");
  });

  it("saves a tag from a search result that then shows on the guest list", async () => {
    searchPage([NEW]);
    signals.update("search");
    await flush();
    group(NEW)!
      .querySelector<HTMLButtonElement>(".joyfox-signals__note")!
      .click();
    await flush();
    type(
      editor().querySelector<HTMLInputElement>(".joyfox-card-editor__tag")!,
      "Kind",
    );
    editorButton("Add tag").click();
    await flush();
    expect(editor().textContent).toContain("Tag added.");
    expect(settings.items.get(NOTES_REVISION_KEY)).toBeDefined();
    // The notes revision reaches this tab; then the page moves on.
    signals.invalidate();
    guestPage([NEW]);
    signals.update("event");
    await flush();
    expect(shown(NEW).tags).toEqual(["Kind"]);
  });

  it("creates and edits a note and a tag from a guest entry, for the member's profile ID", async () => {
    guestPage([THIN]);
    signals.update("event");
    await flush();
    const open = () =>
      group(THIN)!
        .querySelector<HTMLButtonElement>(".joyfox-signals__note")!
        .click();
    expect(
      group(THIN)?.querySelector(".joyfox-signals__note")?.textContent,
    ).toBe("Add note");
    open();
    await flush();
    const note = () =>
      editor().querySelector<HTMLTextAreaElement>(".joyfox-card-editor__note")!;
    type(note(), "First impression");
    editorButton("Save note").click();
    await flush();
    expect(editor().textContent).toContain("Note saved.");
    type(note(), "Second impression");
    editorButton("Save note").click();
    await flush();
    type(
      editor().querySelector<HTMLInputElement>(".joyfox-card-editor__tag")!,
      "Bold",
    );
    editorButton("Add tag").click();
    await flush();
    const [stored] = await repositories.userNotes.list("account-a");
    expect(stored).toMatchObject({ memberId: THIN, body: "Second impression" });
    const tags = await repositories.userTags.list("account-a");
    expect(tags.map((tag) => [tag.memberId, tag.label])).toEqual([
      [THIN, "Bold"],
    ]);
    editorButton("Close").click();
    expect(document.querySelector('[data-joyfox-ui="card-editor"]')).toBeNull();
    signals.invalidate();
    await flush();
    expect(
      group(THIN)?.querySelector(".joyfox-signals__note")?.textContent,
    ).toBe("Note");
  });

  it("clears at once on an account switch, and draws in the language shown", async () => {
    searchPage([FULL]);
    signals.update("search");
    await flush();
    setLocale("de");
    signals.localeChanged();
    expect(shown(FULL).completeness).toBe(
      "Vollständig: 5 Fotos, 120 Wörter, geprüft",
    );
    active = "account-b";
    signals.accountChanged();
    expect(group(FULL)).toBeNull();
    await flush();
    // Account B knows nothing of this member.
    expect(shown(FULL).completeness).toBe(
      "Vollständigkeit unbekannt: Fotos unbekannt, Wörter unbekannt, geprüft",
    );
  });

  it("writes nothing when the page did not change, so no redraw loop starts", async () => {
    searchPage([FULL, THIN]);
    signals.update("search");
    await flush();
    const observer = new MutationObserver(() => undefined);
    observer.observe(document.body, {
      subtree: true,
      childList: true,
      attributes: true,
    });
    signals.update("search");
    await flush();
    expect(observer.takeRecords()).toEqual([]);
    observer.disconnect();
  });

  it("rejects malformed input", async () => {
    for (const members of [
      "2222222",
      [{ memberId: "x" }],
      [{ memberId: FULL, observed: "shield" }],
      Array.from({ length: 501 }, () => ({ memberId: FULL })),
    ]) {
      const response = await router.route({
        type: "signals.lookup",
        requestId: "r",
        payload: { members },
      } as never);
      expect(response.ok, JSON.stringify(members).slice(0, 30)).toBe(false);
    }
  });
});
