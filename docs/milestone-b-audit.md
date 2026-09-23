# Milestone B audit

Milestone B is M1, M3, M5 and M7, built in the order the build plan's Section 32
recommends: M5 and M7 first as low-risk persistence validation (step 10), then
the qualification engine and M1 (steps 11 and 12), then the spam detector and M3
(steps 13 and 14).

## Decisions recorded

"Persönlich bekannt" (verification code `3`) is its own signal, on the project
owner's decision (2026-09-23). It means the user has met the member in person,
which the owner rates as higher trust than JoyClub's "geprüft". It is a separate
qualification criterion, `requirePersonallyKnown`, not a form of verification,
and it is never filled from a cached snapshot.

The owner also confirmed that the green shield replaces the grey one for a
member who is both, and that a member can be personally known without being
verified. So code `1` means "not personally known", and code `3` says nothing
about JoyClub's verification.

PRD Section 12.1 defines no entity for previous messages and none for a
per-sender spam correction, yet M3 requires both. Two entities were added at
schema version 2 on the project owner's decision: `MessageObservation`, holding
normalized message text as PRD Section 19.5 anticipates, and
`SenderSpamOverride`. Neither was inferred from the code; see
`docs/data-model.md`.

Cached profile facts do not expire, on the project owner's decision. A cached
fact counts until a newer observation replaces it or the user deletes it. See
`docs/architecture-decisions/0005-profile-fact-expiry.md`.

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

- Deterministic, local classifier. Normalization applies Unicode NFKC, removes
  default-ignorable characters, folds case, replaces punctuation with spaces and
  collapses whitespace.
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

### Confirmed issues fixed now, ported from the duplicate PR #6

PR #6 built the same M1 and M3 scope in parallel and was closed in favor of this
branch, because this branch follows ADR 0004. Its reviewers found 14 issues.
Eight still applied to this code and are fixed here, each with a regression test
confirmed to fail without the fix:

- Snapshots and message observations were ordered by timestamp text, so an older
  time with a `+02:00` offset could outrank a newer UTC time. The qualification
  merge, the snapshot retention purge and the spam comparison window now compare
  parsed instants.
- A future join date gave a negative account age that failed a minimum, so an
  extraction error could quarantine a sender. Build plan Section 8 requires
  extraction failures to appear as Unknown, so it is now unknown.
- `Date.parse` repairs `2026-02-30` and accepts trailing text. Join dates must
  now be strict ISO 8601 with real calendar values.
- `mergeProfileFacts` accepted any value that was not `unknown`, including a
  negative, fractional or unsafe-integer count. Such values are now treated as
  not observed, and the cached value is used instead.
- Default-ignorable characters such as U+200B or U+FE0F survived normalization
  and could hide a copied template. They are now removed.
- A message in a script written without spaces (Chinese, Japanese, Thai) was one
  "word" and never reached the minimum length, so it was never checked. Each
  character of such a script now counts as a word.
- A phrase of only combining marks matched a stray mark in any message. A phrase
  now needs a letter or digit.
- An override record was honored by ID alone. Its stored member must now also
  match the sender. `UNKNOWN_FACTS` is also frozen.

The other six did not apply: this branch has no snapshot-writing service, no
stored detector settings, uses counted trigrams rather than word-pair sets,
counts words rather than characters, and has no phrase-adding service.

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

## Live evidence (2026-09-22)

The inbox, conversation and profile pages are verified from sanitized evidence
in `docs/live-evidence/`. Page detection and pure extractors now resolve the
member ID, the conversation ID, verification and gender codes, photo count and
profile word count, with synthetic fixtures and tests. The F9 matrix is partly
done: account age comes from the profile's "Angemeldet seit" badge as a join
window, and the profile-type codes are not fully mapped.

## Blocked or remaining

- What an unverified member shows. Code `1` is confirmed as verified and code
  `3` as "personally known"; a missing shield and code `2` stay unknown.
- Reading message text, so nothing calls the spam detector yet. It needs the
  sent and received bubble meaning confirmed and the message-caching toggle from
  ADR 0004.
- The page UI for M3 (template label) and M5 (profile notes). The M1 badge and
  the content-script messaging were built in Milestone C
  (`milestone-c-audit.md`).
- Automatic active-account detection. M7 asks for reliable account identity
  detection; until F1 and F9 establish where that identity exists, the active
  account stays a user choice and the UI says so.

## Phase status

Milestone B is implemented to the limit that confirmed page behavior allows. M5,
M7, M1's qualification engine and M3's detector and persistence are complete and
tested, and the three pages they need are now verified and extracted. What
remains is the page UI and messaging, plus two confirmations: the verification
codes and the meaning of the message bubble sides.
