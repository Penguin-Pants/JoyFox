import type {
  ConversationClassification,
  ProfileSnapshot,
  TriagePlacement,
} from "../domain/types";
import { ExtensionError } from "../errors";
import {
  mergeProfileFacts,
  newestSnapshot,
  type ProfileFacts,
} from "../qualification/facts";
import {
  evaluateContactRule,
  PLACEMENT_TEXT,
  type RuleEvaluation,
  type SpamStatus,
} from "../rules/contact-rule";
import { GLOBAL_RULE_ID } from "../rules/rule-service";
import {
  runtimeSettingsArea,
  type SettingsArea,
} from "../storage/local-settings";
import { registerMember } from "../storage/member-directory";
import {
  ContactRuleRepository,
  ConversationClassificationRepository,
  JoyClubMemberRepository,
  ProfileSnapshotRepository,
  SenderSpamOverrideRepository,
  TrustSignalRepository,
} from "../storage/repositories";
import { bumpTriageRevision } from "../storage/triage-revision";
import { computeTrustScore, type TrustScore } from "../trust/trust-score";

/**
 * JoyClub member IDs are the digit run of a profile URL (03-profile.md).
 * Anything else reaching the background is refused, since a content script's
 * payload is only as trustworthy as the page it read.
 */
export const MEMBER_ID_PATTERN = /^\d{1,20}$/;
export const isMemberId = (value: unknown): value is string =>
  typeof value === "string" && MEMBER_ID_PATTERN.test(value);

/** The inbox renders about 25 rows per load; this bounds one request. */
export const MAX_MEMBERS_PER_REQUEST = 200;

export const classificationId = (memberId: string) =>
  `classification:${encodeURIComponent(memberId)}`;

export interface TriageRequestMember {
  memberId: string;
  /** Facts read from the current page. Unusable values count as not seen. */
  observed: Partial<ProfileFacts>;
}

export interface MemberTriage {
  memberId: string;
  placement: TriagePlacement;
  source: "rule" | "override";
  /** The user's manual placement, when one is stored. */
  override?: { placement: TriagePlacement; decidedAt: string };
  /** What the rule decides, shown even under an override for transparency. */
  automatic: RuleEvaluation;
  trust: TrustScore | "unknown";
}

/**
 * Every answer names the account it was computed for. The page sends that
 * account back with each write, and the background drops a write whose
 * account is no longer active, so a request made for one account can never
 * land in another.
 */
export type TriageResponse =
  | { status: "no-account" }
  | { status: "no-rule"; accountId: string }
  | { status: "rule-disabled"; accountId: string }
  | { status: "ok"; accountId: string; results: MemberTriage[] };

export type TrustResponse =
  | { status: "no-account" }
  | { status: "ok"; accountId: string; trust: TrustScore | "unknown" };

function requireAccountId(accountId: string): void {
  if (accountId.trim().length === 0)
    throw new ExtensionError(
      "IdentityMismatch",
      "Triage needs an explicit active account",
    );
}

function requireMemberId(memberId: unknown): asserts memberId is string {
  if (!isMemberId(memberId))
    throw new ExtensionError("IdentityMismatch", "Invalid member ID");
}

const SNAPSHOT_FIELDS = [
  "verification",
  "photoCount",
  "profileWordCount",
  "joinedAt",
  "joinedEarliest",
  "joinedLatest",
] as const;

/**
 * The background side of triage (M2, M4, M6). It reads storage for the
 * active account, merges page facts with cached snapshots, and hands
 * everything to the pure rule and trust functions. It never touches the DOM.
 */
export class TriageService {
  #sequence = 0;

  constructor(
    private readonly rules = new ContactRuleRepository(),
    private readonly snapshots = new ProfileSnapshotRepository(),
    private readonly classifications = new ConversationClassificationRepository(),
    private readonly spamOverrides = new SenderSpamOverrideRepository(),
    private readonly trustSignals = new TrustSignalRepository(),
    private readonly members = new JoyClubMemberRepository(),
    private readonly settings: SettingsArea = runtimeSettingsArea,
    private readonly now: () => Date = () => new Date(),
    private readonly newId: () => string = () => crypto.randomUUID(),
  ) {}

  async evaluate(
    accountId: string | undefined,
    requested: readonly TriageRequestMember[],
  ): Promise<TriageResponse> {
    if (!accountId) return { status: "no-account" };
    requireAccountId(accountId);
    if (requested.length > MAX_MEMBERS_PER_REQUEST)
      throw new ExtensionError("RuleEvaluationError", "Too many members");
    for (const member of requested) requireMemberId(member.memberId);
    const rule = await this.rules.get(accountId, GLOBAL_RULE_ID);
    if (!rule) return { status: "no-rule", accountId };
    if (!rule.enabled) return { status: "rule-disabled", accountId };

    // One read per store for the whole batch, grouped by member.
    const [snapshots, overrides, spamOverrides, signals] = await Promise.all([
      this.snapshots.list(accountId),
      this.classifications.list(accountId),
      this.spamOverrides.list(accountId),
      this.trustSignals.list(accountId),
    ]);
    const snapshotsByMember = groupBy(snapshots, (item) => item.memberId);
    const overrideByMember = new Map(
      overrides.map((item) => [item.memberId, item]),
    );
    const notSpam = new Set(spamOverrides.map((item) => item.memberId));
    const signalsByMember = groupBy(signals, (item) => item.memberId);
    const now = this.now();

    const results = requested.map((member): MemberTriage => {
      const cached = newestSnapshot(
        snapshotsByMember.get(member.memberId) ?? [],
      );
      const { facts, sources } = mergeProfileFacts(member.observed, cached);
      // No page reads message text yet, so the detector has nothing to
      // flag; only the user's own correction is known.
      const spam: SpamStatus = notSpam.has(member.memberId)
        ? "overridden"
        : "unknown";
      const trust = computeTrustScore({
        signals: signalsByMember.get(member.memberId) ?? [],
        spam,
        personallyKnown: facts.personallyKnown,
      });
      const automatic = evaluateContactRule(rule, {
        facts,
        sources,
        spam,
        trust,
        now,
      });
      const override = overrideByMember.get(member.memberId);
      return override
        ? {
            memberId: member.memberId,
            placement: override.placement,
            source: "override",
            override: {
              placement: override.placement,
              decidedAt: override.decidedAt,
            },
            automatic,
            trust,
          }
        : {
            memberId: member.memberId,
            placement: automatic.placement,
            source: "rule",
            automatic,
            trust,
          };
    });
    return { status: "ok", accountId, results };
  }

  /**
   * The trust score for one member without a rule, so a page can show and log
   * trust (M6) even while triage is off. Uses the same inputs as `evaluate`.
   */
  async trustFor(
    accountId: string | undefined,
    memberId: string,
    observed: Partial<ProfileFacts>,
  ): Promise<TrustResponse> {
    if (!accountId) return { status: "no-account" };
    requireAccountId(accountId);
    requireMemberId(memberId);
    const [spamOverrides, signals] = await Promise.all([
      this.spamOverrides.list(accountId),
      this.trustSignals.list(accountId),
    ]);
    const { facts } = mergeProfileFacts(observed);
    return {
      status: "ok",
      accountId,
      trust: computeTrustScore({
        signals: signals.filter((signal) => signal.memberId === memberId),
        spam: spamOverrides.some((item) => item.memberId === memberId)
          ? "overridden"
          : "unknown",
        personallyKnown: facts.personallyKnown,
      }),
    };
  }

  /** Store or clear (`null`) the user's manual placement for one sender. */
  async setOverride(
    accountId: string,
    memberId: string,
    placement: TriagePlacement | null,
  ): Promise<void> {
    requireAccountId(accountId);
    requireMemberId(memberId);
    const id = classificationId(memberId);
    if (placement === null) await this.classifications.delete(accountId, id);
    else {
      const timestamp = this.now().toISOString();
      const existing = await this.classifications.get(accountId, id);
      const record: ConversationClassification = {
        id,
        accountId,
        memberId,
        placement,
        source: "user",
        decidedAt: timestamp,
        ruleId: GLOBAL_RULE_ID,
        reasons: [`You moved this sender to ${PLACEMENT_TEXT[placement]}.`],
        createdAt: existing?.createdAt ?? timestamp,
        updatedAt: timestamp,
      };
      await registerMember(this.members, accountId, memberId, timestamp);
      await this.classifications.put(accountId, record);
    }
    await bumpTriageRevision(this.settings);
  }

  /**
   * Cache the profile facts a profile page showed, so the inbox can use them
   * later without opening the profile (build plan Section 8). Only counts,
   * codes and dates are stored, never profile text. Returns whether a record
   * was written: nothing is written when no fact was seen or when the facts
   * match the newest snapshot.
   */
  async captureSnapshot(
    accountId: string,
    memberId: string,
    observed: Partial<ProfileFacts>,
  ): Promise<boolean> {
    requireAccountId(accountId);
    requireMemberId(memberId);
    const { facts } = mergeProfileFacts(observed);
    const window =
      facts.joinedWindow === "unknown" ? undefined : facts.joinedWindow;
    const values = {
      verification: facts.verification,
      photoCount: facts.photoCount,
      profileWordCount: facts.profileWordCount,
      joinedAt: facts.joinedAt,
      ...(window
        ? { joinedEarliest: window.earliest, joinedLatest: window.latest }
        : {}),
    };
    const seen =
      values.verification !== "unknown" ||
      values.photoCount !== "unknown" ||
      values.profileWordCount !== "unknown" ||
      values.joinedAt !== "unknown" ||
      window !== undefined;
    if (!seen) return false;
    const all = await this.snapshots.list(accountId);
    const newest = newestSnapshot(
      all.filter((snapshot) => snapshot.memberId === memberId),
    );
    if (
      newest &&
      SNAPSHOT_FIELDS.every((field) =>
        sameSnapshotValue(
          field,
          newest[field],
          (values as Partial<ProfileSnapshot>)[field],
        ),
      )
    )
      return false;
    const timestamp = this.now().toISOString();
    const snapshot: ProfileSnapshot = {
      // Zero-padded sequence first, so two snapshots captured in the same
      // millisecond still sort in capture order (`newestCaptureFirst` breaks
      // ties on ID).
      id: `snapshot:${String((this.#sequence += 1)).padStart(12, "0")}:${this.newId()}`,
      accountId,
      memberId,
      capturedAt: timestamp,
      ...values,
      createdAt: timestamp,
      updatedAt: timestamp,
    };
    await registerMember(this.members, accountId, memberId, timestamp);
    await this.snapshots.put(accountId, snapshot);
    await bumpTriageRevision(this.settings);
    return true;
  }
}

/**
 * The join window is computed from "now" on every visit, so it shifts by
 * milliseconds each time. It counts as unchanged while it names the same days.
 */
function sameSnapshotValue(
  field: (typeof SNAPSHOT_FIELDS)[number],
  stored: unknown,
  fresh: unknown,
): boolean {
  if (
    (field === "joinedEarliest" || field === "joinedLatest") &&
    typeof stored === "string" &&
    typeof fresh === "string"
  )
    return stored.slice(0, 10) === fresh.slice(0, 10);
  return stored === fresh;
}

function groupBy<T>(items: readonly T[], key: (item: T) => string) {
  const groups = new Map<string, T[]>();
  for (const item of items) {
    const group = groups.get(key(item));
    if (group) group.push(item);
    else groups.set(key(item), [item]);
  }
  return groups;
}
