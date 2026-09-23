import "../setup-indexeddb";
import { beforeEach, describe, expect, it } from "vitest";
import { registerNotesHandlers } from "../../src/background/notes-handlers";
import type { MessageContract } from "../../src/messaging/protocol";
import { MessageRouter } from "../../src/messaging/router";
import { NotesService } from "../../src/notes/notes-service";
import { NOTES_REVISION_KEY } from "../../src/storage/notes-revision";
import { repositories } from "../../src/storage/repositories";
import { MemorySettingsArea } from "../memory-settings";
import { freshDatabase } from "../setup-indexeddb";

const MEMBER = "1234567";
let active: string | undefined;
let router: MessageRouter;
let settings: MemorySettingsArea;

beforeEach(async () => {
  await freshDatabase();
  active = "account-a";
  router = new MessageRouter();
  settings = new MemorySettingsArea();
  registerNotesHandlers(router, {
    notes: new NotesService(),
    activeAccountId: () => Promise.resolve(active),
    settings,
  });
});

async function send<K extends keyof MessageContract>(
  type: K,
  payload: MessageContract[K]["request"],
) {
  return router.route({ type, requestId: "r1", payload });
}

const get = () => send("note.get", { memberId: MEMBER });

describe("M5 note and tag messages", () => {
  it("answers no-account while none is active", async () => {
    active = undefined;
    expect(await get()).toMatchObject({
      ok: true,
      payload: { status: "no-account" },
    });
  });

  it("stores and reads a note and tags for the active account only", async () => {
    expect(
      await send("note.save", {
        accountId: "account-a",
        memberId: MEMBER,
        body: "Synthetic note",
        expectedBody: null,
      }),
    ).toMatchObject({
      ok: true,
      payload: { status: "saved", current: "Synthetic note" },
    });
    await send("tag.add", {
      accountId: "account-a",
      memberId: MEMBER,
      label: "  Met   twice ",
    });
    expect(await get()).toMatchObject({
      payload: {
        status: "ok",
        accountId: "account-a",
        note: "Synthetic note",
        tags: ["Met twice"],
      },
    });
    active = "account-b";
    expect(await get()).toMatchObject({
      payload: { status: "ok", accountId: "account-b", note: null, tags: [] },
    });
  });

  it("refuses a write named for an account that is no longer active", async () => {
    active = "account-b";
    expect(
      await send("note.save", {
        accountId: "account-a",
        memberId: MEMBER,
        body: "Late write",
        expectedBody: null,
      }),
    ).toMatchObject({ ok: true, payload: { status: "refused" } });
    expect(
      await send("tag.add", {
        accountId: "account-a",
        memberId: MEMBER,
        label: "Late",
      }),
    ).toMatchObject({ ok: true, payload: { done: false } });
    for (const account of ["account-a", "account-b"]) {
      expect(await repositories.userNotes.list(account)).toEqual([]);
      expect(await repositories.userTags.list(account)).toEqual([]);
    }
  });

  it("answers conflict with the stored note instead of overwriting it", async () => {
    await send("note.save", {
      accountId: "account-a",
      memberId: MEMBER,
      body: "From another tab",
      expectedBody: null,
    });
    expect(
      await send("note.save", {
        accountId: "account-a",
        memberId: MEMBER,
        body: "Stale editor",
        expectedBody: null,
      }),
    ).toMatchObject({
      payload: { status: "conflict", current: "From another tab" },
    });
  });

  it("removes a tag", async () => {
    await send("tag.add", {
      accountId: "account-a",
      memberId: MEMBER,
      label: "Met",
    });
    expect(
      await send("tag.remove", {
        accountId: "account-a",
        memberId: MEMBER,
        label: "met",
      }),
    ).toMatchObject({ payload: { done: true } });
    expect(await get()).toMatchObject({ payload: { tags: [] } });
  });

  it("rejects a malformed member ID, note or tag, and stores nothing", async () => {
    const rejected = { ok: false, error: { code: "HANDLER_FAILED" } };
    expect(
      await send("note.get", { memberId: "Synthetic Name" }),
    ).toMatchObject(rejected);
    expect(
      await send("note.save", {
        accountId: "account-a",
        memberId: MEMBER,
        body: "x".repeat(4001),
        expectedBody: null,
      }),
    ).toMatchObject(rejected);
    expect(
      await send("note.save", {
        accountId: "account-a",
        memberId: MEMBER,
        body: "Text",
        expectedBody: 3 as never,
      }),
    ).toMatchObject(rejected);
    for (const label of ["   ", "x".repeat(65), 7 as never])
      expect(
        await send("tag.add", {
          accountId: "account-a",
          memberId: MEMBER,
          label,
        }),
      ).toMatchObject(rejected);
    expect(
      await send("note.save", {
        accountId: "",
        memberId: MEMBER,
        body: "Text",
        expectedBody: null,
      }),
    ).toMatchObject(rejected);
    expect(await repositories.userNotes.list("account-a")).toEqual([]);
    expect(await repositories.userTags.list("account-a")).toEqual([]);
  });

  it("marks a committed write, so other open tabs reload the note", async () => {
    const revision = () => settings.items.get(NOTES_REVISION_KEY);
    const write = { accountId: "account-a", memberId: MEMBER };
    await send("note.save", { ...write, body: "One", expectedBody: null });
    const afterSave = revision();
    expect(afterSave).toEqual(expect.any(String));
    // A conflict and a refused write change nothing, so mark nothing.
    await send("note.save", { ...write, body: "Two", expectedBody: null });
    expect(revision()).toBe(afterSave);
    active = "account-b";
    await send("tag.add", { ...write, label: "Late" });
    expect(revision()).toBe(afterSave);
    active = "account-a";
    await send("tag.add", { ...write, label: "Met" });
    const afterAdd = revision();
    expect(afterAdd).not.toBe(afterSave);
    await send("tag.remove", { ...write, label: "Met" });
    expect(revision()).not.toBe(afterAdd);
  });
});
