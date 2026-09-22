import type { ProfileSnapshot } from "../domain/types";
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
  ProfileSnapshotRepository,
} from "../storage/repositories";
import {
  evaluateQualification,
  mergeProfileFacts,
  type ProfileFacts,
  type QualificationCriteria,
  type QualificationResult,
} from "./qualification-engine";

export const snapshotId = (memberId: string, capturedAt: string) =>
  `snapshot:${encodeURIComponent(memberId)}:${encodeURIComponent(capturedAt)}`;

export interface QualificationOutcome extends QualificationResult {
  /**
   * `unavailable` when the member identity is unresolved: the result then uses
   * only what the current surface shows, and no cached snapshot is consulted.
   */
  cache: "used" | "unavailable";
}

function requireAccountId(accountId: string): void {
  if (accountId.trim().length === 0)
    throw new ExtensionError(
      "IdentityMismatch",
      "Qualification needs an explicit active account",
    );
}

/**
 * M1 pipeline from build plan Section 8: collect observed facts, merge with the
 * cached ProfileSnapshot, evaluate criteria and classify certainty. It never
 * navigates or fetches to fill a gap; a missing fact stays unknown.
 */
export class QualificationService {
  constructor(
    private readonly snapshots = new ProfileSnapshotRepository(),
    private readonly members = new JoyClubMemberRepository(),
    private readonly now: () => string = () => new Date().toISOString(),
  ) {}

  /**
   * Store what a profile page showed. A snapshot with no known fact adds
   * nothing and is not stored. Retention keeps the newest snapshots per member.
   */
  async recordSnapshot(
    accountId: string,
    identity: MemberIdentity,
    facts: ProfileFacts,
  ): Promise<PersistenceOutcome<ProfileSnapshot | undefined>> {
    requireAccountId(accountId);
    if (identity.status === "unresolved") return disabled(identity.reason);
    const merged = mergeProfileFacts(identity.memberId, facts, []);
    if (Object.values(merged).every((fact) => fact.value === "unknown"))
      return ok(undefined);
    const capturedAt = this.now();
    const snapshot: ProfileSnapshot = {
      id: snapshotId(identity.memberId, capturedAt),
      accountId,
      memberId: identity.memberId,
      capturedAt,
      verification: merged.verification.value,
      photoCount: merged.photoCount.value,
      profileWordCount: merged.profileWordCount.value,
      joinedAt: merged.joinedAt.value,
      createdAt: capturedAt,
      updatedAt: capturedAt,
    };
    await ensureMemberRegistered(
      this.members,
      accountId,
      identity.memberId,
      capturedAt,
    );
    await this.snapshots.put(accountId, snapshot);
    return ok(snapshot);
  }

  /**
   * Score a member. Criteria come from the caller: the persisted rule that
   * supplies them belongs to M4's ContactRule, so M1 does not invent a store.
   */
  async qualify(
    accountId: string,
    identity: MemberIdentity,
    observed: Partial<ProfileFacts>,
    criteria: QualificationCriteria,
  ): Promise<QualificationOutcome> {
    requireAccountId(accountId);
    if (identity.status === "unresolved") {
      const facts = mergeProfileFacts("", observed, []);
      return {
        ...evaluateQualification(facts, criteria, this.now()),
        cache: "unavailable",
      };
    }
    const cached = (await this.snapshots.list(accountId)).filter(
      (snapshot) => snapshot.memberId === identity.memberId,
    );
    const facts = mergeProfileFacts(identity.memberId, observed, cached);
    return {
      ...evaluateQualification(facts, criteria, this.now()),
      cache: "used",
    };
  }
}
