export type CriterionState = "pass" | "fail" | "unknown";

export type TriagePlacement = "qualified" | "needs-review" | "quarantined";

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
export interface ContactRule extends AccountScopedEntity {
  name: string;
  conditions: unknown[];
  defaultPlacement: TriagePlacement;
}
export interface ConversationClassification extends AccountScopedEntity {
  memberId: string;
  conversationId: string;
  placement: TriagePlacement;
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
export interface MessageTemplate extends AccountScopedEntity {
  name: string;
  body: string;
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
export interface ActionLog extends AccountScopedEntity {
  memberId?: string;
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
}

export type EntityName = keyof EntityMap;
