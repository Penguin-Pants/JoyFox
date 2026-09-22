import type { UserNote, UserTag } from "../domain/types";
import { ExtensionError } from "../errors";
import type { MemberIdentity } from "../identity/member-identity";
import {
  disabled,
  ok,
  type PersistenceOutcome,
} from "../identity/persistence-outcome";
import { ensureMemberRegistered } from "../members/member-directory";
import {
  JoyClubMemberRepository,
  UserNoteRepository,
  UserTagRepository,
} from "../storage/repositories";

export const MAX_NOTE_LENGTH = 4000;
export const MAX_TAG_LENGTH = 64;

/** Notes and tags describe an identifiable third party. */
export type { PersistenceOutcome };

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

  #ensureMember(accountId: string, memberId: string): Promise<void> {
    return ensureMemberRegistered(
      this.members,
      accountId,
      memberId,
      this.now(),
    );
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
