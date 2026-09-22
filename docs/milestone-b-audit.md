# Milestone B audit

Milestone B is M1, M3, M5 and M7. The first increment covered Section 32 step
10, M5 and M7. The second increment covers steps 11 to 14: the qualification
engine, M1, the spam detector and M3, each to the limit that verified selectors
allow.

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

### M1 sender qualification (second increment)

- `evaluateQualification` is a pure function. Each configured criterion
  (verification, minimum photo count, minimum profile word count, minimum
  account age in days) is `pass`, `fail` or `unknown`, with a plain-language
  reason and the source of the fact. Overall display is `Qualified`,
  `Partial information` or `Does not meet rule`. No percentage is shown.
- Unknown never becomes a pass or a fail. A malformed extraction, a negative
  count or a join date in the future is unknown. Any fail outranks unknown.
- `mergeProfileFacts` lets a fact observed now win, and otherwise takes the
  newest same-member snapshot that knows the fact, keeping its capture time.
- `defaultPlacement` implements the F9 default: partial goes to Needs Review, a
  failure goes to Quarantine. M2 and M4 own the final placement.
- `QualificationService` stores a ProfileSnapshot only for a resolved member
  identity, skips an all-unknown snapshot, and registers the member. Scoring an
  unresolved identity uses the current surface only and reports
  `cache: "unavailable"`.
- Criteria are a caller input. The persisted rule that supplies them is M4's
  ContactRule, so M1 adds no second rule store that M4 would need to migrate.
  With no criteria, the result is `Qualified`, which is the PRD Open preset.

### M3 template spam detector (second increment)

- `RuleBasedTemplateDetector` implements the `TemplateClassifier` interface, so
  a later classifier can replace it without a triage rewrite. It is local,
  deterministic and has no AI.
- Normalization: Unicode NFKC, default-ignorable characters removed, lowercase,
  punctuation and symbols to spaces, whitespace collapsed. Letters in any script
  stay as typed. In scripts written without spaces (Han, Kana, Thai, Lao, Khmer,
  Myanmar) each character is a token.
- Messages below a configurable minimum length (default 40 letters or digits
  after normalization) are `too-short` and never flagged.
- Similarity to earlier messages is Jaccard over word pairs (default 0.7). Saved
  phrases match exactly on word boundaries, or fuzzily by the share of the
  phrase's word pairs in the message (default 0.8).
- Every flag lists why. A reason names a saved phrase, which is the user's own
  text, but never repeats an earlier message's text.
- `SpamService` keeps the editable SpamPhrase library (add, deduplicate, enable,
  disable, remove) and the sender-specific "not spam" correction. The correction
  persists, is reversible, applies only to that sender, and turns a flag into
  `overridden` while the matches stay visible.

## Review findings

### Confirmed issues fixed now (second increment)

- A one-name substitution in a 16-word copy scored 0.78 against a 0.8 threshold
  and was missed. The prior-message default is now 0.7, and the arithmetic is
  recorded next to the setting.
- The exported `UNKNOWN_FACTS` default was a mutable shared object. It is now
  frozen.
- Member registration and the identity refusal outcome were private to M5 but
  are needed by M1 and M3. Both moved to shared modules without a behavior
  change, so the three services cannot drift apart.

### Confirmed issues fixed after PR review (second increment)

Automated review on PR #6 found six issues. Each was confirmed with a test that
fails on the reviewed commit and passes after the fix.

- Snapshots were ordered by `capturedAt` text, so an older date with a `+02:00`
  offset could outrank a newer UTC date. Merge and retention now compare parsed
  instants.
- Two snapshots of one member in the same millisecond had the same ID, so one
  overwrote the other. Snapshot IDs now carry a random part.
- A "not spam" record was accepted on `kind` alone. It now must name the sender
  in both its key and its value, and marking again repairs it.
- Detector settings could be changed after validation. They are now frozen.
- Invisible format characters such as U+200B survived normalization and could
  hide a copy. They are now removed.
- A saved phrase inside Chinese or Japanese text never matched, as the whole
  text was one word. Characters of unspaced scripts are now separate tokens, and
  the minimum length counts letters and digits only.

A second automated review round found six more, fixed the same way:

- Variation selectors such as U+FE0F are not format characters, so they still
  split a copy. Normalization now removes every default-ignorable character.
- With a minimum length of zero, two emoji-only messages both normalized to
  empty text and matched at 100%. A message without a letter or digit is now
  always too short.
- A join date later than the capture time was stored as known and would count
  once the clock passed it. It is now stored as unknown.
- Phrase containment used a set, so a phrase that repeats word pairs matched
  fully on a short fragment. Containment now counts repeats.
- `Date.parse` repairs `2026-02-30` and accepts trailing text. Join dates must
  now be strict ISO 8601 with a real calendar date and time.
- The minimum length counted UTF-16 code units, so supplementary-plane letters
  counted twice. It now counts letter and digit code points.

A third round found two more:

- A phrase of only combining marks passed the "needs a letter or digit" check,
  because the check measured string length. Phrase storage and matching now
  count letters and digits.
- A count above `Number.MAX_SAFE_INTEGER` may already be rounded but was
  accepted as known. Counts must now be safe integers.

### Confirmed issues deferred (second increment)

- Scoring and snapshot retention read every snapshot in the account and filter
  by member. This is the same missing member index as for tags and belongs with
  the M8 schema work.
- No message-history entity exists in the data model, so earlier messages for
  similarity are a caller input and nothing stores message text. Persisting a
  history, or fingerprints of it, is a data-model and privacy decision that the
  planning documents do not make.

### Possible risks (second increment)

- A cached fact can be old. The result carries each snapshot's capture time, but
  no expiry rule exists; the PRD says snapshots are never permanently accurate
  without setting an age limit.
- The 40-character minimum and the 0.7 and 0.8 thresholds are implementation
  choices. The acceptable false-positive rate is an open decision (Section 30).

### Confirmed issues fixed now (first increment)

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

### Confirmed issues deferred (first increment)

- Tags for one member are found by listing the account's tags and filtering. A
  member index would change the database schema, which belongs with the M8
  inspector work rather than here.
- Two concurrent `createAccount` calls could both pass the duplicate check, as
  the check and the write are separate transactions. The options page is
  single-user and serializes clicks, so this is recorded rather than fixed.

### Possible risks (first increment)

- Actions re-render without a queue. Rapid repeated clicks could render an
  intermediate state, although every render reads committed storage, so the
  settled state is correct.
- The note and tag size limits are this implementation's storage guards. Live
  observation may show JoyClub allows longer content worth keeping.

## Blocked by live verification

- The profile-page note and tag UI. M5 requires notes visible on a profile,
  which needs a verified profile page and member identifier from F1.
- Automatic active-account detection. M7 asks for reliable account identity
  detection; until F1 and F9 establish where that identity exists, the active
  account stays a user choice and the UI says so.
- The M1 badge in the inbox and conversation, and snapshot capture from a
  profile page. Both need F1 selectors and the F9 availability matrix.
- The M1 acceptance check (95 percent agreement with a manual check across 50
  real messages) needs live extraction.
- The M3 "looks like a template" label and one-click "not spam" control, and
  reading message text from the page. Both need F1 message and sender selectors.
- The M3 source of earlier messages. It needs either the message text visible on
  the current page (F1) or a decision to store a message history.
- The user interface for qualification criteria belongs with M4's rule builder.

## Phase status

Milestone B is partially complete. M5 and M7 are implemented to the limit that
verified selectors allow. The M1 qualification engine and service and the M3
detector and service are complete and tested; their page UI and live acceptance
wait on F1 and F9. Milestone B cannot close until that evidence exists.
