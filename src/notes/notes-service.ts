import type { JoyClubMember, UserNote, UserTag } from "../domain/types";
import { ExtensionError } from "../errors";
import type { MemberIdentity } from "../identity/member-identity";
import {
  disabled,
  ok,
  type PersistenceOutcome,
} from "../identity/persistence-outcome";
import {
  JoyClubMemberRepository,
  UserNoteRepository,
  UserTagRepository,
} from "../storage/repositories";
import { MAX_NOTE_LENGTH, MAX_TAG_LENGTH } from "./limits";

export { MAX_NOTE_LENGTH, MAX_TAG_LENGTH };

/** `current` is the stored note after the call (`null`: none). */
export interface SaveNoteResult {
  status: "saved" | "conflict";
  current: string | null;
}

export const noteId = (memberId: string) =>
  `note:${encodeURIComponent(memberId)}`;
export const tagId = (memberId: string, tagKey: string) =>
  `tag:${encodeURIComponent(memberId)}:${encodeURIComponent(tagKey)}`;

/** Collapse whitespace so "  Met   twice " and "Met twice" are one tag. */
export function normalizeTagLabel(label: string): string {
  return label.trim().replace(/\s+/gu, " ");
}

/**
 * Compare tags case-insensitively without letting a locale decide. `Met` and
 * `met` are the same tag; `toLowerCase` keeps that stable across profiles.
 */
export const tagKeyFor = (label: string) =>
  normalizeTagLabel(label).toLowerCase();

function requireAccountId(accountId: string): void {
  if (accountId.trim().length === 0)
    throw new ExtensionError(
      "IdentityMismatch",
      "A note or tag needs an explicit active account",
    );
}

export class NotesService {
  constructor(
    private readonly notes = new UserNoteRepository(),
    private readonly tags = new UserTagRepository(),
    private readonly members = new JoyClubMemberRepository(),
    private readonly now: () => string = () => new Date().toISOString(),
  ) {}

  /**
   * Record the member the note or tag belongs to, so an export carries the
   * member directory the notes reference rather than dangling member IDs.
   */
  async #ensureMember(accountId: string, memberId: string): Promise<void> {
    const existing = await this.members.get(accountId, memberId);
    if (existing) return;
    const timestamp = this.now();
    const member: JoyClubMember = {
      id: memberId,
      accountId,
      joyClubMemberId: memberId,
      createdAt: timestamp,
      updatedAt: timestamp,
    };
    await this.members.put(accountId, member);
  }

  async readNote(
    accountId: string,
    identity: MemberIdentity,
  ): Promise<PersistenceOutcome<UserNote | undefined>> {
    requireAccountId(accountId);
    if (identity.status === "unresolved") return disabled(identity.reason);
    return ok(await this.notes.get(accountId, noteId(identity.memberId)));
  }

  /**
   * Saves the note, or removes it when the body is empty. An empty body is a
   * deletion rather than an empty record so "cleared" and "never written" look
   * the same in the data inspector and in an export.
   */
  async saveNote(
    accountId: string,
    identity: MemberIdentity,
    body: string,
  ): Promise<PersistenceOutcome<UserNote | undefined>> {
    requireAccountId(accountId);
    if (identity.status === "unresolved") return disabled(identity.reason);
    const trimmed = body.trim();
    if (trimmed.length > MAX_NOTE_LENGTH)
      throw new ExtensionError(
        "StorageError",
        `A note may not exceed ${MAX_NOTE_LENGTH} characters`,
      );
    const id = noteId(identity.memberId);
    if (trimmed.length === 0) {
      await this.notes.delete(accountId, id);
      return ok(undefined);
    }
    const existing = await this.notes.get(accountId, id);
    const timestamp = this.now();
    const note: UserNote = {
      id,
      accountId,
      memberId: identity.memberId,
      body: trimmed,
      createdAt: existing?.createdAt ?? timestamp,
      updatedAt: timestamp,
    };
    await this.#ensureMember(accountId, identity.memberId);
    await this.notes.put(accountId, note);
    return ok(note);
  }

  /**
   * Save only if the stored note still has the text the editor was drawn
   * from (`null`: no note). A save from another tab, or a delete in the data
   * inspector, is then never overwritten unseen. Text is compared rather
   * than a timestamp, so two saves in one millisecond cannot hide a change,
   * and a save over identical text is let through. The caller holds the
   * account lock, so nothing writes between the check and the save.
   */
  async saveNoteIfUnchanged(
    accountId: string,
    identity: MemberIdentity,
    body: string,
    expectedBody: string | null,
  ): Promise<PersistenceOutcome<SaveNoteResult>> {
    requireAccountId(accountId);
    if (identity.status === "unresolved") return disabled(identity.reason);
    const current =
      (await this.notes.get(accountId, noteId(identity.memberId)))?.body ??
      null;
    if (current !== expectedBody) return ok({ status: "conflict", current });
    const saved = await this.saveNote(accountId, identity, body);
    if (saved.status === "disabled") return disabled(saved.reason);
    return ok({ status: "saved", current: saved.value?.body ?? null });
  }

  async deleteNote(
    accountId: string,
    identity: MemberIdentity,
  ): Promise<PersistenceOutcome<void>> {
    requireAccountId(accountId);
    if (identity.status === "unresolved") return disabled(identity.reason);
    await this.notes.delete(accountId, noteId(identity.memberId));
    return ok(undefined);
  }

  async listTags(
    accountId: string,
    identity: MemberIdentity,
  ): Promise<PersistenceOutcome<UserTag[]>> {
    requireAccountId(accountId);
    if (identity.status === "unresolved") return disabled(identity.reason);
    const all = await this.tags.list(accountId);
    return ok(
      all
        .filter((tag) => tag.memberId === identity.memberId)
        .sort((a, b) => tagKeyFor(a.label).localeCompare(tagKeyFor(b.label))),
    );
  }

  /** Adding an existing tag keeps the stored label and does not duplicate it. */
  async addTag(
    accountId: string,
    identity: MemberIdentity,
    label: string,
  ): Promise<PersistenceOutcome<UserTag>> {
    requireAccountId(accountId);
    if (identity.status === "unresolved") return disabled(identity.reason);
    const normalized = normalizeTagLabel(label);
    if (normalized.length === 0)
      throw new ExtensionError("StorageError", "A tag needs a label");
    if (normalized.length > MAX_TAG_LENGTH)
      throw new ExtensionError(
        "StorageError",
        `A tag may not exceed ${MAX_TAG_LENGTH} characters`,
      );
    const id = tagId(identity.memberId, tagKeyFor(normalized));
    const existing = await this.tags.get(accountId, id);
    if (existing) return ok(existing);
    const timestamp = this.now();
    const tag: UserTag = {
      id,
      accountId,
      memberId: identity.memberId,
      label: normalized,
      createdAt: timestamp,
      updatedAt: timestamp,
    };
    await this.#ensureMember(accountId, identity.memberId);
    await this.tags.put(accountId, tag);
    return ok(tag);
  }

  async removeTag(
    accountId: string,
    identity: MemberIdentity,
    label: string,
  ): Promise<PersistenceOutcome<void>> {
    requireAccountId(accountId);
    if (identity.status === "unresolved") return disabled(identity.reason);
    await this.tags.delete(
      accountId,
      tagId(identity.memberId, tagKeyFor(label)),
    );
    return ok(undefined);
  }
}
