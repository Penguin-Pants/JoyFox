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
- The page UI for M3 (template label). It waits on reading message text, above.
  The M5 editor is done (see "M5 note and tag editor" below). The M1 badge and
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

## M5 note and tag editor (2026-09-23)

The profile and conversation pages are verified (`docs/live-evidence/`), so the
M5 page UI no longer waits on F1. It is built here.

### Completed

- An editor for one private note and any number of tags, after the JoyFox member
  panel on the profile page and on a conversation page (PRD Sections 8.4, 10.1
  and 10.2, flow 2). It appears only for a member ID read through a verified
  selector, and only while an account is active. It is closed while the member
  has no note or tag, and open when there is one.
- Four typed messages: `note.get`, `note.save`, `tag.add` and `tag.remove`
  (Technical Design names `note.save`). Every write names the account its data
  came from and runs under that account's lock; the background refuses it if the
  account is no longer active.
- A save names the note text it was typed over. If the stored note differs (a
  save in another tab, a delete in the data inspector), the save is refused, the
  typed text stays in the box and the user is told. Saving again replaces the
  note.
- Typed text survives a redraw, and focus and the cursor position are restored.
  A keystroke never redraws the editor. Typed text is dropped on an account
  switch or a route to another member, so it cannot be saved under the wrong
  account or member.
- Every control has a label or a name, works by keyboard (Enter adds a tag) and
  shows its result in a polite live region. No state relies on color.
- A delete in the data inspector sets the triage revision, which now also
  reloads an open editor.
- The M5 acceptance, "a note survives a restart and a markup change that keeps
  the same profile ID", is an integration test: a new editor instance on changed
  markup with the same profile URL shows the saved note.

### Review findings

A self-review of the diff found two code issues and one test gap. All are fixed,
each with a regression test confirmed to fail without the fix:

- A save's answer that arrived after an account switch was checked only against
  the page and member, which stay the same across a switch. A late "conflict"
  answer could then put account A's typed text into account B's editor. Each
  answer is now checked against a session that an account switch or a route
  change ends.
- A double click on "Save note" sent two saves with the same expected note, so
  the second reported a false "changed elsewhere" conflict. A click while a save
  runs is now ignored.
- A test for the stale-overwrite guard passed even with the guard removed,
  because it never reloaded between typing and saving. A test that reloads first
  was added and fails without the guard.

An independent review then found seven more. All were confirmed; six are fixed
with regression tests confirmed to fail without the fix, and one is reworded and
partly deferred:

- Typed text was not tied to an account. If the options page switched accounts
  before this tab heard of it, a refused save reloaded the editor with the new
  account's note but kept the typed text, and a second save stored it in the new
  account. A load that returns another account, and a refused write, now drop
  typed text and say so.
- Note and tag writes did not tell other tabs, so a second tab kept a stale note
  and then showed a conflict about text the user never saw. Every committed
  write now sets a notes revision in `storage.local`, and open pages reload the
  editor.
- `leave()` dropped typed text when JoyClub hid the header for a moment. Typed
  text now stays for the same member; another member or account drops it.
- After "Discard my changes" the focused button was disabled, so focus fell to
  the page. Focus now moves to the note box. The summary also keeps focus across
  a redraw.
- A save pending for one member blocked "Save note" for the next member without
  any message. The guard is now per member and account.
- The status line was hidden while empty, which can stop a screen reader from
  announcing the first status. It now stays in the accessibility tree.
- The scope text said JoyClub and the member never see the note. The editor is
  part of JoyClub's page, so its scripts could read the text. The text now says
  only what JoyFox does: it stores the note in this browser and never sends it.
  Isolating the editor is deferred (below).

Two small gaps found while fixing these are fixed too, with tests: a status
about the previous account's note stayed on screen after a switch, and saving an
empty box with no stored note reported "Note removed." It now says to type a
note first and sends nothing.

### Confirmed issues deferred

- Notes and tags on the inbox, search and event surfaces. Build plan Section 12
  puts them "later", and search and events are unverified.
- Isolating the editor from JoyClub's scripts, for example in a closed shadow
  root. It needs its own styles and would still not stop a page script that
  records keystrokes, so it needs a design decision first.

### Possible risks

- JoyClub re-rendering the header could move the editor. It follows the header
  on the next update, like the member panel.

### Validation

`npm test`, `npm run lint` (including the permission allowlist),
`npm run typecheck`, `npm run format:check` and `npm run build:firefox` pass. No
permission was added and the schema version is unchanged.

### Status

The editor is complete and tested. Live acceptance is `manual-acceptance.md`,
items 36 to 42, and is pending.
