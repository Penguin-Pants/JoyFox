// @vitest-environment jsdom
import "../setup-indexeddb";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { registerNotesHandlers } from "../../src/background/notes-handlers";
import { registerSignalsHandlers } from "../../src/background/signals-handlers";
import {
  CardSignals,
  HIDE_ATTRIBUTE,
  INCOMPLETE_ATTRIBUTE,
  messageSignalsClient,
  type MemberName,
} from "../../src/content/card-signals";
import { CardNoteEditor } from "../../src/content/card-note-editor";
import {
  messageNotesClient,
  NOTES_TEXT,
  type NotesClient,
} from "../../src/content/member-notes";
import { setLocale, t } from "../../src/i18n/translator";
import { MessageRouter } from "../../src/messaging/router";
import { NotesService } from "../../src/notes/notes-service";
import { completeness } from "../../src/signals/completeness";
import { SignalsService } from "../../src/signals/signals-service";
import { TriageService } from "../../src/triage/triage-service";
import { NOTES_REVISION_KEY } from "../../src/storage/notes-revision";
import { registerMemberHandlers } from "../../src/background/member-handlers";
import { repositories } from "../../src/storage/repositories";
import { MemorySettingsArea } from "../memory-settings";
import { freshDatabase } from "../setup-indexeddb";
import contentCss from "../../src/content/content.css?raw";

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
  registerMemberHandlers(router, {
    activeAccountId: () => Promise.resolve(active),
    now: () => now,
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
        `<j-list-item class="cm-conversation-list-item"><j-avatar-image slot="image" class="cm-conversation-list-item__avatar" href="/profile/${member}.synthetic.html"></j-avatar-image><div class="cm-conversation-list-item__line"><div class="cm-conversation-list-item__name" data-e2e="conversation-list-item-name">NAME</div></div><div slot="description" class="cm-conversation-list-item__line cm-conversation-list-item__line--description"><div class="cm-conversation-list-item__text">TEXT</div></div></j-list-item>`,
    )
    .join("")}</div>`;
}

function guestPage(members: string[]) {
  window.history.replaceState(null, "", "/event/7777777.synthetic.html");
  document.body.innerHTML = `<h1 class="event_name">Synthetic party</h1><div class="tab-pane" id="guest_alle">${members
    .map(
      (member) =>
        `<div class="ha_2"><a class="card normal" href="/profile/${member}.synthetic.html"><div class="date_info"><div class="date_moreinfo"><strong>NAME</strong></div><div>AGE</div></div></a></div>`,
    )
    .join("")}</div>`;
}

const group = (member: string) =>
  document.querySelector<HTMLElement>(
    `[data-joyfox-ui="card-signals"][data-member="${member}"]`,
  );
/** A chip's full text: a chip shows a short one and holds this one too. */
const full = (node: Element | null | undefined) =>
  node
    ? (node.querySelector(".joyfox-visually-hidden")?.textContent ??
      node.textContent)
    : null;
const shown = (member: string) => ({
  completeness: full(
    group(member)?.querySelector(".joyfox-signals__completeness"),
  ),
  trust: full(group(member)?.querySelector(".joyfox-signals__trust")),
  // The tags chip shows a count; its full text names them.
  tags:
    full(group(member)?.querySelector(".joyfox-signals__tags"))
      ?.replace(/^Your tags: /u, "")
      .split(", ") ?? [],
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
    // A group in the member strip, which is the page's one JoyFox region.
    expect(
      document
        .querySelector('[data-joyfox-ui="completeness"]')
        ?.getAttribute("role"),
    ).toBe("group");
    // The chip shows "Trust +2"; its tooltip and screen-reader text use the
    // member strip's words.
    const expected = {
      completeness: profile,
      trust: "Local trust score: 2.",
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
      // On the card's own JoyFox line, never inside JoyClub's name box.
      expect(
        group(FULL)?.parentElement?.getAttribute("data-joyfox-ui"),
        type,
      ).toBe("card-line");
      if (type === "search") {
        // Over the photo, in the card's own slot: after the card, the line
        // overflowed the grid row and the next row covered it.
        const line = group(FULL)!.parentElement!;
        expect(line.parentElement?.tagName).toBe("J-MEMBER-CARD");
        expect(line.getAttribute("slot")).toBe("media-overlay");
      }
    }
  });

  it("puts an inbox row's signals on the row's own JoyFox line, in short", async () => {
    await new NotesService().addTag(
      "account-a",
      { status: "resolved", memberId: FULL, source: "test" },
      "Met at party",
    );
    inboxPage([FULL]);
    signals.update("inbox");
    await flush();
    const row = document.querySelector(".cm-conversation-list-item")!;
    const line = row.querySelector('[data-joyfox-ui="card-line"]')!;
    // Between JoyClub's name line and its description line, in the same slot
    // as the description, so the name line keeps only JoyClub's own content.
    expect(line.getAttribute("slot")).toBe("description");
    expect(line.previousElementSibling?.className).toBe(
      "cm-conversation-list-item__line",
    );
    expect(line.nextElementSibling?.className).toContain(
      "cm-conversation-list-item__line--description",
    );
    expect(
      row.querySelector(".cm-conversation-list-item__line")?.children,
    ).toHaveLength(1);
    expect(line.firstElementChild).toBe(group(FULL));
    const chips = Array.from(
      group(FULL)!.querySelectorAll(".joyfox-badge, .joyfox-button"),
    );
    expect(
      chips.map(
        (chip) =>
          chip.querySelector('[aria-hidden="true"]')?.textContent ??
          chip.textContent,
      ),
    ).toEqual(["Complete", "Trust +2", "✎", "1 tag"]);
    const completenessChip = chips[0] as HTMLElement;
    expect(completenessChip.title).toBe(
      "Complete: 5 photos, 120 words, verified",
    );
    expect((chips[2] as HTMLElement).getAttribute("aria-label")).toBe(
      "Add note",
    );
  });

  it("gives each control on the card line at least 24 px, within its 18 px line", async () => {
    // Owner's live check, item 126: a near miss on "✎" opened the profile.
    const style = document.createElement("style");
    style.textContent = contentCss;
    document.head.append(style);
    try {
      inboxPage([FULL]);
      signals.update("inbox");
      await flush();
      const note = group(FULL)!.querySelector(".joyfox-signals__note")!;
      const line = group(FULL)!.parentElement!;
      expect(getComputedStyle(note).minWidth).toBe("24px");
      expect(getComputedStyle(note).textAlign).toBe("center");
      expect(getComputedStyle(line).height).toBe("18px");
    } finally {
      style.remove();
    }
  });

  it("keeps an inbox row's note button icon-only when a note exists", async () => {
    await new NotesService().saveNote(
      "account-a",
      { status: "resolved", memberId: FULL, source: "test" },
      "Synthetic note",
    );
    inboxPage([FULL]);
    signals.update("inbox");
    await flush();
    const note = group(FULL)!.querySelector<HTMLElement>(
      ".joyfox-signals__note",
    )!;
    expect(note.textContent).toBe("✎");
    expect(note.getAttribute("aria-label")).toBe("Note");
    expect(note.title).toBe("Note");
    expect(note.getAttribute("data-has-note")).toBe("true");
  });

  it("keeps the nickname each card shows, and names the member in the editor", async () => {
    // Owner decision, 2026-09-27: JoyFox's own texts name a member by the
    // nickname a card showed, never by the number.
    searchPage([FULL]);
    document
      .querySelector("j-member-card")!
      .setAttribute("user-name", "Synthetic_Owl");
    signals.update("search");
    await flush();
    inboxPage([THIN]);
    document.querySelector(
      '[data-e2e="conversation-list-item-name"]',
    )!.textContent = " Synthetic  Heron ";
    signals.update("inbox");
    await flush();
    guestPage([NEW]);
    document.querySelector(".date_moreinfo strong")!.textContent =
      "Synthetic_Kite";
    signals.update("event");
    await flush();
    const stored = async (memberId: string) =>
      (await repositories.joyClubMembers.get("account-a", memberId))?.nickname;
    expect(await stored(FULL)).toBe("Synthetic_Owl");
    expect(await stored(THIN)).toBe("Synthetic Heron");
    expect(await stored(NEW)).toBe("Synthetic_Kite");
    expect(await repositories.joyClubMembers.list("account-b")).toEqual([]);

    group(NEW)!
      .querySelector<HTMLButtonElement>(".joyfox-signals__note")!
      .click();
    await flush();
    expect(editor().getAttribute("aria-label")).toBe(
      "JoyFox: note and tags for Synthetic_Kite",
    );
    expect(editor().textContent).not.toContain(NEW);
  });

  it('gives a guest entry the "met in person" mark the profile page last showed', async () => {
    const triage = new TriageService(
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      settings,
    );
    const card = (code: number) => {
      window.history.replaceState(null, "", "/member/");
      document.body.innerHTML = `<div class="member_search_list"><div class="grid"><div class="item"><a data-e2e="result-item" href="/profile/${FULL}.synthetic.html"><j-member-card verification-status="${code}"></j-member-card></a></div></div></div>`;
      signals.update("search");
    };
    // The guest page is open when the change reaches the tab (a triage
    // revision invalidates the page shown).
    const guest = async () => {
      guestPage([FULL]);
      signals.update("event");
      signals.invalidate();
      await flush();
      return shown(FULL).trust;
    };
    // The profile page shows the green shield (code 3): met in person.
    await triage.captureSnapshot("account-a", FULL, {
      photoCount: 5,
      personallyKnown: true,
    });
    card(3);
    await flush();
    const marked = shown(FULL).trust;
    // The mark counts: the two positive outcomes alone give +2.
    expect(marked).not.toBe("Local trust score: 2.");
    expect(await guest()).toBe(marked);
    // A card whose shield code JoyFox does not know stays unknown: only a
    // card with no shield at all takes the stored mark.
    signals.invalidate();
    card(2);
    await flush();
    expect(shown(FULL).trust).toBe("Local trust score: 2.");
    // The mark is removed on JoyClub: the next profile read shows no shield,
    // and the guest entry follows.
    await triage.captureSnapshot("account-a", FULL, { photoCount: 5 });
    expect(await guest()).toBe("Local trust score: 2.");
  });

  it("words the trust chip's full text as the member strip does, in both languages", async () => {
    searchPage([FULL, NEW]);
    signals.update("search");
    await flush();
    const chip = (member: string) =>
      group(member)!.querySelector<HTMLElement>(".joyfox-signals__trust")!;
    const short = (member: string) =>
      chip(member).querySelector('[aria-hidden="true"]')?.textContent;
    // The line has room for the short text only; the tooltip says it fully.
    expect(short(FULL)).toBe("Trust +2");
    expect(chip(FULL).title).toBe("Local trust score: 2.");
    expect(short(NEW)).toBe("Trust –");
    expect(chip(NEW).title).toBe("Local trust score: no history yet.");
    setLocale("de");
    signals.localeChanged();
    expect(short(FULL)).toBe("Vertrauen +2");
    expect(chip(FULL).title).toBe("Lokaler Vertrauenswert: 2.");
    expect(full(chip(NEW))).toBe(
      "Lokaler Vertrauenswert: noch keine Einträge.",
    );
  });

  it("keeps focus on a note button when its chips are drawn again", async () => {
    searchPage([FULL]);
    signals.update("search");
    await flush();
    const noteButton = () =>
      group(FULL)!.querySelector<HTMLButtonElement>(".joyfox-signals__note")!;
    const first = noteButton();
    first.focus();
    // Another tab adds a tag: the chips are drawn again.
    await new NotesService().addTag(
      "account-a",
      { status: "resolved", memberId: FULL, source: "test" },
      "New",
    );
    signals.invalidate();
    await flush();
    expect(shown(FULL).tags).toEqual(["New"]);
    expect(noteButton()).not.toBe(first);
    expect(document.activeElement).toBe(noteButton());
  });

  it("marks an unknown member unknown, never incomplete", async () => {
    searchPage([NEW]);
    signals.update("search");
    await flush();
    expect(shown(NEW)).toEqual({
      completeness:
        // The card's own shield says verified (11-search.md).
        "Completeness unknown: photos unknown, words unknown, verified",
      trust: "Local trust score: no history yet.",
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
      group(THIN)
        ?.querySelector(".joyfox-signals__note")
        ?.getAttribute("aria-label"),
    ).toBe("Add note");
    // The line sits at the end of the entry's text block, after the name
    // box, which clips to one line.
    const line = group(THIN)!.parentElement!;
    expect(line.parentElement?.className).toBe("date_info");
    expect(line.parentElement?.lastElementChild).toBe(line);
    expect(line.closest(".date_moreinfo")).toBeNull();
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
      group(THIN)
        ?.querySelector(".joyfox-signals__note")
        ?.getAttribute("aria-label"),
    ).toBe("Note");
  });

  it("clears at once on an account switch, and draws in the language shown", async () => {
    searchPage([FULL]);
    signals.update("search");
    await flush();
    setLocale("de");
    signals.localeChanged();
    expect(shown(FULL).completeness).toBe(
      "Vollständig: 5 Fotos, 120 Wörter, verifiziert",
    );
    active = "account-b";
    signals.accountChanged();
    expect(group(FULL)).toBeNull();
    await flush();
    // Account B knows nothing of this member.
    expect(shown(FULL).completeness).toBe(
      "Vollständigkeit unbekannt: Fotos unbekannt, Wörter unbekannt, verifiziert",
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

  it("sends a refused nickname batch again, and follows a nickname changed in place", async () => {
    // Codex review on #80: a batch refused after an account switch is sent
    // again, and a card whose nickname changes redraws its note button.
    const real = messageSignalsClient((message) => router.route(message));
    const sent: string[] = [];
    let refuse = true;
    const client = {
      lookup: real.lookup,
      names: (accountId: string, names: MemberName[]) => {
        sent.push(...names.map((name) => name.nickname));
        if (refuse) return Promise.resolve({ status: "refused" as const });
        return real.names!(accountId, names);
      },
    };
    const cards = new CardSignals(
      document,
      client,
      messageNotesClient((message) => router.route(message)),
    );
    inboxPage([THIN]);
    const name = () =>
      document.querySelector('[data-e2e="conversation-list-item-name"]')!;
    name().textContent = "Synthetic_Heron";
    cards.update("inbox");
    await flush();
    refuse = false;
    cards.update("inbox");
    await flush();
    expect(sent).toEqual(["Synthetic_Heron", "Synthetic_Heron"]);
    expect(
      (await repositories.joyClubMembers.get("account-a", THIN))?.nickname,
    ).toBe("Synthetic_Heron");

    name().textContent = "Synthetic_Crane";
    cards.update("inbox");
    await flush();
    document
      .querySelector<HTMLButtonElement>(
        `[data-joyfox-ui="card-signals"][data-member="${THIN}"] .joyfox-signals__note`,
      )!
      .click();
    await flush();
    expect(editor().getAttribute("aria-label")).toBe(
      "JoyFox: note and tags for Synthetic_Crane",
    );
    expect(
      (await repositories.joyClubMembers.get("account-a", THIN))?.nickname,
    ).toBe("Synthetic_Crane");
  });

  it("asks again after a failed lookup once the shown cards change, not on a redraw", async () => {
    let calls = 0;
    let fail = true;
    const flaky = new CardSignals(
      document,
      {
        lookup: (members) => {
          calls += 1;
          if (fail) return Promise.reject(new Error("offline"));
          return messageSignalsClient((message) =>
            router.route(message),
          ).lookup(members);
        },
      },
      messageNotesClient((message) => router.route(message)),
    );
    searchPage([FULL]);
    flaky.update("search");
    await flush();
    flaky.update("search");
    await flush();
    expect(calls).toBe(1);
    fail = false;
    // JoyClub loads more results: another set of cards.
    searchPage([FULL, THIN]);
    flaky.update("search");
    await flush();
    expect(calls).toBe(2);
    expect(shown(THIN).completeness).toContain("Incomplete");
  });
});

describe("V1-10 card note editor", () => {
  const note = () =>
    editor().querySelector<HTMLTextAreaElement>(".joyfox-card-editor__note")!;
  const tag = () =>
    editor().querySelector<HTMLInputElement>(".joyfox-card-editor__tag")!;
  const status = () =>
    editor().querySelector(".joyfox-card-editor__status")?.textContent ?? "";
  const noteButton = (member: string) =>
    group(member)!.querySelector<HTMLButtonElement>(".joyfox-signals__note")!;
  const openFor = async (member: string) => {
    noteButton(member).focus();
    noteButton(member).click();
    await flush();
  };

  it("takes focus when it opens, adds a tag with Enter, and gives focus back to the member's note button", async () => {
    searchPage([FULL]);
    signals.update("search");
    await flush();
    const first = noteButton(FULL);
    first.focus();
    first.click();
    // The panel is at the end of the page: focus moves into it at once.
    expect(editor().contains(document.activeElement)).toBe(true);
    await flush();
    expect(document.activeElement).toBe(note());
    tag().focus();
    type(tag(), "Kind");
    const pageKeys = vi.fn();
    document.body.addEventListener("keydown", pageKeys);
    tag().dispatchEvent(
      new KeyboardEvent("keydown", { key: "Enter", bubbles: true }),
    );
    await flush();
    document.body.removeEventListener("keydown", pageKeys);
    expect(status()).toBe("Tag added.");
    expect(pageKeys).not.toHaveBeenCalled();
    expect(tag().value).toBe("");
    // The editor drew itself again; the tag box kept focus.
    expect(document.activeElement).toBe(tag());
    // The saved tag reaches this tab, and the card draws its chips again:
    // the button the editor opened from is gone.
    signals.invalidate();
    await flush();
    expect(first.isConnected).toBe(false);
    tag().dispatchEvent(
      new KeyboardEvent("keydown", { key: "Escape", bubbles: true }),
    );
    expect(document.querySelector('[data-joyfox-ui="card-editor"]')).toBeNull();
    expect(document.activeElement).toBe(noteButton(FULL));
  });

  it("keeps focus on its control when another tab changes the member and while a write runs", async () => {
    guestPage([THIN]);
    signals.update("event");
    await flush();
    await openFor(THIN);
    note().focus();
    type(note(), "Typed here");
    note().setSelectionRange(2, 2);
    await new NotesService().addTag(
      "account-a",
      { status: "resolved", memberId: THIN, source: "test" },
      "Other",
    );
    signals.invalidate();
    await flush();
    expect(editor().textContent).toContain("Other");
    expect(document.activeElement).toBe(note());
    expect(note().selectionStart).toBe(2);
    expect(note().value).toBe("Typed here");
    const remove = editor().querySelector<HTMLButtonElement>(
      'button[aria-label="Remove tag Other"]',
    )!;
    remove.focus();
    remove.click();
    // While the write runs, the button keeps focus and says it is not
    // available; the note box keeps its text but takes no input.
    expect(document.activeElement?.getAttribute("aria-label")).toBe(
      "Remove tag Other",
    );
    expect(document.activeElement?.getAttribute("aria-disabled")).toBe("true");
    expect(note().readOnly).toBe(true);
    await flush();
    expect(status()).toBe("Tag removed.");
    // The removed tag's button is gone; the tag box takes focus.
    expect(document.activeElement).toBe(tag());
    expect(note().readOnly).toBe(false);
    expect(note().value).toBe("Typed here");
  });

  it("shows the privacy note, discards typed text, and after a conflict shows the stored note", async () => {
    searchPage([FULL]);
    signals.update("search");
    await flush();
    await openFor(FULL);
    expect(editor().textContent).toContain(t(NOTES_TEXT.scope));
    const discard = () => editorButton("Discard my changes");
    expect(discard().disabled).toBe(true);
    type(note(), "Mine");
    expect(discard().disabled).toBe(false);
    // Another tab saves a note meanwhile.
    await new NotesService().saveNote(
      "account-a",
      { status: "resolved", memberId: FULL, source: "test" },
      "Theirs",
    );
    signals.invalidate();
    await flush();
    editorButton("Save note").click();
    await flush();
    // The notice points to "Discard my changes", which now exists here.
    expect(status()).toBe(t(NOTES_TEXT.conflict));
    expect(note().value).toBe("Mine");
    discard().focus();
    discard().click();
    expect(note().value).toBe("Theirs");
    expect(status()).toBe("");
    expect(discard().disabled).toBe(true);
    // The disabled button cannot keep focus; the note box takes it.
    expect(document.activeElement).toBe(note());
    expect((await repositories.userNotes.list("account-a"))[0]?.body).toBe(
      "Theirs",
    );
  });

  it("sends the note as typed, as the profile page's editor does", async () => {
    const sent: string[] = [];
    const client: NotesClient = {
      getNotes: () =>
        Promise.resolve({
          status: "ok",
          accountId: "account-a",
          note: null,
          tags: [],
        }),
      saveNote: (_account, _member, body) => {
        sent.push(body);
        return Promise.resolve({ status: "saved", current: body.trim() });
      },
      addTag: () => Promise.resolve(true),
      removeTag: () => Promise.resolve(true),
    };
    const cardEditor = new CardNoteEditor(document, client);
    cardEditor.open(FULL);
    await flush();
    type(note(), "  Spaced note \n");
    editorButton("Save note").click();
    await flush();
    expect(sent).toEqual(["  Spaced note \n"]);
    expect(status()).toBe("Note saved.");
    cardEditor.close();
  });

  it("says so when the member already has the tag", async () => {
    await new NotesService().addTag(
      "account-a",
      { status: "resolved", memberId: FULL, source: "test" },
      "Met twice",
    );
    searchPage([FULL]);
    signals.update("search");
    await flush();
    await openFor(FULL);
    type(tag(), "  met   TWICE ");
    editorButton("Add tag").click();
    await flush();
    expect(status()).toBe("Already tagged.");
    expect(tag().value).toBe("");
    expect(await repositories.userTags.list("account-a")).toHaveLength(1);
  });

  it("shows the note's length near the limit and says when a paste was cut", async () => {
    searchPage([FULL]);
    signals.update("search");
    await flush();
    await openFor(FULL);
    const length = () => editor().querySelector(".joyfox-note-length")!;
    const paste = (text: string) => {
      const event = new Event("paste", { bubbles: true, cancelable: true });
      Object.defineProperty(event, "clipboardData", {
        value: { getData: () => text },
      });
      note().dispatchEvent(event);
    };
    type(note(), "x".repeat(3599));
    expect(length().textContent).toBe("");
    type(note(), "x".repeat(3600));
    expect(length().textContent).toBe("3,600 of 4,000 characters");
    expect(note().getAttribute("aria-describedby")).toBe(length().id);
    note().setSelectionRange(3600, 3600);
    // A paste that fits says nothing; one that does not is cut by the
    // browser at the box's maxlength, and the editor says so.
    paste("y".repeat(400));
    expect(status()).toBe("");
    paste("y".repeat(401));
    expect(status()).toBe(
      "Only part of the pasted text fit. The rest was not pasted.",
    );
    expect(note().maxLength).toBe(4000);
  });

  it("says to choose an account when no JoyFox account is active", async () => {
    const cardEditor = new CardNoteEditor(document, {
      getNotes: () => Promise.resolve({ status: "no-account" }),
      saveNote: () => Promise.reject(new Error("unused")),
      addTag: () => Promise.reject(new Error("unused")),
      removeTag: () => Promise.reject(new Error("unused")),
    } as never);
    cardEditor.open(FULL);
    await flush();
    expect(editor().textContent).toContain(
      "Select or add an account in the JoyFox options to keep notes.",
    );
    cardEditor.close();
  });

  it("ignores its old controls while it reads the member again after a write", async () => {
    const answer = {
      status: "ok",
      accountId: "account-a",
      note: null,
      tags: [],
    };
    let reads = 0;
    let releaseRead: () => void = () => undefined;
    const added: string[] = [];
    const cardEditor = new CardNoteEditor(document, {
      getNotes: () => {
        reads += 1;
        if (reads === 1) return Promise.resolve(answer);
        // The read after the write is slow.
        return new Promise((resolve) => {
          releaseRead = () => resolve(answer);
        });
      },
      saveNote: () => Promise.reject(new Error("unused")),
      addTag: (_account: string, _member: string, label: string) => {
        added.push(label);
        return Promise.resolve(true);
      },
      removeTag: () => Promise.resolve(true),
    } as never);
    cardEditor.open(FULL);
    await flush();
    const tag = () =>
      editor().querySelector<HTMLInputElement>(".joyfox-card-editor__tag")!;
    type(tag(), "Kind");
    editorButton("Add tag").click();
    await flush();
    // The write is done; the read that redraws the controls is not.
    expect(reads).toBe(2);
    expect(editorButton("Add tag").getAttribute("aria-disabled")).toBe("true");
    editorButton("Add tag").click();
    tag().dispatchEvent(
      new KeyboardEvent("keydown", { key: "Enter", bubbles: true }),
    );
    await flush();
    expect(added).toEqual(["Kind"]);
    releaseRead();
    await flush();
    expect(editorButton("Add tag").getAttribute("aria-disabled")).toBeNull();
    cardEditor.close();
  });

  it("drops typed text when a reload answers for another account, and clears a read error that recovered", async () => {
    const answers: unknown[] = [
      Promise.reject(new Error("offline")),
      { status: "ok", accountId: "account-a", note: "A's note", tags: [] },
      { status: "ok", accountId: "account-b", note: null, tags: [] },
    ];
    const cardEditor = new CardNoteEditor(document, {
      getNotes: () => Promise.resolve(answers.shift()),
      saveNote: () => Promise.reject(new Error("unused")),
      addTag: () => Promise.resolve(true),
      removeTag: () => Promise.resolve(true),
    } as never);
    cardEditor.open(FULL);
    await flush();
    expect(editor().textContent).toContain("could not read");
    cardEditor.invalidate();
    await flush();
    expect(editor().textContent).not.toContain("could not read");
    const note = () =>
      editor().querySelector<HTMLTextAreaElement>(".joyfox-card-editor__note")!;
    type(note(), "Private to account A");
    type(
      editor().querySelector<HTMLInputElement>(".joyfox-card-editor__tag")!,
      "A tag",
    );
    // The account changed before this tab heard of it.
    cardEditor.invalidate();
    await flush();
    expect(note().value).toBe("");
    expect(
      editor().querySelector<HTMLInputElement>(".joyfox-card-editor__tag")!
        .value,
    ).toBe("");
    cardEditor.close();
  });

  it("reports a note saved in another tab while typing, instead of overwriting it", async () => {
    searchPage([FULL]);
    signals.update("search");
    await flush();
    group(FULL)!
      .querySelector<HTMLButtonElement>(".joyfox-signals__note")!
      .click();
    await flush();
    const note = () =>
      editor().querySelector<HTMLTextAreaElement>(".joyfox-card-editor__note")!;
    type(note(), "Mine");
    // Another tab saves a note; its revision reaches this tab.
    await new NotesService().saveNote(
      "account-a",
      { status: "resolved", memberId: FULL, source: "test" },
      "Theirs",
    );
    signals.invalidate();
    await flush();
    expect(note().value).toBe("Mine");
    editorButton("Save note").click();
    await flush();
    expect(editor().textContent).toContain("This note changed in another tab");
    expect((await repositories.userNotes.list("account-a"))[0]?.body).toBe(
      "Theirs",
    );
    // Told, the user saves again: now it replaces the stored note.
    editorButton("Save note").click();
    await flush();
    expect((await repositories.userNotes.list("account-a"))[0]?.body).toBe(
      "Mine",
    );
  });

  it("keeps the newest read when an older one finishes last", async () => {
    const reads: Array<(answer: unknown) => void> = [];
    const editorClient = {
      getNotes: () =>
        new Promise((resolve) => {
          reads.push(resolve);
        }),
      saveNote: () => Promise.reject(new Error("unused")),
      addTag: () => Promise.resolve(true),
      removeTag: () => Promise.resolve(true),
    } as never;
    const cardEditor = new CardNoteEditor(document, editorClient);
    cardEditor.open(FULL);
    const answer = (note: string) => ({
      status: "ok",
      accountId: "account-a",
      note,
      tags: [],
    });
    reads[0]!(answer("First"));
    await flush();
    cardEditor.invalidate();
    cardEditor.invalidate();
    // The newer read answers first, then the older one.
    reads[2]!(answer("Newest"));
    await flush();
    reads[1]!(answer("Older"));
    await flush();
    expect(
      document.querySelector<HTMLTextAreaElement>(".joyfox-card-editor__note")
        ?.value,
    ).toBe("Newest");
    cardEditor.close();
  });
});
