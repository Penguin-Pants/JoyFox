import type { MessageObservation, SenderSpamOverride } from "../domain/types";
import { ExtensionError } from "../errors";
import type { MemberIdentity } from "../identity/member-identity";
import {
  disabled,
  ok,
  type PersistenceOutcome,
} from "../identity/persistence-outcome";
import {
  MessageObservationRepository,
  SenderSpamOverrideRepository,
  SpamPhraseRepository,
} from "../storage/repositories";
import {
  detectTemplateSpam,
  type PriorMessage,
  type SpamDetectionOptions,
  type SpamDetectionResult,
} from "./detector";
import { normalizeMessage } from "./normalize";
import type { SimilarityEngine } from "./similarity";

export const overrideId = (memberId: string) =>
  `spam-override:${encodeURIComponent(memberId)}`;

/**
 * How many earlier messages a single classification compares against. The
 * newest are used, because a mass-pasted template shows up in recent traffic.
 * Without a bound, one classification would grow linearly with the cache.
 */
export const COMPARISON_WINDOW = 200;

export interface IncomingMessage {
  text: string;
  conversationId?: string;
  observedAt?: string;
}

export class SpamService {
  constructor(
    private readonly observations = new MessageObservationRepository(),
    private readonly overrides = new SenderSpamOverrideRepository(),
    private readonly phrases = new SpamPhraseRepository(),
    private readonly now: () => string = () => new Date().toISOString(),
    private readonly newId: () => string = () => crypto.randomUUID(),
    private readonly engine?: SimilarityEngine,
  ) {}

  #requireAccount(accountId: string): void {
    if (accountId.trim().length === 0)
      throw new ExtensionError(
        "IdentityMismatch",
        "Classification needs an explicit active account",
      );
  }

  async #priorMessages(
    accountId: string,
    excludeId?: string,
  ): Promise<PriorMessage[]> {
    const stored = await this.observations.list(accountId);
    // Newest first by instant, not by text: offsets and precision can differ.
    return stored
      .filter((observation) => observation.id !== excludeId)
      .sort(
        (a, b) =>
          Date.parse(b.observedAt) - Date.parse(a.observedAt) ||
          b.id.localeCompare(a.id),
      )
      .slice(0, COMPARISON_WINDOW)
      .map((observation) => ({
        id: observation.id,
        memberId: observation.memberId,
        normalizedText: observation.normalizedText,
      }));
  }

  /**
   * Classify a message without storing it. Recording is a separate step so a
   * message can never match itself: the caller classifies first, then records.
   */
  async classify(
    accountId: string,
    identity: MemberIdentity,
    message: IncomingMessage,
    options?: Partial<SpamDetectionOptions>,
  ): Promise<PersistenceOutcome<SpamDetectionResult>> {
    this.#requireAccount(accountId);
    if (identity.status === "unresolved") return disabled(identity.reason);
    const [priorMessages, phrases, override] = await Promise.all([
      this.#priorMessages(accountId),
      this.phrases.list(accountId),
      this.overrides.get(accountId, overrideId(identity.memberId)),
    ]);
    return ok(
      detectTemplateSpam({
        text: message.text,
        priorMessages,
        knownPhrases: phrases
          .filter((phrase) => phrase.enabled)
          .map((phrase) => ({ id: phrase.id, phrase: phrase.phrase })),
        // The record ID is derived from the member, but the stored member must
        // also match, so a corrupt or imported record cannot unflag someone else.
        senderOverridden: override?.memberId === identity.memberId,
        options,
        ...(this.engine ? { engine: this.engine } : {}),
      }),
    );
  }

  /**
   * Store the normalized form of a message the user already had on screen.
   * Only the normalized text is kept, never the original, and an empty
   * normalization is not stored because it can match nothing.
   */
  async record(
    accountId: string,
    identity: MemberIdentity,
    message: IncomingMessage,
  ): Promise<PersistenceOutcome<MessageObservation | undefined>> {
    this.#requireAccount(accountId);
    if (identity.status === "unresolved") return disabled(identity.reason);
    const normalizedText = normalizeMessage(message.text);
    if (normalizedText.length === 0) return ok(undefined);
    const timestamp = this.now();
    const observation: MessageObservation = {
      id: this.newId(),
      accountId,
      memberId: identity.memberId,
      ...(message.conversationId
        ? { conversationId: message.conversationId }
        : {}),
      observedAt: message.observedAt ?? timestamp,
      normalizedText,
      createdAt: timestamp,
      updatedAt: timestamp,
    };
    await this.observations.put(accountId, observation);
    return ok(observation);
  }

  async getOverride(
    accountId: string,
    identity: MemberIdentity,
  ): Promise<PersistenceOutcome<SenderSpamOverride | undefined>> {
    this.#requireAccount(accountId);
    if (identity.status === "unresolved") return disabled(identity.reason);
    return ok(
      await this.overrides.get(accountId, overrideId(identity.memberId)),
    );
  }

  /**
   * Record the user's "not spam" correction for this sender. The correction is
   * per-sender and survives restarts, so a false positive is fixed once.
   */
  async markNotSpam(
    accountId: string,
    identity: MemberIdentity,
    reason?: string,
  ): Promise<PersistenceOutcome<SenderSpamOverride>> {
    this.#requireAccount(accountId);
    if (identity.status === "unresolved") return disabled(identity.reason);
    const id = overrideId(identity.memberId);
    const existing = await this.overrides.get(accountId, id);
    const timestamp = this.now();
    const trimmed = reason?.trim();
    const override: SenderSpamOverride = {
      id,
      accountId,
      memberId: identity.memberId,
      decision: "not-spam",
      decidedAt: timestamp,
      ...(trimmed ? { reason: trimmed } : {}),
      createdAt: existing?.createdAt ?? timestamp,
      updatedAt: timestamp,
    };
    await this.overrides.put(accountId, override);
    return ok(override);
  }

  async clearNotSpam(
    accountId: string,
    identity: MemberIdentity,
  ): Promise<PersistenceOutcome<void>> {
    this.#requireAccount(accountId);
    if (identity.status === "unresolved") return disabled(identity.reason);
    await this.overrides.delete(accountId, overrideId(identity.memberId));
    return ok(undefined);
  }
}
