// @vitest-environment jsdom
import "../setup-indexeddb";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { registerNotesHandlers } from "../../src/background/notes-handlers";
import {
  MemberNotes,
  messageNotesClient,
  NOTES_TEXT,
  type NotesClient,
  type SaveNoteAnswer,
} from "../../src/content/member-notes";
import { MemberPanel } from "../../src/content/member-panel";
import type { TriageClient } from "../../src/content/triage-client";
import { MessageRouter } from "../../src/messaging/router";
import { NotesService } from "../../src/notes/notes-service";
import { repositories } from "../../src/storage/repositories";
import { freshDatabase } from "../setup-indexeddb";
import conversationHtml from "../fixtures/joyclub/conversation.html?raw";
import profileHtml from "../fixtures/joyclub/profile.html?raw";

const MEMBER = "1234567"; // the fixture profile and conversation header
const PROFILE = "/profile/1234567.synthetic_one.html";
const CONVERSATION =
  "/clubmail/conversation/conversation-wrapper-personal-1234567-7654321";
let active: string | undefined;
let client: NotesClient;

beforeEach(async () => {
  await freshDatabase();
  active = "account-a";
  const router = new MessageRouter();
  registerNotesHandlers(router, {
    notes: new NotesService(),
    activeAccountId: () => Promise.resolve(active),
  });
  // The real handlers behind the real message client.
  client = messageNotesClient((message) => router.route(message));
});

afterEach(() => {
  document.body.innerHTML = "";
});

function setPage(path: string, html: string) {
  window.history.replaceState(null, "", path);
  document.body.innerHTML = html;
}

const editor = () =>
  document.querySelector<HTMLElement>('[data-joyfox-ui="member-notes"]');
const noteBox = () =>
  editor()?.querySelector<HTMLTextAreaElement>("textarea") ?? null;
const tagInput = () =>
  editor()?.querySelector<HTMLInputElement>('input[type="text"]') ?? null;
const status = () =>
  editor()?.querySelector('[role="status"]')?.textContent ?? "";
const buttonNamed = (text: string) => {
  const match = Array.from(editor()?.querySelectorAll("button") ?? []).find(
    (node) => node.textContent === text,
  );
  if (!match) throw new Error(`No button ${text}`);
  return match;
};
const type = (field: HTMLTextAreaElement | HTMLInputElement, text: string) => {
  field.value = text;
  field.dispatchEvent(new Event("input", { bubbles: true }));
};
const storedNote = async (account = "account-a") =>
  (await repositories.userNotes.list(account)).map((note) => note.body);

async function openProfile(): Promise<MemberNotes> {
  setPage(PROFILE, profileHtml);
  const notes = new MemberNotes(document, client);
  notes.update("profile");
  await vi.waitFor(() => expect(editor()).not.toBeNull());
  return notes;
}

describe("M5 note and tag editor", () => {
  it("appears after the profile header, labelled and closed while empty", async () => {
    await openProfile();
    const header = document.querySelector(
      '[data-e2e="profile-header-base-info"]',
    )!;
    expect(header.nextElementSibling).toBe(editor());
    expect(header.contains(editor())).toBe(false);
    expect(editor()?.querySelector("details")?.open).toBe(false);
    expect(editor()?.textContent).toContain("Your notes and tags (none yet)");
    expect(editor()?.textContent).toContain(NOTES_TEXT.scope);
    expect(NOTES_TEXT.scope).not.toMatch(/never see/);
    const label = editor()?.querySelector(`label[for="${noteBox()?.id}"]`);
    expect(label?.textContent).toBe("Private note");
    expect(
      editor()?.querySelector(`label[for="${tagInput()?.id}"]`)?.textContent,
    ).toBe("Add a tag");
  });

  it("sits after the member panel when both are shown", async () => {
    setPage(PROFILE, profileHtml);
    const notes = new MemberNotes(document, client);
    notes.update("profile");
    await vi.waitFor(() => expect(editor()).not.toBeNull());
    // The panel is drawn after the editor, as a slower answer would be.
    const triageClient: TriageClient = {
      evaluate: () =>
        Promise.resolve({ status: "no-rule", accountId: "account-a" }),
      getTrust: () =>
        Promise.resolve({
          status: "ok",
          accountId: "account-a",
          trust: "unknown",
        }),
      setOverride: () => Promise.resolve(),
      logTrust: () => Promise.resolve(),
      undoTrust: () => Promise.resolve(),
      captureSnapshot: () => Promise.resolve(),
      openOptions: () => Promise.resolve(),
    };
    new MemberPanel(document, triageClient).update("profile");
    const panelNode = () =>
      document.querySelector('[data-joyfox-ui="member-panel"]');
    await vi.waitFor(() => expect(panelNode()).not.toBeNull());
    const header = document.querySelector(
      '[data-e2e="profile-header-base-info"]',
    )!;
    expect(header.nextElementSibling).toBe(panelNode());
    expect(panelNode()?.nextElementSibling).toBe(editor());
    // Updating again leaves both in place: nothing is drawn twice.
    const drawn = editor();
    notes.update("profile");
    expect(editor()).toBe(drawn);
    expect(
      document.querySelectorAll('[data-joyfox-ui="member-notes"]'),
    ).toHaveLength(1);
  });

  it("keeps a note across a restart and a markup change with the same profile ID", async () => {
    await openProfile();
    type(noteBox()!, "Invented note text");
    buttonNamed("Save note").click();
    await vi.waitFor(() => expect(status()).toBe(NOTES_TEXT.saved));
    expect(await storedNote()).toEqual(["Invented note text"]);

    // A restart: a new content script on a changed page with the same ID.
    document.body.innerHTML = "";
    setPage(
      PROFILE,
      `<main class="invented-new-layout">${profileHtml.replace(
        "Invented motto with five words",
        "A changed invented motto",
      )}</main>`,
    );
    new MemberNotes(document, client).update("profile");
    await vi.waitFor(() => expect(editor()).not.toBeNull());
    expect(noteBox()?.value).toBe("Invented note text");
    expect(editor()?.querySelector("details")?.open).toBe(true);
    expect(editor()?.textContent).toContain("Your notes and tags (a note)");
  });

  it("shows the same note on the member's conversation page", async () => {
    await openProfile();
    type(noteBox()!, "Invented note text");
    buttonNamed("Save note").click();
    await vi.waitFor(() => expect(status()).toBe(NOTES_TEXT.saved));
    setPage(CONVERSATION, conversationHtml);
    const notes = new MemberNotes(document, client);
    notes.update("conversation");
    await vi.waitFor(() => expect(editor()).not.toBeNull());
    expect(noteBox()?.value).toBe("Invented note text");
    expect(
      document.querySelector(".cm-conversation-header")?.contains(editor()),
    ).toBe(false);
  });

  it("adds a tag with Enter and removes it", async () => {
    await openProfile();
    tagInput()!.focus();
    type(tagInput()!, "  Met   twice ");
    tagInput()!.dispatchEvent(
      new KeyboardEvent("keydown", { key: "Enter", bubbles: true }),
    );
    await vi.waitFor(() => expect(status()).toBe(NOTES_TEXT.tagAdded));
    await vi.waitFor(() =>
      expect(editor()?.textContent).toContain("Your notes and tags (1 tag)"),
    );
    expect(tagInput()?.value).toBe("");
    const remove = editor()?.querySelector<HTMLButtonElement>(
      'button[aria-label="Remove tag Met twice"]',
    );
    expect(remove?.textContent).toBe("Remove");
    remove!.focus();
    remove!.click();
    await vi.waitFor(() => expect(status()).toBe(NOTES_TEXT.tagRemoved));
    await vi.waitFor(() => expect(document.activeElement).toBe(tagInput()));
    await vi.waitFor(() =>
      expect(editor()?.textContent).toContain("No tags yet."),
    );
    expect(await repositories.userTags.list("account-a")).toEqual([]);
  });

  it("refuses an empty tag or new note without a write", async () => {
    await openProfile();
    type(tagInput()!, "   ");
    buttonNamed("Add tag").click();
    expect(status()).toBe(NOTES_TEXT.emptyTag);
    expect(await repositories.userTags.list("account-a")).toEqual([]);
    type(noteBox()!, "  ");
    buttonNamed("Save note").click();
    expect(status()).toBe(NOTES_TEXT.emptyNote);
    // The refusal does not block a later save.
    type(noteBox()!, "Invented");
    buttonNamed("Save note").click();
    await vi.waitFor(() => expect(status()).toBe(NOTES_TEXT.saved));
    expect(await storedNote()).toEqual(["Invented"]);
  });

  it("keeps typed text and focus when the page reads the note again", async () => {
    const notes = await openProfile();
    const box = noteBox()!;
    box.focus();
    type(box, "Unsaved invented text");
    box.setSelectionRange(3, 3);
    // Another tab adds a tag: the editor redraws with the new data.
    await repositories.userTags.put("account-a", {
      id: "tag:1234567:other",
      accountId: "account-a",
      memberId: MEMBER,
      label: "Other",
      createdAt: "2026-09-23T10:00:00.000Z",
      updatedAt: "2026-09-23T10:00:00.000Z",
    });
    notes.invalidate();
    await vi.waitFor(() => expect(editor()?.textContent).toContain("Other"));
    expect(noteBox()).not.toBe(box);
    expect(noteBox()?.value).toBe("Unsaved invented text");
    expect(document.activeElement).toBe(noteBox());
    expect(noteBox()?.selectionStart).toBe(3);
    expect(await storedNote()).toEqual([]);
  });

  it("never overwrites a note saved in another tab meanwhile", async () => {
    await openProfile();
    type(noteBox()!, "Text from this tab");
    // Another tab saves first.
    await client.saveNote("account-a", MEMBER, "Text from another tab", null);
    buttonNamed("Save note").click();
    await vi.waitFor(() => expect(status()).toBe(NOTES_TEXT.conflict));
    expect(await storedNote()).toEqual(["Text from another tab"]);
    await vi.waitFor(() =>
      expect(editor()?.textContent).toContain("Your notes and tags (a note)"),
    );
    expect(noteBox()?.value).toBe("Text from this tab");
    // Saving again, after the warning, replaces the stored note.
    buttonNamed("Save note").click();
    await vi.waitFor(() => expect(status()).toBe(NOTES_TEXT.saved));
    expect(await storedNote()).toEqual(["Text from this tab"]);
  });

  it("still refuses to overwrite after a reload shows the newer note", async () => {
    const notes = await openProfile();
    type(noteBox()!, "Text typed over no note");
    await client.saveNote("account-a", MEMBER, "Text from another tab", null);
    // A reload (for example after a data inspector change) now shows the
    // other tab's note, but the typed text was written over no note.
    notes.invalidate();
    await vi.waitFor(() =>
      expect(editor()?.textContent).toContain("Your notes and tags (a note)"),
    );
    expect(noteBox()?.value).toBe("Text typed over no note");
    buttonNamed("Save note").click();
    await vi.waitFor(() => expect(status()).toBe(NOTES_TEXT.conflict));
    expect(await storedNote()).toEqual(["Text from another tab"]);
  });

  it("discards typed text and shows the stored note", async () => {
    await openProfile();
    type(noteBox()!, "Stored invented note");
    buttonNamed("Save note").click();
    await vi.waitFor(() => expect(status()).toBe(NOTES_TEXT.saved));
    await vi.waitFor(() =>
      expect(buttonNamed("Discard my changes").disabled).toBe(true),
    );
    type(noteBox()!, "Changed my mind");
    expect(buttonNamed("Discard my changes").disabled).toBe(false);
    buttonNamed("Discard my changes").focus();
    buttonNamed("Discard my changes").click();
    await vi.waitFor(() =>
      expect(noteBox()?.value).toBe("Stored invented note"),
    );
    expect(buttonNamed("Discard my changes").disabled).toBe(true);
    // The disabled button cannot keep focus; the note box takes it.
    expect(document.activeElement).toBe(noteBox());
  });

  it("removes the note when saved empty", async () => {
    await openProfile();
    type(noteBox()!, "Invented");
    buttonNamed("Save note").click();
    await vi.waitFor(() => expect(status()).toBe(NOTES_TEXT.saved));
    type(noteBox()!, "  ");
    buttonNamed("Save note").click();
    await vi.waitFor(() => expect(status()).toBe(NOTES_TEXT.removed));
    expect(await storedNote()).toEqual([]);
  });

  it("goes at once on an account switch and drops typed text", async () => {
    const notes = await openProfile();
    type(noteBox()!, "Text for account A");
    active = "account-b";
    notes.accountChanged();
    expect(editor()).toBeNull();
    await vi.waitFor(() => expect(editor()).not.toBeNull());
    expect(noteBox()?.value).toBe("");
    expect(await storedNote("account-a")).toEqual([]);
    expect(await storedNote("account-b")).toEqual([]);
  });

  it("never brings typed text into another account from a late answer", async () => {
    setPage(PROFILE, profileHtml);
    let answer: (value: SaveNoteAnswer) => void = () => undefined;
    const notes = new MemberNotes(document, {
      ...client,
      saveNote: () =>
        new Promise<SaveNoteAnswer>((resolve) => {
          answer = resolve;
        }),
    });
    notes.update("profile");
    await vi.waitFor(() => expect(editor()).not.toBeNull());
    type(noteBox()!, "Text typed under account A");
    buttonNamed("Save note").click();
    active = "account-b";
    notes.accountChanged();
    await vi.waitFor(() => expect(editor()).not.toBeNull());
    // Account A's save answers late, with a conflict.
    answer({ status: "conflict", current: "Account A's stored note" });
    await new Promise((resolve) => setTimeout(resolve, 20));
    await vi.waitFor(() => expect(editor()).not.toBeNull());
    expect(noteBox()?.value).toBe("");
    expect(buttonNamed("Discard my changes").disabled).toBe(true);
    expect(status()).toBe("");
  });

  it("ignores a second Save while the first runs, without a false conflict", async () => {
    await openProfile();
    type(noteBox()!, "Invented note text");
    buttonNamed("Save note").click();
    buttonNamed("Save note").click();
    await vi.waitFor(() => expect(status()).toBe(NOTES_TEXT.saved));
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(status()).toBe(NOTES_TEXT.saved);
    expect(await storedNote()).toEqual(["Invented note text"]);
  });

  it("says nothing was stored when the account changed before the save", async () => {
    await openProfile();
    type(noteBox()!, "Late text");
    active = "account-b";
    buttonNamed("Save note").click();
    await vi.waitFor(() => expect(status()).toBe(NOTES_TEXT.refused));
    expect(await storedNote("account-a")).toEqual([]);
    expect(await storedNote("account-b")).toEqual([]);
  });

  it("never saves typed text into the account that became active meanwhile", async () => {
    const notes = await openProfile();
    type(noteBox()!, "Text typed under account A");
    // The switch happens in the options page; this tab has not heard yet.
    active = "account-b";
    buttonNamed("Save note").click();
    await vi.waitFor(() => expect(status()).toBe(NOTES_TEXT.refused));
    await vi.waitFor(() => expect(noteBox()?.value).toBe(""));
    expect(await storedNote("account-a")).toEqual([]);
    expect(await storedNote("account-b")).toEqual([]);
    // A reload that returns another account drops typed text too.
    active = "account-a";
    notes.invalidate();
    await new Promise((resolve) => setTimeout(resolve, 30));
    type(noteBox()!, "Typed under A again");
    active = "account-b";
    notes.invalidate();
    await vi.waitFor(() => expect(noteBox()?.value).toBe(""));
    expect(status()).toBe(NOTES_TEXT.refused);
    expect(buttonNamed("Discard my changes").disabled).toBe(true);
    expect(await storedNote("account-b")).toEqual([]);
  });

  it("keeps each account's note through a switch there and back", async () => {
    const notes = await openProfile();
    type(noteBox()!, "Note for account A");
    buttonNamed("Save note").click();
    await vi.waitFor(() => expect(status()).toBe(NOTES_TEXT.saved));
    active = "account-b";
    notes.accountChanged();
    await vi.waitFor(() => expect(editor()).not.toBeNull());
    expect(noteBox()?.value).toBe("");
    type(noteBox()!, "Note for account B");
    buttonNamed("Save note").click();
    await vi.waitFor(() => expect(status()).toBe(NOTES_TEXT.saved));
    active = "account-a";
    notes.accountChanged();
    await vi.waitFor(() => expect(noteBox()?.value).toBe("Note for account A"));
    expect(await storedNote("account-a")).toEqual(["Note for account A"]);
    expect(await storedNote("account-b")).toEqual(["Note for account B"]);
  });

  it("keeps typed text while JoyClub hides the header for a moment", async () => {
    const notes = await openProfile();
    type(noteBox()!, "Unsaved text");
    notes.leave();
    expect(editor()).toBeNull();
    notes.update("profile");
    await vi.waitFor(() => expect(editor()).not.toBeNull());
    expect(noteBox()?.value).toBe("Unsaved text");
    // Another member drops it.
    notes.leave();
    window.history.replaceState(
      null,
      "",
      "/profile/5550001.synthetic_four.html",
    );
    notes.update("profile");
    await vi.waitFor(() => expect(editor()).not.toBeNull());
    expect(noteBox()?.value).toBe("");
  });

  it("does not drop the next member's save while an earlier save is pending", async () => {
    setPage(PROFILE, profileHtml);
    const saved: string[] = [];
    let answerFirst: () => void = () => undefined;
    const notes = new MemberNotes(document, {
      ...client,
      saveNote: async (accountId, memberId, body, expected) => {
        saved.push(memberId);
        // The first member's save answers only when the test says so.
        if (memberId === MEMBER)
          await new Promise<void>((resolve) => {
            answerFirst = resolve;
          });
        return client.saveNote(accountId, memberId, body, expected);
      },
    });
    notes.update("profile");
    await vi.waitFor(() => expect(editor()).not.toBeNull());
    type(noteBox()!, "First member");
    buttonNamed("Save note").click();
    await vi.waitFor(() => expect(saved).toEqual([MEMBER]));
    window.history.replaceState(
      null,
      "",
      "/profile/5550001.synthetic_four.html",
    );
    notes.update("profile");
    await vi.waitFor(() =>
      expect(editor()?.getAttribute("data-member")).toBe("5550001"),
    );
    type(noteBox()!, "Second member");
    buttonNamed("Save note").click();
    answerFirst();
    await vi.waitFor(() => expect(saved).toEqual([MEMBER, "5550001"]));
    await vi.waitFor(() => expect(status()).toBe(NOTES_TEXT.saved));
  });

  it("goes at once when the route switches to another member", async () => {
    const notes = await openProfile();
    type(noteBox()!, "Text for the first member");
    window.history.replaceState(
      null,
      "",
      "/profile/5550001.synthetic_four.html",
    );
    notes.update("profile");
    expect(editor()).toBeNull();
    await vi.waitFor(() => expect(editor()).not.toBeNull());
    expect(editor()?.getAttribute("data-member")).toBe("5550001");
    expect(noteBox()?.value).toBe("");
  });

  it("shows nothing without an active account", async () => {
    active = undefined;
    setPage(PROFILE, profileHtml);
    new MemberNotes(document, client).update("profile");
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(editor()).toBeNull();
  });

  it("shows nothing and reads nothing without a verified member ID", async () => {
    // The header links a member who is not in the conversation URL.
    setPage(
      "/clubmail/conversation/conversation-wrapper-personal-5550001-7654321",
      conversationHtml,
    );
    const reads: string[] = [];
    new MemberNotes(document, {
      ...client,
      getNotes: (memberId) => {
        reads.push(memberId);
        return client.getNotes(memberId);
      },
    }).update("conversation");
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(editor()).toBeNull();
    expect(reads).toEqual([]);
  });

  it("shows nothing when the background cannot answer", async () => {
    setPage(PROFILE, profileHtml);
    new MemberNotes(document, {
      ...client,
      getNotes: () => Promise.reject(new Error("no answer")),
    }).update("profile");
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(editor()).toBeNull();
  });

  it("leave removes the editor", async () => {
    const notes = await openProfile();
    notes.leave();
    expect(editor()).toBeNull();
  });
});
