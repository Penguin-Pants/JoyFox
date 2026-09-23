# Data model

Database schema version 2 stores the 16 PRD entities plus two entities the
template spam detector requires, in IndexedDB. Every record, including an
account record, has an account scope, stable local ID, and creation and update
timestamps. Physical keys combine the account and record IDs, each
percent-encoded so a value containing the separator cannot collide with another
account's key. Account indexes make scoped listing and deletion explicit.

The PRD Section 12.1 entities are ExtensionAccount, JoyClubMember,
ProfileSnapshot, UserNote, UserTag, TrustSignal, ContactRule,
ConversationClassification, SavedSearch, EventMetadata, SpendLogEntry,
SyncConfig, ExtensionPreference, MessageTemplate, SpamPhrase, and ActionLog.

Version 2 adds MessageObservation and SenderSpamOverride. PRD Section 12.1
defines neither, but M3 needs both: it compares against previous local messages
and remembers a per-sender correction. This is recorded here rather than
inferred from the code.

One named repository exists per entity and exposes get, list, put, and delete.
Cross-account writes are rejected. Export includes the schema version and every
entity collection. Account deletion removes only records in the requested scope.
Features must never import the database implementation directly.

Repositories validate both shared metadata and the required fields for their
specific entity before opening a write transaction. SyncConfig rejects any
passphrase, secret, or derived-key property at runtime.

ProfileSnapshot and MessageObservation are the entities with a retention policy.
Each write keeps the newest 20 snapshots per member and purges older ones in the
same transaction, so this time-series personal data stays bounded. The bound is
by count only: a cached fact does not expire with age and counts until a newer
observation replaces it (ADR 0005). Every other entity keeps each record until
it is deleted explicitly.

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

## Schema versions

Version 1 created the 16 PRD entities. Version 2 adds `messageObservations` and
`senderSpamOverrides`. Each version's upgrade branch creates only its own
stores, so a fresh install runs both branches in order without any store being
created twice. An upgrade from version 1 keeps every existing record.

## MessageObservation

Holds the normalized text of a message the user already had on screen, keyed to
the account and the sender. Only the normalized form is stored, never the
original: normalization folds case, replaces punctuation with spaces and
collapses whitespace, which is what the detector compares. The field list is
closed by validation, so a field carrying the original text cannot be added to a
record by accident.

Retention follows PRD Section 19.5's default auto-purge window of 12 months. The
window is measured from the write, using `updatedAt`, not from the record's own
`observedAt`, so backdating one message cannot drag the cutoff back and keep
expired records alive. The record being written is never purged by its own
write.

## SenderSpamOverride

Holds one per-sender "not spam" correction, keyed `spam-override:<member>`. It
records the decision, when it was made and an optional user reason, so the
explanation shown for an unflagged message can name the user's own earlier
correction rather than appearing to be a silent exemption.

## Live-only profile facts

`personallyKnown` ("persönlich bekannt") is a profile fact for qualification but
has no ProfileSnapshot field. It is the logged-in user's own mark and can
change, so it is read from the current page each time and never cached.
