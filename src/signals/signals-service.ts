import type { ProfileSnapshot } from "../domain/types";
import {
  mergeProfileFacts,
  newestSnapshot,
  type ProfileFacts,
} from "../qualification/facts";
import {
  ProfileSnapshotRepository,
  SenderSpamOverrideRepository,
  TrustSignalRepository,
  UserNoteRepository,
  UserTagRepository,
} from "../storage/repositories";
import { computeTrustScore, type TrustScore } from "../trust/trust-score";
import { completeness, type Completeness } from "./completeness";

/** The most members one lookup may name; the content script splits more. */
export const MAX_SIGNAL_MEMBERS = 500;

/** Everything a card shows about one member (V1-10). */
export interface MemberSignals {
  completeness: Completeness;
  trust: TrustScore | "unknown";
  hasNote: boolean;
  tags: string[];
}

export interface SignalRequest {
  memberId: string;
  /** What the card itself shows, such as its verification shield. */
  observed: Partial<ProfileFacts>;
}

function groupBy<T extends { memberId: string }>(items: readonly T[]) {
  const groups = new Map<string, T[]>();
  for (const item of items) {
    const group = groups.get(item.memberId);
    if (group) group.push(item);
    else groups.set(item.memberId, [item]);
  }
  return groups;
}

/**
 * V1-10: the signals a card shows for a member, from the same sources the
 * profile page uses: the facts the card shows merged with the newest cached
 * snapshot, the local trust score, and the user's own note and tags. So a
 * card and the member's profile page show the same values.
 */
export class SignalsService {
  constructor(
    private readonly snapshots = new ProfileSnapshotRepository(),
    private readonly notes = new UserNoteRepository(),
    private readonly tags = new UserTagRepository(),
    private readonly trustSignals = new TrustSignalRepository(),
    private readonly spamOverrides = new SenderSpamOverrideRepository(),
  ) {}

  async lookup(
    accountId: string,
    members: readonly SignalRequest[],
  ): Promise<Record<string, MemberSignals>> {
    const [snapshots, notes, tags, signals, overrides] = await Promise.all([
      this.snapshots.list(accountId),
      this.notes.list(accountId),
      this.tags.list(accountId),
      this.trustSignals.list(accountId),
      this.spamOverrides.list(accountId),
    ]);
    const snapshotsBy = groupBy<ProfileSnapshot>(snapshots);
    const signalsBy = groupBy(signals);
    const tagsBy = groupBy(tags);
    const noted = new Set(notes.map((note) => note.memberId));
    const notSpam = new Set(overrides.map((item) => item.memberId));
    const answer: Record<string, MemberSignals> = {};
    for (const { memberId, observed } of members) {
      const { facts } = mergeProfileFacts(
        observed,
        newestSnapshot(snapshotsBy.get(memberId) ?? []),
      );
      answer[memberId] = {
        completeness: completeness(facts),
        trust: computeTrustScore({
          signals: signalsBy.get(memberId) ?? [],
          spam: notSpam.has(memberId) ? "overridden" : "unknown",
          personallyKnown: facts.personallyKnown,
        }),
        hasNote: noted.has(memberId),
        tags: (tagsBy.get(memberId) ?? [])
          .map((tag) => tag.label)
          .sort((a, b) => a.localeCompare(b)),
      };
    }
    return answer;
  }
}
