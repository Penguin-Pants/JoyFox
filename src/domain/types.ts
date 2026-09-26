import type { Message } from "../i18n/message";

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
  /**
   * Why the sender is placed here, as catalog messages translated when
   * shown. Schema version 4 migrated the English strings of earlier
   * versions.
   */
  reasons: Message[];
}
export interface SavedSearch extends AccountScopedEntity {
  name: string;
  url: string;
  filters: unknown;
}
/**
 * The user's own notes on one event or venue listing (V1-5). The record ID
 * is `event:<id>` or `venue:<id>`. The listing facts (title, start, address
 * and venue) are copied from the page when the user saves, so a tracked
 * event stays readable after JoyClub removes the listing (PRD 6.3).
 */
export interface EventMetadata extends AccountScopedEntity {
  /** JoyClub's number for the event or venue (`/event/<n>…`, `/club/<n>…`). */
  eventId: string;
  /** Absent in records from before V1-5, which were events. */
  kind?: "event" | "venue";
  /** The event title or venue name as the page showed it. */
  title?: string;
  /** The event's start in its local time, `YYYY-MM-DD` or `YYYY-MM-DDTHH:mm`. */
  startLocal?: string;
  /** The listing's path on JoyClub, for example `/event/<n>.<slug>.html`. */
  path?: string;
  venueId?: string;
  venueName?: string;
  note?: string;
  tags: string[];
  /** The user's own plan or record, never sent to JoyClub (D6, ADR 0016). */
  attendance:
    | "interested"
    | "attending"
    | "not-attending"
    | "attended"
    | "unknown";
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
