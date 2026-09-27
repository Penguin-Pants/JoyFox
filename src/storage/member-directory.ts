import type { JoyClubMember } from "../domain/types";
import type { JoyClubMemberRepository } from "./repositories";

/**
 * Record the member a stored record refers to, so an export carries the
 * member directory rather than dangling member IDs. The same guarantee
 * `NotesService` gives notes and tags.
 */
export async function registerMember(
  members: JoyClubMemberRepository,
  accountId: string,
  memberId: string,
  timestamp: string,
): Promise<void> {
  if (await members.get(accountId, memberId)) return;
  const member: JoyClubMember = {
    id: memberId,
    accountId,
    joyClubMemberId: memberId,
    createdAt: timestamp,
    updatedAt: timestamp,
  };
  await members.put(accountId, member);
}

/** The longest nickname kept; JoyClub's own are far shorter. */
export const MAX_NICKNAME_LENGTH = 64;

/**
 * A nickname as a card shows it, trimmed, or `undefined` when it is empty,
 * too long or holds a control character.
 */
export function cleanNickname(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const nickname = value.replace(/\s+/gu, " ").trim();
  if (nickname.length === 0 || nickname.length > MAX_NICKNAME_LENGTH)
    return undefined;
  // eslint-disable-next-line no-control-regex
  return /[\u0000-\u001f\u007f]/u.test(nickname) ? undefined : nickname;
}

/**
 * Keep each member's nickname, as a card shows it now. A member not yet in
 * the directory is added; an unchanged nickname writes nothing. Returns how
 * many records changed.
 */
export async function rememberNicknames(
  members: JoyClubMemberRepository,
  accountId: string,
  names: ReadonlyArray<{ memberId: string; nickname: string }>,
  timestamp: string,
): Promise<number> {
  let changed = 0;
  for (const { memberId, nickname } of names) {
    const existing = await members.get(accountId, memberId);
    if (existing?.nickname === nickname) continue;
    const member: JoyClubMember = existing
      ? { ...existing, nickname, updatedAt: timestamp }
      : {
          id: memberId,
          accountId,
          joyClubMemberId: memberId,
          nickname,
          createdAt: timestamp,
          updatedAt: timestamp,
        };
    await members.put(accountId, member);
    changed += 1;
  }
  return changed;
}

/** The nicknames known for an account, by member ID. */
export async function nicknamesOf(
  members: JoyClubMemberRepository,
  accountId: string,
): Promise<Map<string, string>> {
  const names = new Map<string, string>();
  for (const member of await members.list(accountId))
    if (member.nickname) names.set(member.joyClubMemberId, member.nickname);
  return names;
}
