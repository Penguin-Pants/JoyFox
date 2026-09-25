# 0008: Quick Ignore and Delete core before F7

## Status

Accepted (project owner, 2026-09-23: "Build the F7-free core").

## Context

M9 depends on F5 and F7 (build plan Section 7). F7 is not done: nobody has
opened the conversation "Optionen" menu, so it is unknown whether Ignore is on
the conversation page (Path A) or needs the sender's profile (Path B), which
confirmations JoyClub shows, and how success is visible
(`manual-verification-needed.md`, item 7). The Delete control is observed
(`j-control-button[data-e2e="button-delete-conversation"]`, "Unterhaltung in den
Papierkorb schieben") but its confirmation and success signal are not.

The build plan fixes the state machine, the ActionLog rule, the identity
invariant and the partial-failure behavior (Section 16), and the manual test
matrix (Section 24). codex.md says to finish what does not need the live site
and to keep the live path disabled. The owner chose that option.

Several details were open:

1. Who runs the steps. Technical Design sketches a port from the content script
   to the background, with progress streamed back.
2. When a step is recorded: before or after its click.
3. How a stopped or crashed run is told apart from a running one.
4. What the identity check compares on each page.
5. What happens when another run for the same member is still going.

## Decision

1. **The content script runs the steps; the background stores them.** Only the
   page can click, and each transition must be stored before the next click. A
   request per transition (`action.ignoreDelete.start`, `.record`) gives that
   acknowledgement directly, so no port is needed. The background keeps no state
   between messages, so a background restart mid-run changes nothing (Section
   24, case 11). The names keep Technical Design's `action.ignoreDelete` prefix.
2. **`…Requested` is recorded before the click; `…Confirmed` after JoyClub shows
   success.** A crash between them leaves "not confirmed", never "not done". If
   `…Requested` cannot be stored, nothing is clicked. Identity, the stop reason
   and the control are checked again once it is stored, right before the click.
   A step JoyClub confirmed but the log could not store still shows as done on
   screen.
3. **A run that has not moved for 2 minutes reads as interrupted.** Each driver
   call waits at most 15 seconds, so a live run always moves sooner. Both values
   are provisional; no document sets them. (Amended 2026-09-25: a run still at
   `Started` reads as interrupted after 30 seconds, twice the step timeout, and
   a start is not stored after the tab's deadline. See `milestone-e-audit.md`,
   "Late start".)
4. **Member ID always; conversation ID on a conversation page.** Delete acts on
   the conversation, so it needs the conversation page. The check runs before
   the step's control is clicked and again before JoyClub's confirmation is
   clicked. A missing value is a failure, never a match.
5. **One run per member at a time.** A second start while one is running is
   answered `busy` and nothing is clicked. An interrupted run does not block,
   and once a newer run starts, the older one may record no further step, so a
   suspended tab that resumes stops before its next click.
6. **The report comes from the steps alone.** It states what was done, what was
   not, why it stopped (naming the step) and the next manual action. It never
   claims a rollback, and says "Nothing was changed on JoyClub" only when no
   step was requested.
7. **Off twice.** The button needs `joyfox.quickIgnoreDelete` set to `true` and
   a live driver. `liveQuickActionDriver()` returns `undefined` until F7
   evidence exists, so the button never appears today. Turning the flag off
   stops a run before its next click.

## Consequences

- F7 now has a precise target: a driver implementing `QuickActionDriver`
  (`src/actions/executor.ts`) from verified selectors, with fixture tests.
- Path B needs more: a pending-action marker in `storage.session` and resume
  after navigation (build plan Section 16). It is not built, because F7 may show
  Path A. `storage.session` needs no new permission.
- The PRD's settings toggle for a guided mode (navigate and stage, the user
  clicks) needs the same evidence and is not built.
- `ActionLog` gains an optional `conversationId`. No database version change is
  needed.
- M9 is not complete. Its acceptance needs the live driver and a manual run of
  the Section 24 matrix (`manual-acceptance.md`, items 43 to 54).
