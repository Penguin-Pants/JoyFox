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

## Account directory and record keys

An ExtensionAccount is its own scope: its `accountId` equals its `id`. The
account repository therefore offers one extra read, `listAllAccounts`, because
the active scope is chosen from that directory before any scope exists. No other
store may be read without a scope.

The active account is a pointer, not a record. It lives in `storage.local` under
`joyfox.activeAccountId` so it can be read before the database opens. A pointer
that no longer resolves reports no active account rather than falling back to
another one.

Notes and tags derive their record IDs from the member identity: `note:<member>`
and `tag:<member>:<tag key>`, each component percent-encoded so an identifier
containing the separator cannot collide. A member carries at most one note per
account. A tag key is the label with whitespace collapsed and case folded, so
one member cannot hold two spellings of the same tag. The stored label keeps the
spelling the user typed.

Saving a note or tag also registers the JoyClubMember record it refers to, so an
export carries the member directory rather than dangling member IDs.

## Qualification and spam records

A ProfileSnapshot ID is `snapshot:<member>:<captured at>`, each component
percent-encoded. A snapshot is written only for a resolved member identity and
never when every fact is unknown. Merging takes a fact observed now first, then
the newest same-member snapshot that knows it.

A SpamPhrase ID is `phrase:<normalized phrase>`, so two spellings that normalize
alike are one record. The stored phrase keeps the spelling the user typed.

The sender-specific "not spam" correction is an ExtensionPreference with ID and
key `spam-override:<member>` and the value `{ kind: "not-spam", memberId }`. A
preference under that key with any other value is not treated as a correction.
No schema change was needed.

No entity stores message text. Earlier messages for similarity are supplied by
the caller for one classification and are not persisted.
