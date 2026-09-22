import "../setup-indexeddb";
import { beforeEach, describe, expect, it } from "vitest";
import { ExtensionError } from "../../src/errors";
import {
  knownMemberIdentity,
  type MemberIdentity,
} from "../../src/identity/member-identity";
import {
  MAX_NOTE_LENGTH,
  MAX_TAG_LENGTH,
  NotesService,
  normalizeTagLabel,
  tagKeyFor,
  type PersistenceOutcome,
} from "../../src/notes/notes-service";
import { repositories } from "../../src/storage/repositories";
import { freshDatabase } from "../setup-indexeddb";

const ACCOUNT = "account-a";
const identity = knownMemberIdentity("synthetic-member-1", "test");
const unresolved: MemberIdentity = {
  status: "unresolved",
  reason: "selector-unverified",
};
let service: NotesService;

beforeEach(async () => {
  await freshDatabase();
  service = new NotesService();
});

/** Asserts the write was allowed and returns what it stored. */
function value<T>(outcome: PersistenceOutcome<T>): T {
  if (outcome.status !== "ok")
    throw new Error(`Expected an allowed write, got ${outcome.reason}`);
  return outcome.value;
}

/** Asserts the write was allowed and stored a record. */
function stored<T>(outcome: PersistenceOutcome<T | undefined>): T {
  const result = value(outcome);
  if (result === undefined) throw new Error("Expected a stored record");
  return result;
}

describe("M5 notes and tags", () => {
  it("refuses every operation while the member identity is unresolved", async () => {
    for (const outcome of [
      await service.saveNote(ACCOUNT, unresolved, "Synthetic note"),
      await service.readNote(ACCOUNT, unresolved),
      await service.deleteNote(ACCOUNT, unresolved),
      await service.addTag(ACCOUNT, unresolved, "Synthetic"),
      await service.listTags(ACCOUNT, unresolved),
      await service.removeTag(ACCOUNT, unresolved, "Synthetic"),
    ]) {
      expect(outcome.status).toBe("disabled");
      expect(outcome).toMatchObject({ reason: "selector-unverified" });
    }
    expect(await repositories.userNotes.list(ACCOUNT)).toEqual([]);
    expect(await repositories.userTags.list(ACCOUNT)).toEqual([]);
  });

  it("requires an explicit active account", async () => {
    await expect(service.saveNote("  ", identity, "Synthetic")).rejects.toThrow(
      ExtensionError,
    );
  });

  it("round-trips a note and preserves its creation time on edit", async () => {
    const created = stored(
      await service.saveNote(ACCOUNT, identity, "  First note  "),
    );
    expect(created).toMatchObject({ body: "First note" });
    const edited = stored(
      await service.saveNote(ACCOUNT, identity, "Second note"),
    );
    expect(edited.createdAt).toBe(created.createdAt);
    expect(edited.body).toBe("Second note");
    expect(value(await service.readNote(ACCOUNT, identity))?.body).toBe(
      "Second note",
    );
    expect(await repositories.userNotes.list(ACCOUNT)).toHaveLength(1);
  });

  it("registers the member so an export carries no dangling member ID", async () => {
    await service.saveNote(ACCOUNT, identity, "Synthetic note");
    expect(
      (await repositories.joyClubMembers.list(ACCOUNT)).map(
        (m) => m.joyClubMemberId,
      ),
    ).toEqual(["synthetic-member-1"]);
  });

  it("treats an empty body as a deletion", async () => {
    await service.saveNote(ACCOUNT, identity, "Synthetic note");
    expect(
      value(await service.saveNote(ACCOUNT, identity, "   ")),
    ).toBeUndefined();
    expect(await repositories.userNotes.list(ACCOUNT)).toEqual([]);
  });

  it("rejects an oversized note and stores nothing", async () => {
    await expect(
      service.saveNote(ACCOUNT, identity, "x".repeat(MAX_NOTE_LENGTH + 1)),
    ).rejects.toThrow(ExtensionError);
    expect(await repositories.userNotes.list(ACCOUNT)).toEqual([]);
  });

  it("normalizes tag labels and never stores a duplicate", async () => {
    expect(normalizeTagLabel("  Met   twice ")).toBe("Met twice");
    expect(tagKeyFor("Met Twice")).toBe("met twice");
    const first = value(await service.addTag(ACCOUNT, identity, "Met twice"));
    const again = value(
      await service.addTag(ACCOUNT, identity, "  met   TWICE "),
    );
    expect(again.id).toBe(first.id);
    expect(again.label).toBe("Met twice");
    expect(await repositories.userTags.list(ACCOUNT)).toHaveLength(1);
  });

  it("lists only the tags of the requested member, sorted", async () => {
    const other = knownMemberIdentity("synthetic-member-2", "test");
    await service.addTag(ACCOUNT, identity, "Zeta");
    await service.addTag(ACCOUNT, identity, "alpha");
    await service.addTag(ACCOUNT, other, "Other member");
    expect(
      value(await service.listTags(ACCOUNT, identity)).map((tag) => tag.label),
    ).toEqual(["alpha", "Zeta"]);
  });

  it("removes a tag by any equivalent spelling", async () => {
    await service.addTag(ACCOUNT, identity, "Met twice");
    await service.removeTag(ACCOUNT, identity, "  MET TWICE ");
    expect(value(await service.listTags(ACCOUNT, identity))).toEqual([]);
  });

  it("rejects an empty or oversized tag", async () => {
    await expect(service.addTag(ACCOUNT, identity, "   ")).rejects.toThrow(
      /needs a label/,
    );
    await expect(
      service.addTag(ACCOUNT, identity, "x".repeat(MAX_TAG_LENGTH + 1)),
    ).rejects.toThrow(ExtensionError);
    expect(await repositories.userTags.list(ACCOUNT)).toEqual([]);
  });

  it("keeps member IDs containing the key separator apart", async () => {
    const tricky = knownMemberIdentity("a:b", "test");
    const other = knownMemberIdentity("a", "test");
    await service.saveNote(ACCOUNT, tricky, "First");
    await service.saveNote(ACCOUNT, other, "Second");
    expect(value(await service.readNote(ACCOUNT, tricky))?.body).toBe("First");
    expect(await repositories.userNotes.list(ACCOUNT)).toHaveLength(2);
  });
});
