import "../setup-indexeddb";
import { beforeEach, describe, expect, it } from "vitest";
import { AccountService } from "../../src/accounts/account-service";
import { knownMemberIdentity } from "../../src/identity/member-identity";
import { NotesService } from "../../src/notes/notes-service";
import { exportAccount, repositories } from "../../src/storage/repositories";
import { freshDatabase } from "../setup-indexeddb";
import { MemorySettingsArea } from "../memory-settings";

const member = knownMemberIdentity("shared-synthetic-member", "test");
let accounts: AccountService;
let notes: NotesService;

beforeEach(async () => {
  await freshDatabase();
  accounts = new AccountService(
    repositories.extensionAccounts,
    new MemorySettingsArea(),
  );
  notes = new NotesService();
});

/**
 * The build plan calls this a security test, not only a functional one: a note
 * written under one account must be unreachable from another, including when
 * both describe the same JoyClub member.
 */
describe("M7 account isolation", () => {
  it("never surfaces one account's notes or tags under another", async () => {
    const a = await accounts.createAccount({ joyClubAccountId: "synthetic-a" });
    const b = await accounts.createAccount({ joyClubAccountId: "synthetic-b" });

    await notes.saveNote(a.id, member, "Account A note");
    await notes.addTag(a.id, member, "A tag");

    await accounts.setActiveAccount(b.id);
    expect((await accounts.getActiveAccount())?.id).toBe(b.id);
    const bNote = await notes.readNote(b.id, member);
    expect(bNote).toEqual({ status: "ok", value: undefined });
    expect(await notes.listTags(b.id, member)).toEqual({
      status: "ok",
      value: [],
    });

    await notes.saveNote(b.id, member, "Account B note");
    await notes.addTag(b.id, member, "B tag");

    await accounts.setActiveAccount(a.id);
    const aNote = await notes.readNote(a.id, member);
    expect(aNote).toMatchObject({ value: { body: "Account A note" } });
    const aTags = await notes.listTags(a.id, member);
    expect(aTags).toMatchObject({ value: [{ label: "A tag" }] });
  });

  it("exports and deletes strictly within one account", async () => {
    const a = await accounts.createAccount({ joyClubAccountId: "synthetic-a" });
    const b = await accounts.createAccount({ joyClubAccountId: "synthetic-b" });
    await notes.saveNote(a.id, member, "Account A note");
    await notes.saveNote(b.id, member, "Account B note");

    const exported = await exportAccount(a.id);
    expect(exported.entities.userNotes).toHaveLength(1);
    expect(exported.entities.userNotes[0]?.body).toBe("Account A note");
    expect(
      Object.values(exported.entities)
        .flat()
        .every((record) => record.accountId === a.id),
    ).toBe(true);

    await accounts.deleteAccount(a.id);
    expect(await repositories.userNotes.list(a.id)).toEqual([]);
    expect(await repositories.userNotes.list(b.id)).toHaveLength(1);
    expect(
      (await accounts.listAccounts()).map((account) => account.id),
    ).toEqual([b.id]);
  });

  it("rejects a record whose account does not match the write scope", async () => {
    const a = await accounts.createAccount({ joyClubAccountId: "synthetic-a" });
    const b = await accounts.createAccount({ joyClubAccountId: "synthetic-b" });
    await expect(
      repositories.userNotes.put(b.id, {
        id: "note:smuggled",
        accountId: a.id,
        memberId: "shared-synthetic-member",
        body: "Smuggled note",
        createdAt: "2026-09-22T00:00:00.000Z",
        updatedAt: "2026-09-22T00:00:00.000Z",
      }),
    ).rejects.toThrow(/does not match repository scope/);
  });
});
