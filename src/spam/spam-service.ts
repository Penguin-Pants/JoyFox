import type { ExtensionPreference, SpamPhrase } from "../domain/types";
import { ExtensionError } from "../errors";
import type { MemberIdentity } from "../identity/member-identity";
import {
  disabled,
  ok,
  type PersistenceOutcome,
} from "../identity/persistence-outcome";
import { ensureMemberRegistered } from "../members/member-directory";
import {
  ExtensionPreferenceRepository,
  JoyClubMemberRepository,
  SpamPhraseRepository,
} from "../storage/repositories";
import {
  contentLength,
  normalizeMessage,
  RuleBasedTemplateDetector,
  type TemplateClassifier,
  type TemplateInput,
  type TemplateMatch,
  type TemplateVerdict,
} from "./template-detector";

export const MAX_PHRASE_LENGTH = 500;

export const phraseId = (normalized: string) =>
  `phrase:${encodeURIComponent(normalized)}`;
export const notSpamOverrideId = (memberId: string) =>
  `spam-override:${encodeURIComponent(memberId)}`;

/** The value stored in the ExtensionPreference that records a correction. */
export interface NotSpamOverride {
  kind: "not-spam";
  memberId: string;
}

/**
 * A flagged verdict the user has corrected for this sender. The matches stay
 * visible so the correction is transparent rather than silently hiding them.
 */
export type SpamVerdict =
  | TemplateVerdict
  | {
      status: "overridden";
      matches: TemplateMatch[];
      reasons: string[];
      overriddenAt: string;
    };

function requireAccountId(accountId: string): void {
  if (accountId.trim().length === 0)
    throw new ExtensionError(
      "IdentityMismatch",
      "Spam detection needs an explicit active account",
    );
}

/**
 * `ExtensionPreference.value` is untyped, so the whole record is checked: the
 * key and the stored member must both name this sender, or it is not treated
 * as a correction for them.
 */
function isOverrideFor(
  preference: ExtensionPreference | undefined,
  memberId: string,
): boolean {
  if (!preference || preference.key !== notSpamOverrideId(memberId))
    return false;
  const value = preference.value as Partial<NotSpamOverride> | null;
  return value?.kind === "not-spam" && value.memberId === memberId;
}

/**
 * M3 persistence around the pure detector: the user's editable phrase library
 * and the sender-specific "not spam" correction (build plan Section 10).
 */
export class SpamService {
  constructor(
    private readonly classifier: TemplateClassifier = new RuleBasedTemplateDetector(),
    private readonly phrases = new SpamPhraseRepository(),
    private readonly preferences = new ExtensionPreferenceRepository(),
    private readonly members = new JoyClubMemberRepository(),
    private readonly now: () => string = () => new Date().toISOString(),
  ) {}

  async listPhrases(accountId: string): Promise<SpamPhrase[]> {
    requireAccountId(accountId);
    return (await this.phrases.list(accountId)).sort((a, b) =>
      a.phrase.localeCompare(b.phrase),
    );
  }

  /** Adding a phrase that normalizes to an existing one keeps the existing record. */
  async addPhrase(accountId: string, phrase: string): Promise<SpamPhrase> {
    requireAccountId(accountId);
    const trimmed = phrase.trim().replace(/\s+/gu, " ");
    const normalized = normalizeMessage(trimmed);
    if (contentLength(normalized) === 0)
      throw new ExtensionError(
        "StorageError",
        "A spam phrase needs at least one letter or digit",
      );
    if (trimmed.length > MAX_PHRASE_LENGTH)
      throw new ExtensionError(
        "StorageError",
        `A spam phrase may not exceed ${MAX_PHRASE_LENGTH} characters`,
      );
    const id = phraseId(normalized);
    const existing = await this.phrases.get(accountId, id);
    if (existing) return existing;
    const timestamp = this.now();
    const record: SpamPhrase = {
      id,
      accountId,
      phrase: trimmed,
      enabled: true,
      createdAt: timestamp,
      updatedAt: timestamp,
    };
    await this.phrases.put(accountId, record);
    return record;
  }

  async setPhraseEnabled(
    accountId: string,
    id: string,
    enabled: boolean,
  ): Promise<SpamPhrase | undefined> {
    requireAccountId(accountId);
    const existing = await this.phrases.get(accountId, id);
    if (!existing) return undefined;
    const updated = { ...existing, enabled, updatedAt: this.now() };
    await this.phrases.put(accountId, updated);
    return updated;
  }

  async removePhrase(accountId: string, id: string): Promise<void> {
    requireAccountId(accountId);
    await this.phrases.delete(accountId, id);
  }

  /** One-click "not spam": remembered for this sender until it is removed. */
  async markNotSpam(
    accountId: string,
    identity: MemberIdentity,
  ): Promise<PersistenceOutcome<ExtensionPreference>> {
    requireAccountId(accountId);
    if (identity.status === "unresolved") return disabled(identity.reason);
    const id = notSpamOverrideId(identity.memberId);
    const existing = await this.preferences.get(accountId, id);
    if (existing && isOverrideFor(existing, identity.memberId))
      return ok(existing);
    const timestamp = this.now();
    // A malformed record under this ID is replaced, keeping its creation time.
    const value: NotSpamOverride = {
      kind: "not-spam",
      memberId: identity.memberId,
    };
    const record: ExtensionPreference = {
      id,
      accountId,
      key: id,
      value,
      createdAt: existing?.createdAt ?? timestamp,
      updatedAt: timestamp,
    };
    await ensureMemberRegistered(
      this.members,
      accountId,
      identity.memberId,
      timestamp,
    );
    await this.preferences.put(accountId, record);
    return ok(record);
  }

  async clearNotSpam(
    accountId: string,
    identity: MemberIdentity,
  ): Promise<PersistenceOutcome<void>> {
    requireAccountId(accountId);
    if (identity.status === "unresolved") return disabled(identity.reason);
    await this.preferences.delete(
      accountId,
      notSpamOverrideId(identity.memberId),
    );
    return ok(undefined);
  }

  /**
   * Classify against the enabled phrases. Prior messages come from the caller:
   * no message-history entity exists in the data model, so this service stores
   * no message text. A sender override is honored only for a resolved identity.
   */
  async classify(
    accountId: string,
    identity: MemberIdentity,
    input: Omit<TemplateInput, "phrases">,
  ): Promise<SpamVerdict> {
    requireAccountId(accountId);
    const phrases = (await this.phrases.list(accountId))
      .filter((phrase) => phrase.enabled)
      .map(({ id, phrase }) => ({ id, phrase }));
    const verdict = this.classifier.classify({ ...input, phrases });
    if (verdict.status !== "flagged" || identity.status === "unresolved")
      return verdict;
    const override = await this.preferences.get(
      accountId,
      notSpamOverrideId(identity.memberId),
    );
    if (!override || !isOverrideFor(override, identity.memberId))
      return verdict;
    return {
      status: "overridden",
      matches: verdict.matches,
      overriddenAt: override.updatedAt,
      reasons: [
        "You marked this sender as not spam, so the template flag is removed.",
        ...verdict.reasons,
      ],
    };
  }
}
