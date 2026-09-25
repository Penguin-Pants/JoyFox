export type CriterionState = "pass" | "fail" | "unknown";

export type TriagePlacement = "qualified" | "needs-review" | "quarantined";

import type { ContactRuleDefinition } from "../rules/contact-rule";

export type ExtractionResult<T> =
  | { status: "found"; value: T; source: string }
  | { status: "missing"; source?: string }
  | { status: "invalid"; source: string; reason: string };

export interface AccountScopedEntity {
  id: string;
  accountId: string;
  createdAt: string;
  updatedAt: string;
}

export interface ExtensionAccount extends AccountScopedEntity {
  joyClubAccountId: string;
  label?: string;
}

export interface JoyClubMember extends AccountScopedEntity {
  joyClubMemberId: string;
}

export interface ProfileSnapshot extends AccountScopedEntity {
  memberId: string;
  capturedAt: string;
  verification: boolean | "unknown";
  photoCount: number | "unknown";
  profileWordCount: number | "unknown";
  joinedAt: string | "unknown";
  /**
   * The window the member joined in, when the page gives only a relative
   * duration such as "Angemeldet seit 11 Monaten". Both are ISO dates and are
   * present together or not at all.
   */
  joinedEarliest?: string;
  joinedLatest?: string;
}

export interface UserNote extends AccountScopedEntity {
  memberId: string;
  body: string;
}
export interface UserTag extends AccountScopedEntity {
  memberId: string;
  label: string;
}
export interface TrustSignal extends AccountScopedEntity {
  memberId: string;
  kind: "positive" | "negative" | "neutral";
  occurredAt: string;
}
/**
 * A contact rule (M4) in the V1-compatible schema: audience, enabled state,
 * the placement for a sender who does not meet it, and a condition tree. See
 * `src/rules/contact-rule.ts`.
 */
export interface ContactRule
  extends AccountScopedEntity,
    ContactRuleDefinition {
  name: string;
}
/**
 * The user's manual triage placement for one sender (PRD Section 7.5). Only
 * a manual decision is stored: an automatic placement is recomputed from the
 * rule every time, so it can never go stale. The inbox shows no conversation
 * ID (01-inbox.md), so the record is keyed per sender, and `conversationId`
 * stays optional.
 */
export interface ConversationClassification extends AccountScopedEntity {
  memberId: string;
  conversationId?: string;
  placement: TriagePlacement;
  source: "user";
  decidedAt: string;
  ruleId?: string;
  reasons: string[];
}
export interface SavedSearch extends AccountScopedEntity {
  name: string;
  url: string;
  filters: unknown;
}
export interface EventMetadata extends AccountScopedEntity {
  eventId: string;
  note?: string;
  tags: string[];
  attendance: "interested" | "attending" | "not-attending" | "unknown";
}
export interface SpendLogEntry extends AccountScopedEntity {
  occurredAt: string;
  amountMinor: number;
  currency: string;
  category: "coins" | "membership" | "other";
}
export interface SyncConfig extends AccountScopedEntity {
  endpoint: string;
  lastSyncedAt?: string;
  keyDerivation: {
    algorithm: "PBKDF2";
    iterations: number;
    hash: "SHA-256";
    salt: string;
  };
}
export interface ExtensionPreference extends AccountScopedEntity {
  key: string;
  value: unknown;
}
/**
 * A reusable draft the user wrote (M10). `folder` organizes the list, for
 * example "Event confirmation"; a template without one is shown under
 * "General". The body is stored exactly as inserted.
 */
export interface MessageTemplate extends AccountScopedEntity {
  name: string;
  body: string;
  folder?: string;
}
export interface SpamPhrase extends AccountScopedEntity {
  phrase: string;
  enabled: boolean;
}
/**
 * Normalized text of a message the user already had on screen, kept so a later
 * message can be recognized as a near-duplicate of it. Only the normalized
 * form is stored, never the original formatting, and the store is purged on
 * the retention window in `docs/data-model.md`.
 */
export interface MessageObservation extends AccountScopedEntity {
  memberId: string;
  conversationId?: string;
  observedAt: string;
  normalizedText: string;
}
/**
 * A user correction that a sender's messages are not template spam. It is
 * per-sender and permanent until reversed, so a false positive is corrected
 * once rather than on every message.
 */
export interface SenderSpamOverride extends AccountScopedEntity {
  memberId: string;
  decision: "not-spam";
  decidedAt: string;
  reason?: string;
}
/**
 * A phrase from the user's own contact rule that a message from this sender
 * was seen to contain ("First message contains", ADR 0013). Only the result
 * is stored: the normalized phrase, never message text. A record stays met
 * after the sender's later messages, so a follow-up message cannot undo it.
 */
export interface MessagePhraseMatch extends AccountScopedEntity {
  memberId: string;
  /** The rule phrase in normalized form (`normalizePhrase`). */
  phrase: string;
  matchedAt: string;
}
export interface ActionLog extends AccountScopedEntity {
  memberId?: string;
  /** The conversation acted on, kept opaque (`personal-<n>-<n>`). */
  conversationId?: string;
  action: string;
  steps: Array<{ name: string; ok: boolean; at: string; errorCode?: string }>;
}

export interface EntityMap {
  extensionAccounts: ExtensionAccount;
  joyClubMembers: JoyClubMember;
  profileSnapshots: ProfileSnapshot;
  userNotes: UserNote;
  userTags: UserTag;
  trustSignals: TrustSignal;
  contactRules: ContactRule;
  conversationClassifications: ConversationClassification;
  savedSearches: SavedSearch;
  eventMetadata: EventMetadata;
  spendLogEntries: SpendLogEntry;
  syncConfigs: SyncConfig;
  extensionPreferences: ExtensionPreference;
  messageTemplates: MessageTemplate;
  spamPhrases: SpamPhrase;
  messageObservations: MessageObservation;
  senderSpamOverrides: SenderSpamOverride;
  actionLogs: ActionLog;
  messagePhraseMatches: MessagePhraseMatch;
}

export type EntityName = keyof EntityMap;
