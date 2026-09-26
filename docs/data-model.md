# Data model

Database schema version 4 stores the 16 PRD entities plus two entities the
template spam detector requires and one for the "First message contains" rule
condition, in IndexedDB. Every record, including an account record, has an
account scope, stable local ID, and creation and update timestamps. Physical
keys combine the account and record IDs, each percent-encoded so a value
containing the separator cannot collide with another account's key. Account
indexes make scoped listing and deletion explicit.

Each extension context keeps one open connection. It closes that connection when
another context upgrades or deletes the database (`versionchange`), so it never
blocks that change, and opens a new one on its next read.

The PRD Section 12.1 entities are ExtensionAccount, JoyClubMember,
ProfileSnapshot, UserNote, UserTag, TrustSignal, ContactRule,
ConversationClassification, SavedSearch, EventMetadata, SpendLogEntry,
SyncConfig, ExtensionPreference, MessageTemplate, SpamPhrase, and ActionLog.

Version 2 adds MessageObservation and SenderSpamOverride. PRD Section 12.1
defines neither, but M3 needs both: it compares against previous local messages
and remembers a per-sender correction. This is recorded here rather than
inferred from the code.

Version 3 adds MessagePhraseMatch, for the "First message contains" rule
condition (ADR 0013).

EventMetadata (V1-5) holds the user's notes on one event or venue listing. Its
ID is `event:<n>` or `venue:<n>`, and `kind` says which (a record without it is
an event). Besides the note, tags and attendance, it keeps the listing's title,
start (`startLocal`, the event's local time as shown), path and venue, copied
from the page when the user saves, so a tracked event stays readable after
JoyClub removes the listing. A venue has no attendance. Clearing the note, tags
and attendance removes the record. These optional fields need no schema version:
older records stay valid. An older record with another ID is found by its event
ID, and the next save moves it to `event:<n>`. Each save gives a new
`updatedAt`, later than the stored one, so two saves in one clock tick still
give two versions.

One named repository exists per entity and exposes get, list, put, and delete.
Cross-account writes are rejected. Export includes the schema version and every
entity collection. Account deletion removes only records in the requested scope.
Features must never import the database implementation directly.

Repositories validate both shared metadata and the required fields for their
specific entity before opening a write transaction. SyncConfig rejects any
passphrase, secret, or derived-key property at runtime.

ProfileSnapshot and MessageObservation are the entities with a retention policy.
Each ProfileSnapshot write keeps the newest snapshots per member and purges
older ones in the same transaction, so this time-series personal data stays
bounded. The number is a setting (V1-12, `storage.local` key
`joyfox.snapshotRetention`): 20 by default, from 1 to 100, and always at least
the latest snapshot. Saving a lower number on the options page purges the older
snapshots of every member in every account at once. MessageObservation keeps a
365-day window instead. The bound is by count only: a cached fact does not
expire with age and counts until a newer observation replaces it (ADR 0005).
Every other entity keeps each record until it is deleted explicitly.

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

A save from the page editor names the note text it was typed over (`null` for
none). Under the account lock, the save is refused as a conflict if the stored
note differs, so a newer note from another tab or a delete in the data inspector
is never overwritten unseen. Text is compared rather than a timestamp. Every
committed note or tag write sets `joyfox.notesRevision` in `storage.local` to a
random token, so another open page reloads its editor at once. It is separate
from the triage revision, so a note does not make open inboxes re-evaluate.

## Cached messages (V1-4)

CachedMessage holds one ClubMail message the user had on screen, for
Conversation History Search. Its ID is `message:<messageId>`, where `messageId`
is JoyClub's own `cm-message-<uuid>`; it keeps the conversation ID
(`personal-<n>-<n>`), the other member's ID (one of the numbers in the
conversation ID), the direction (`sent` or `received`), the send time when the
page shows one, and the text as shown (1 to 10,000 characters). A message is
filed under the first conversation it was seen in and never moved. Messages are
stored only while `joyfox.messageCaching` is not `false`. The purge window is
`joyfox.messageRetentionMonths` (12 by default, 1 to 120): a message older than
the window, by its send time or else by when it was stored, is not stored, and
every store, a change of the window and an import delete the ones already older,
in every account. `joyfox.messageRevision` is a change marker for open options
pages.

## Schema versions

Version 1 created the 16 PRD entities. Version 2 adds `messageObservations` and
`senderSpamOverrides`. Version 3 adds `messagePhraseMatches`. Version 5 adds
`cachedMessages` (V1-4). Each version's upgrade branch creates only its own
stores, so a fresh install runs every branch in order without any store being
created twice. An upgrade from version 1 or 2 keeps every existing record. An
export names the database version; import accepts a file from this version or an
earlier one.

Version 4 adds no store. It rewrites `ConversationClassification.reasons` from
English text to catalog messages (`Message`, below), inside the upgrade
transaction (`src/storage/reason-migration.ts`):

- The exact sentence an earlier version wrote for the record's own placement
  (`You moved this sender to Qualified.`, `… Needs Review.` or `… Quarantined.`)
  becomes
  `{ key: "triage.reason.userMoved", params: { placement: { key: "placement.<record.placement>" } } }`.
- Any other string, including a similar sentence JoyFox did not write, becomes
  `{ key: "legacy.text", params: { text: <original> } }` and is shown verbatim
  in both languages.

An upgrade from version 1, 2 or 3 keeps every override.

## Message (schema version 4)

Text that code writes for display is stored and sent as a `Message`, never as
English text (docs/i18n-spec.md, ADR 0014). A `Message` is plain JSON: a catalog
`key` and, for a key whose text takes values, `params`. A param is a string
(always shown as is), a number (formatted for the language when shown), or a
nested `Message` (translated first). `src/i18n/message.ts` defines it, lists
each key's params in `MESSAGE_PARAMS`, and checks a stored value with
`isMessage`. The translator (`t()` in `src/i18n/translator.ts`) turns a
`Message` into text in the language shown.

Stored: `ConversationClassification.reasons` (`Message[]`). Runtime only: the
reasons of the qualification engine, the contact rule and the trust score, the
spam detector's findings, and the Quick Ignore and Delete notice. The validation
refuses a `reasons` item that is not a valid `Message`.

The UI language is `joyfox.locale` in `storage.local` (`"en"` or `"de"`),
global, not per account. It is written only when the user picks a language;
until then the language follows Firefox. "Delete all JoyFox data" removes it.

## MessageObservation

Holds the normalized text of a message the user already had on screen, keyed to
the account and the sender. Only the normalized form is stored, never the
original: normalization folds case, replaces punctuation with spaces and
collapses whitespace, which is what the detector compares. The field list is
closed by validation, so a field carrying the original text cannot be added to a
record by accident.

Retention follows PRD Section 13.3's default auto-purge window of 12 months. The
window is measured from the write, using `updatedAt`, not from the record's own
`observedAt`, so backdating one message cannot drag the cutoff back and keep
expired records alive. The record being written is never purged by its own
write.

## SenderSpamOverride

Holds one per-sender "not spam" correction, keyed `spam-override:<member>`. It
records the decision, when it was made and an optional user reason, so the
explanation shown for an unflagged message can name the user's own earlier
correction rather than appearing to be a silent exemption.

## MessagePhraseMatch

Records that a message from a sender contained a phrase from the user's own
contact rule, keyed `phrase-match:<member>:<phrase>`. It holds `memberId`, the
normalized `phrase` (`normalizePhrase`, at most 400 characters) and `matchedAt`.
It never holds message text: the inbox preview is compared in memory and
dropped. The field list is closed by validation, and import refuses a phrase
that is not in normalized form. A record keeps the condition met after the
sender's later messages hide the one that held the phrase. A record for a phrase
the rule no longer uses has no effect. No retention window applies: a record is
small and holds no message text.

## Join window

A ProfileSnapshot may carry `joinedEarliest` and `joinedLatest`, two ISO dates
that are present together or not at all, with the earliest not after the latest.
They hold the join window derived from the profile's "Angemeldet seit" badge.
They are optional fields on the existing store, so no database version change
was needed. `joinedAt` stays for an exact date, which JoyClub does not show
today.

## Preferences (V1-2)

A ProfileSnapshot may carry `positivePreferences`: the German labels of the tags
the profile's "Vorlieben" checklist lists at a positive level (Unbedingt, Steh
ich drauf, Situationsabhängig or Möchte ich gerne ausprobieren; ADR 0016, D5),
sorted and unique. On a couple profile a tag counts when either partner lists it
at a positive level. The field is absent when the checklist was not read; a
capture that could not read it keeps the newest known list, as the other fields
do. `ownProfile: true` marks a snapshot captured from the viewer's own profile.
The shared count for a member uses the newest snapshot of that member and of the
newest member marked as the viewer's own. Both are optional fields on the
existing store, so no database version change was needed. Import refuses more
than 500 labels or a label longer than 100 characters.

## Live-only profile facts

`personallyKnown` ("persönlich bekannt") is a profile fact for qualification but
has no ProfileSnapshot field. It is the logged-in user's own mark and can
change, so it is read from the current page each time and never cached.

## ContactRule (Milestone C)

The ContactRule entity now holds the V1-compatible rule schema from
`src/rules/contact-rule.ts`: `schemaVersion` (1, 2 or 3), `audience` (`all`,
`man`, `woman` or `couple`), `enabled`, `defaultPlacement` (`needs-review` or
`quarantined`, for a sender who does not meet the rule) and `root`, a tree of
All/Any groups (at most 4 levels, 32 children each) whose conditions each carry
a kind, an optional whole-number threshold, a `whenUnknown` handling and, from
schema version 2, an optional `negate: true` ("not", ADR 0012). Schema version 3
adds the `firstMessageContains` kind, whose `text` holds the word, phrase or
emoji as typed (1 to 100 characters, trimmed; ADR 0013). A rule is written with
the lowest version that holds it, so a rule without `negate` or a text condition
is still written as version 1. The earlier placeholder field `conditions` is
gone; no record with it could exist, as nothing wrote rules before. No database
version change was needed. The MVP keeps one rule per account, with ID
`rule:global`.

## ConversationClassification (Milestone C)

Holds only the user's manual placement for one sender, with ID
`classification:<member>`: `placement`, `source` (`user`), `decidedAt`, an
optional `ruleId` and the reasons as catalog messages (schema version 4).
`conversationId` is optional, because the inbox shows no conversation ID.
Clearing the placement deletes the record. Automatic placements are never
stored; they are recomputed from the rule.

## TrustSignal and snapshot capture (Milestone C)

Each logged outcome is one TrustSignal (`trust:<sequence>:<random>`, the
sequence zero-padded so the text order of IDs is the logging order). A profile
page stores a ProfileSnapshot when its facts differ from the newest one (the
join window is compared by day). Rule, placement, trust and snapshot writes set
`joyfox.triageRevision` in `storage.local` to a random token, so open pages
re-evaluate. Saving a note, placement, outcome or snapshot also registers the
JoyClubMember record.

## Data control (Milestone D, M8)

The options page's "Your data" panel reads counts, records and exports through
the repository layer (`src/storage/repositories.ts`) and `DataService`
(`src/data/data-service.ts`); nothing else reads a store directly.

- **Account export** (`scope: "account"`): `schemaVersion`, `exportedAt`,
  `accountId` and one array per entity in `ENTITY_NAMES`, empty when the account
  has none.
- **Full export** (`scope: "all"`): `schemaVersion`, `exportedAt` and every
  record in every store, whatever its scope. This includes records whose scope
  is not a registered account, such as the diagnostic wake counter, plus a
  `settings` object with every `storage.local` key.
- Both are indented JSON. `storageKey`, an internal key, is never exported. No
  passphrase exists to export (SyncConfig refuses one).
- **Delete record** and **delete entity** act in one account. **Delete account
  data** removes every record of the account except its ExtensionAccount record.
  The account record is removed only with the whole account (Accounts panel).
  **Delete all** clears every store and every `storage.local` key. See ADR 0007.
- Each export reads in one transaction. Account-wide deletes run in one
  transaction, so a failure leaves all records in place rather than some. A
  throw between requests aborts the transaction (`commitAll` in
  `src/storage/database.ts`); so do import writes, "delete all" and a write with
  its retention purge. Failure-injection tests prove each rollback.
- An account's JoyClub identifier is unique. The check and the write share one
  readwrite transaction (`addIfIdentifierFree`), which IndexedDB runs one at a
  time per store in every extension context. Every delete holds the account lock
  (and so the shared data lock; "delete all" holds it exclusively) and sets the
  triage revision, so open pages re-evaluate at once.

## MessageTemplate (Milestone D, M10)

`name` (at most 80 characters, whitespace collapsed), `body` (at most 4000
characters) and an optional `folder` (at most 40 characters). A template without
a folder shows under "General". The body is stored exactly, with line breaks as
`\n`, the form a textarea reports, so the inserted text equals the stored text.
IDs are `template:<random>`. The limits are storage guards chosen by this
implementation. `folder` is an optional field on the existing store, so no
database version change was needed.

## ActionLog (Milestone E, M9)

One record per Quick Ignore and Delete run: `action` is `quick-ignore-delete`,
`memberId` and an optional `conversationId` (the opaque `personal-<n>-<n>` from
the conversation URL) name the target, and `steps` holds one entry per state
reached, in order, each with `name`, `ok`, `at` and, for `Failed`, the reason in
`errorCode`. IDs are `action:<time>:<sequence>:<random>`.

The service appends a step only when the state machine allows it (ADR 0008), so
a log never shows an impossible sequence. `…Requested` is stored before JoyFox
clicks, so a crash leaves "not confirmed", never "not done". A run whose last
step is not terminal and is older than 2 minutes reads as interrupted; a run
still at `Started` does so after 30 seconds (ADR 0008). The log holds IDs, state
names and times only, never message text. Starting a run also registers the
JoyClubMember record. Every stored transition sets `joyfox.actionRevision` in
`storage.local`, so another open tab follows the run. `conversationId` is an
optional field on the existing store, so no database version change was needed.

## Import (owner request, ADR 0009)

"Your data" imports both export scopes and merges them into stored data. The
file is checked record by record against the same validation every repository
write uses, and any problem refuses the whole file. Accounts are matched by
JoyClub identifier; conflicts follow ADR 0009. All records are written in one
transaction through `putRecords` in `src/storage/repositories.ts`, the only
writer besides the repository classes. Retention is not applied while the
records are written. Right after an import, the profile snapshot limit in effect
is applied to every member (V1-12); the cached-message window applies on the
next write.

Exports carry `schemaVersion: 4`. Import still accepts versions 1 to 3 and
converts their English reasons as the version 4 upgrade does, before the file is
checked. `joyfox.locale` is imported only when it is `"en"` or `"de"` and no
language is stored here. Each refusal carries a display message, so the UI
states it in the language shown.
