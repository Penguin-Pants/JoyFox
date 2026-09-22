# Data model

Database schema version 1 stores the 16 PRD entities in IndexedDB. Every record,
including an account record, has an account scope, stable local ID, and creation
and update timestamps. Physical keys combine the account and record IDs, each
percent-encoded so a value containing the separator cannot collide with another
account's key. Account indexes make scoped listing and deletion explicit.

The entities are ExtensionAccount, JoyClubMember, ProfileSnapshot, UserNote,
UserTag, TrustSignal, ContactRule, ConversationClassification, SavedSearch,
EventMetadata, SpendLogEntry, SyncConfig, ExtensionPreference, MessageTemplate,
SpamPhrase, and ActionLog.

One named repository exists per entity and exposes get, list, put, and delete.
Cross-account writes are rejected. Export includes the schema version and every
entity collection. Account deletion removes only records in the requested scope.
Features must never import the database implementation directly.

Repositories validate both shared metadata and the required fields for their
specific entity before opening a write transaction. SyncConfig rejects any
passphrase, secret, or derived-key property at runtime.

ProfileSnapshot is the one entity with a retention policy. Each write keeps the
newest 20 snapshots per member and purges older ones in the same transaction, so
this time-series personal data stays bounded. Every other entity keeps each
record until it is deleted explicitly.

Profile facts that cannot be observed are represented as `unknown`, never as a
negative result. Sync configuration may store explicit derivation parameters,
but never a passphrase.
