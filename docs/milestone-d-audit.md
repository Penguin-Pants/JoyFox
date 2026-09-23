# Milestone D audit

Milestone D is M8 and M10 (build plan Section 27): the user can inspect all
stored data, export it, remove it and use safe composition assistance. The open
design decisions are in
`architecture-decisions/0007-data-control-and-template-trial.md`.

## Completed

### M8 data inspector, export and delete

- The "Your data" panel on the options page has an account selector (it inspects
  any account and does not change the active one), a record count for each of
  the 18 entities, and per-entity inspection. Records show as JSON text, 50 at a
  time.
- Deletes: one record, one data type, one account's data (the account itself
  stays) and all JoyFox data. Each one acts only on a second, explicit click.
  The account record is deleted only with the whole account.
- "Delete all JoyFox data" empties every store, whatever its scope, and every
  `storage.local` key. It clears the active pointer first and holds every
  account lock while it deletes.
- Two JSON exports, indented, with `schemaVersion`. The account export holds
  every entity of one account. The full export holds every record in every store
  and every `storage.local` setting. It uses no `downloads` permission.
- Account-wide deletes and both exports each run in one transaction.
- Every delete holds the account lock and sets the triage revision, so open
  JoyClub pages re-evaluate at once.
- Export completeness is tested item by item against every entity (build plan
  Section 23), for one account and for everything.

### M10 message templates

- Create, edit, delete and organize into folders on the options page. The PRD
  folders are offered as suggestions. The body is stored exactly, with line
  breaks in the form a textarea reports.
- `insertAtCursor` inserts at the cursor, replacing a selection, and sends
  `input` and `change`. It refuses a disabled, read-only or detached field, and
  a result that would pass `maxlength` (never truncates). It reports when the
  page changes the text afterwards. It never submits or clicks Send; a test
  proves both.
- The composer picker sits after JoyClub's form, groups templates by folder and
  reads them fresh from the background (`template.list`, read-only) on each
  opening. It first ran only as an opt-in trial. After the live check it is on
  by default, and `joyfox.templatePicker` set to `false` turns it off (ADR
  0007).

## Review findings

An independent review of the full diff was done before push. All findings below
were confirmed by reading the code.

### Confirmed issues fixed now

- A double-click on a delete button could arm and confirm it in one gesture,
  including "Delete all JoyFox data". A button drawn unarmed now only arms. A
  confirming click is accepted only as a single click, 500 ms or more after
  arming. A regression test fails without the fix.
- "Delete all" read the account list before taking locks, so an account added in
  another tab meanwhile could survive, and `storage.local` was cleared after the
  locks were released. The settings are now cleared inside the locks, and the
  account list is read again; a survivor is reported as a failure instead of
  success.
- Saving an edit of a template another tab deleted failed on every retry, and
  "Cancel editing" discarded the typed text. The form now switches to "Add a
  template" and keeps the text.
- The options page said a template "fills JoyClub's message field", but the
  picker is off by default. The text now says insertion is an opt-in trial.
- The full export left out the `storage.local` settings that "delete all"
  removes. It now includes them. The account export now reads in one
  transaction, like the full export.
- The `template.list` handler and the picker's close on an account switch had no
  tests. Both do now.

A Codex review of PR #15 found three more, all confirmed and fixed:

- Inbox teardown removed every JoyFox node except the member panel, so it
  removed the template picker on each navigation event of a conversation page
  without a visible list. The picker then remounted, which caused another event,
  in a loop, and an open template list closed at once. Teardown now leaves the
  picker in place.
- "Delete all" locked only registered accounts. A write to another scope (the
  diagnostic wake counter) could land after the clear and was not detected. It
  now locks every scope that holds data, the wake counter takes its scope's
  lock, and success needs every store to be empty.
- The template panel kept its status text after an account switch, so a message
  naming the previous account's template stayed on screen. A switch now clears
  it.

Each fix has a regression test confirmed to fail without it.

A second Codex review of PR #15 found four more after it merged. All were
confirmed and fixed in a follow-up PR:

- Account creation and account switches wrote without a lock, so "delete all"
  could report success over a new account or active pointer. Every account lock
  now also holds a global data lock in shared mode. "Delete all" takes it
  exclusively, and account creation now runs under its new account's lock.
- A template save or delete checked the active account before taking the lock,
  and a switch did not lock, so a write could land in the account just left. A
  switch now holds the locks of the account left and the one activated, and
  template writes check the active account inside the lock. Rule saves and
  background writes, which already checked inside the lock, gain the same
  guarantee.
- A double submit of "Add template" stored two templates. The form now ignores a
  submit while a save runs.
- An export did not disarm a pending delete, so "Confirm" stayed live after its
  prompt was replaced. Exports and "Show more" now disarm it at once.

Each fix has a regression test confirmed to fail without it.

### Confirmed issues deferred

- The Accounts panel's "Remove" (Milestone B) had the same double-click
  weakness. Fixed later in commit 7caf140 with the same `confirm.ts` guard.
- The member index for tags and message observations (recorded for M8 during
  Milestone B). No M8 criterion needs it, and it needs a database version change
  best made with its first real caller.
- No test proves that an account-wide delete rolls back when one store fails.
  The code uses one transaction; a failure-injection test needs a storage fake
  that can fail one store.

### Possible risks

- Template writes do not set the triage revision, so a second open options tab
  shows a stale template list and counts until its next redraw. Writes stay
  safe: a stale edit or delete is refused.
- A JoyClub re-render around the composer could remove the picker or react to
  the extra node. Not verified live.
- The `change` event on the composer could trigger an unchecked page handler. It
  cannot send; the live trial checks this.
- The picker does not check which JoyClub login the page belongs to. Triage does
  not either (known limitation).

## Live acceptance (2026-09-23)

The project owner ran `manual-acceptance.md` items 27 to 35 on the build from
`main` at 9583284, and all passed. In item 33, JoyClub registered an inserted
template before any key was typed, and its deletion by keyboard, so
`manual-verification-needed.md` item 6 is settled for the standard composer. The
owner then chose to make the picker default-on. One finding: the trial flag was
first set from a JoyClub tab's console, which has no `browser`. The steps now
name the options page console.

## Blocked or remaining

- The event ClubMail composer has no evidence, so M10's "every compose context"
  criterion stays open.

## Validation

`npm test` (346 tests), `npm run lint` (including the permission allowlist),
`npm run typecheck`, `npm run format:check` and `npm run build:firefox` pass. No
permission was added.

## Phase status

M8 is complete and accepted live. M10 is complete and accepted live on the
standard composer; only the event ClubMail composer remains, blocked on
evidence. Milestone D is complete except for that one compose context.
