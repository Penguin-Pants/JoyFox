import type { JoyClubMember } from "../domain/types";
import type { JoyClubMemberRepository } from "../storage/repositories";

/**
 * Record the member a stored record refers to, so an export carries the member
 * directory rather than dangling member IDs. An existing record is kept as is.
 */
export async function ensureMemberRegistered(
  members: JoyClubMemberRepository,
  accountId: string,
  memberId: string,
  timestamp: string,
): Promise<void> {
  const existing = await members.get(accountId, memberId);
  if (existing) return;
  const member: JoyClubMember = {
    id: memberId,
    accountId,
    joyClubMemberId: memberId,
    createdAt: timestamp,
    updatedAt: timestamp,
  };
  await members.put(accountId, member);
}
