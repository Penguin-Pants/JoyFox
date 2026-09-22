# Milestone B audit

Milestone B is M1, M3, M5 and M7, built in the order the build plan's Section 32
recommends: M5 and M7 first as low-risk persistence validation (step 10), then
the qualification engine and M1 (steps 11 and 12), then the spam detector and M3
(steps 13 and 14).

## Decisions recorded

PRD Section 12.1 defines no entity for previous messages and none for a
per-sender spam correction, yet M3 requires both. Two entities were added at
schema version 2 on the project owner's decision: `MessageObservation`, holding
normalized message text as PRD Section 19.5 anticipates, and
`SenderSpamOverride`. Neither was inferred from the code; see
`docs/data-model.md`.

## Completed

### M7 multi-account isolation

- Explicit active account. The pointer lives in `storage.local`, not in an
  account-scoped store, so it is readable before a scope exists. A pointer that
  no longer resolves reports no active account instead of selecting another.
- Account directory in the ExtensionAccount store, each record self-scoped.
- Options page with an account switcher that names the active account in words,
  marks each row `Active` or `Not active`, labels every control, and states that
  JoyFox cannot detect the JoyClub login.
- Account removal deletes every record in that scope and asks for a second,
  explicit click first.
- The isolation test from Section 14 runs as an integration test: data under
  account A stays invisible and unchanged while account B is active, export
  covers one scope only, and a record whose `accountId` disagrees with the write
  scope is rejected.

### M5 profile notes and tags

- `NotesService` keys notes and tags to the account plus a resolved member
  identity, one note per member, tags deduplicated case-insensitively with the
  typed spelling kept.
- `resolveMemberIdentity` refuses a display-name field outright, refuses any
  field without a verified selector, and refuses an identifier that cannot serve
  as a storage key. A refusal is a returned value with user-facing text, not an
  exception.
- Saving also registers the JoyClubMember record, so an export has no dangling
  member IDs.
- Typed error categories from Section 21 now exist in `src/errors.ts`.

### M3 template spam detector

- Deterministic, local classifier. Normalization folds case, replaces
  punctuation with spaces and collapses whitespace, after Unicode NFKC.
- The similarity engine sits behind a `SimilarityEngine` interface, so a future
  classifier replaces it without the detector or triage changing. The shipped
  implementation is a Dice coefficient over character trigrams.
- Matching covers both previous local messages and the SpamPhrase list, by
  substring containment or similarity.
- `detectTemplateSpam` is pure: no DOM, no storage. Every verdict carries an
  explanation, including the verdicts that do not flag, and no explanation
  contains message text.
- A configurable minimum message length suppresses matching on short openers.
- `SpamService` persists observations and the per-sender "not spam" correction.
  Classification reads before recording, so a message can never match itself.
- Schema version 2 adds `messageObservations` and `senderSpamOverrides`, with a
  migration that keeps every version 1 record.

### M1 qualification engine

- `evaluateQualification` is a pure function over merged profile facts and the
  caller's criteria. It reads no DOM and no storage.
- Each criterion resolves to pass, fail or unknown, and the overall result is
  one of the three documented states. There is no numeric score, because no
  scoring formula is defined.
- F9's decision is implemented and tested: a missing fact is unknown, unknown is
  never a failure, and a partial result is Needs Review unless a criterion
  explicitly failed, which is Quarantine.
- `mergeProfileFacts` prefers a fact rendered on the current surface over the
  cached snapshot and falls back to the snapshot for anything the surface did
  not render, so no profile is opened to complete a score. Each evaluated
  criterion reports which source supplied its fact.

## Review findings

### Confirmed issues fixed now, M1 and M3 increment

- The message retention window was measured from the record's own `observedAt`.
  A caller passing a backdated observation would have dragged the cutoff back
  with it and kept every expired record alive. It is now measured from the
  write, using `updatedAt`.
- The retention purge could delete the record being written, in the same
  transaction, when that record was already older than the window. `put` would
  then have reported storing something that no longer existed. The record being
  written is now excluded from its own purge.

### Confirmed issues fixed now, M5 and M7 increment

- The removal confirmation stayed armed after the user did something else, so a
  single later click could delete an account without a fresh warning. Any other
  action, and any failure, now disarms it.
- Unstable identity field names were matched case-sensitively, so a registry
  spelling of `SenderName` would have passed a guard that `senderName` failed.
  The comparison now ignores case.
- The status message was a new element on every render, which can leave a live
  region's announcement unread. One live region is now created once and reused.
  Its state rides on `data-kind` rather than a mutated class list.
- `mountAccountPanel` could mount a second panel on the same element. It now
  returns the panel already mounted there.
- `src/errors.ts` declared an error code no caller used and the build plan does
  not list. It was removed.

### Confirmed issues deferred

- Tags for one member are found by listing the account's tags and filtering. A
  member index would change the database schema, which belongs with the M8
  inspector work rather than here.
- Two concurrent `createAccount` calls could both pass the duplicate check, as
  the check and the write are separate transactions. The options page is
  single-user and serializes clicks, so this is recorded rather than fixed.

### Possible risks

- Actions re-render without a queue. Rapid repeated clicks could render an
  intermediate state, although every render reads committed storage, so the
  settled state is correct.
- The note and tag size limits are this implementation's storage guards. Live
  observation may show JoyClub allows longer content worth keeping.
- The spam thresholds are provisional, and Section 30 keeps the acceptable
  false-positive threshold open. Real traffic may show trigram similarity is the
  wrong measure for short German openers, in which case the engine interface is
  the seam to replace.
- A one or two character entry in the user's phrase list would flag nearly every
  message through substring containment. No minimum phrase length is documented,
  so none is enforced.

## Blocked by live verification

- Reading messages from a page, so nothing calls the spam detector yet.
- M1's remaining pipeline stages: resolving the member, collecting observed
  profile facts and rendering the badge. Only the engine and the fact merge can
  be built without selectors.
- The F9 availability matrix, which decides which facts arrive from an inbox row
  rather than a profile. The engine handles either, since an absent fact is
  unknown, but the matrix is still needed before M1's live acceptance.
- The profile-page note and tag UI. M5 requires notes visible on a profile,
  which needs a verified profile page and member identifier from F1.
- Automatic active-account detection. M7 asks for reliable account identity
  detection; until F1 and F9 establish where that identity exists, the active
  account stays a user choice and the UI says so.
- M1 and M3, the rest of Milestone B. M1 additionally depends on the F9
  availability matrix.

## Phase status

Milestone B is implemented to the limit that verified selectors allow. M5, M7,
M1's qualification engine and M3's detector and persistence are complete and
tested. What remains in all four is the part that must read a JoyClub page,
which waits on F1, and for M1 also on F9.
