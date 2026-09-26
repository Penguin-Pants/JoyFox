import type { ProfileSnapshot } from "../domain/types";
import { sharedPreferences } from "../extraction/preferences";
import { newestSnapshot } from "../qualification/facts";
import { ProfileSnapshotRepository } from "../storage/repositories";

export interface CompatibilityAnswer {
  accountId: string;
  /**
   * The viewer's own positive preferences, read on their own profile, or
   * `null` when JoyFox has not read them yet.
   */
  own: string[] | null;
  /** The viewer's own member ID, when known. */
  ownMemberId: string | null;
  /**
   * Per requested member: how many preferences they share with the viewer,
   * or `null` when either list is not known.
   */
  shared: Record<string, number | null>;
}

/**
 * V1-2: compatibility from the preferences cached with each profile
 * snapshot. A member's count uses the newest snapshot of that member, so a
 * card shows what that member's profile page showed on the last visit.
 */
export class CompatibilityService {
  constructor(private readonly snapshots = new ProfileSnapshotRepository()) {}

  async lookup(
    accountId: string,
    memberIds: readonly string[],
  ): Promise<CompatibilityAnswer> {
    const all = await this.snapshots.list(accountId);
    const newestOwn = newestSnapshot(
      all.filter((snapshot) => snapshot.ownProfile === true),
    );
    // The own member's newest snapshot holds their newest reading.
    const ownLatest = newestOwn
      ? newestSnapshot(
          all.filter((snapshot) => snapshot.memberId === newestOwn.memberId),
        )
      : undefined;
    const own = ownLatest?.positivePreferences ?? null;
    const byMember = new Map<string, ProfileSnapshot[]>();
    for (const snapshot of all) {
      const group = byMember.get(snapshot.memberId);
      if (group) group.push(snapshot);
      else byMember.set(snapshot.memberId, [snapshot]);
    }
    const shared: Record<string, number | null> = {};
    for (const memberId of new Set(memberIds)) {
      const theirs = newestSnapshot(
        byMember.get(memberId) ?? [],
      )?.positivePreferences;
      shared[memberId] =
        own && theirs && memberId !== newestOwn?.memberId
          ? sharedPreferences(own, theirs).length
          : null;
    }
    return {
      accountId,
      own,
      ownMemberId: newestOwn?.memberId ?? null,
      shared,
    };
  }
}
