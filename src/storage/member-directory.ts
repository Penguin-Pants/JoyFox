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
