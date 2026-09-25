# Milestone E audit

Milestone E is M9, Quick Ignore and Delete, built separately so it does not
block the rest of the MVP (build plan Section 27). It depends on F5 and F7. F5
is done; F7 is not: where Ignore lives in JoyClub's UI is unverified. On the
project owner's decision (2026-09-23), this run builds the part that does not
need the live site and keeps the live path disabled (ADR 0008).

## Completed

- **State machine** (`src/actions/ignore-delete.ts`, pure): `Started`,
  `IgnoreRequested`, `IgnoreConfirmed`, `DeleteRequested`, `DeleteConfirmed`,
  `Completed`, and `Failed` from any state that is not terminal, with a reason.
  No step can be skipped.
- **Identity invariant**: the member ID always, and the conversation ID on a
  conversation page, must match before every click. Delete acts on the
  conversation, so it needs the conversation page. A value that cannot be read
  is a failure, never a match.
- **Executor** (`src/actions/executor.ts`, no DOM): per step it checks identity
  and the control without clicking, stores `…Requested` and waits for the store,
  checks identity, the stop reason and the control again, clicks, checks
  identity again before JoyClub's confirmation, clicks it, checks JoyClub's
  success, then stores `…Confirmed`. Any failure stops at once. Nothing is
  undone. Each driver call times out after 15 seconds. A driver or display error
  is contained and recorded as `step-error`.
- **ActionLog** (`src/actions/action-log-service.ts`): every transition is
  stored at once, under the account lock, and only if the state machine allows
  it. One run per member at a time; an interrupted run does not block.
- **Messages**: `action.ignoreDelete.start`, `.record` and `.latest`. Writes
  name the account and are refused once it is no longer active, so a run stops
  at its next step after an account switch. Every stored transition sets
  `joyfox.actionRevision`, so another tab on the same member follows the run.
- **Notice** (`src/content/quick-action.ts`): an "Ignore and Delete" button
  after the JoyFox sections below the conversation header. The notice names what
  was done, what was not, why it stopped (with the step) and the next manual
  action, in one live region updated in place. A failed or interrupted earlier
  run is shown from the stored ActionLog. A run belongs to its conversation; on
  another conversation its progress and result show with a label.
- **Off twice**: the button needs `joyfox.quickIgnoreDelete` set to `true` and a
  live driver. `liveQuickActionDriver()` returns `undefined` until F7, so the
  button never appears today. Turning the flag off stops a run before its next
  click (`turned-off`) and hides the button.
- **Section 24 matrix**: every case runs as a synthetic test with a scripted
  driver (`tests/integration/quick-action.test.ts`, cases 1 to 12), and as a
  manual checklist for the live run (`manual-acceptance.md`, items 43 to 54).

## Review findings

A self-review before the independent review found and fixed one issue: a busy
button was `disabled`, so keyboard focus fell to the page during every run. It
now uses `aria-disabled` and ignores the click, and focus stays on it.

An independent review of the diff found eight issues. All were confirmed with
probes and are fixed, each with a regression test confirmed to fail without the
fix:

- **Blocking.** Identity, the stop reason and the control were checked before
  `…Requested` was stored, but not again before the click. Storing is a round
  trip, so a route to another member, or an account switch, during it still led
  to a click. They are now checked again right before the click. If that stops
  the run, the log says the step was started, never less.
- A driver or display callback that threw escaped the run and left the log open,
  with no notice. Such errors are now contained and recorded as `step-error`,
  and the button component has its own fallback notice.
- When storing `…Confirmed` failed, the notice said JoyFox "did not attempt" a
  step it had started. The log-failure text now says where the run stopped
  ("before" or "during" the step), from the step's outcome.
- The running state was not tied to its conversation. After an in-page route,
  the new conversation showed the old run's progress, and its result was
  dropped. Progress and results now belong to their conversation and show with a
  label elsewhere.
- Turning the flag off neither stopped a run nor kept the button away after the
  run ended. It now stops the run before its next click and hides the button.
- Another tab's run never refreshed: its "running" state stayed until
  navigation. Every stored transition now sets `joyfox.actionRevision`, and a
  stale timer re-reads the log when another tab's run would count as
  interrupted. A click answered `busy` now says nothing was done here.
- Each progress change recreated the whole section, including its live region,
  so screen readers could miss the updates. The section and live region now stay
  and change in place.
- On a profile page the identity check passed without a conversation ID, also
  before Delete, which acts on a conversation. Delete now needs the conversation
  page.

A Codex review of PR #19 found three more, all confirmed and fixed, each with a
regression test confirmed to fail without the fix:

- A run that read as interrupted (its tab was suspended) could be replaced by a
  new run, yet its tab could resume and go on clicking. Only the member's newest
  run may now record a step; an older one is refused (`superseded`) and stops
  before its next click.
- `.latest` dropped the stored conversation ID, so an earlier run on another
  conversation with the same member read as this conversation's run. It now
  returns the conversation, and such a run is labelled "in another
  conversation".
- Every redraw restarted the stale timer, so a page that changes often could
  keep the button busy after the other tab closed. The timer is now set once per
  answer, from when the run last moved.

### Confirmed issues deferred

- A `start` that times out but is stored later leaves a `Started` entry that
  reads as running for 2 minutes, so a retry meanwhile answers `busy`. Nothing
  is clicked either way.

## Blocked or remaining

- **F7.** The live driver: the Ignore control, JoyClub's confirmations, the
  success signals and the identity signals after each step
  (`manual-verification-needed.md`, item 7).
- **Path B.** If Ignore needs the profile, the `storage.session` marker and
  resume after navigation (build plan Section 16).
- **Guided mode.** The PRD's settings toggle to navigate and stage while the
  user clicks.
- **Live acceptance.** The manual matrix, items 43 to 54, by hand only.

## Validation

`npm test` (443 tests after the Codex fixes), `npm run lint` (including the
permission allowlist), `npm run typecheck`, `npm run format:check` and
`npm run build:firefox` pass. No permission was added and the schema version is
unchanged.

## Phase status

M9 is not complete. Its F7-free core is complete and tested; the live path is
blocked on F7, and M9's acceptance needs the live matrix. The rest of the MVP
does not depend on it (build plan Section 27).

## Review follow-ups (2026-09-25)

The owner chose the M9 review follow-ups from ADR 0011 as the next phase.

- **Done: sender page on hand-off.** The background refuses
  `action.ignoreDelete.handOff` unless the browser reports the sender as the
  run's own conversation page.
- **Done: cancelled navigation.** The conversation page withdraws the hand-off
  (`action.ignoreDelete.withdraw`) when it is still there 15 seconds after it
  navigated; `pagehide` cancels the wait. The run is closed as
  `Failed:handoff-failed` and the notice says Delete was done and Ignore was
  not.
- **Blocked: own-row match.** No evidence shows a conversation link or ID on an
  inbox row (`01-inbox.md`).
- **Deferred:** the gaps listed in ADR 0011, "Limits of the withdrawal".

Validation: `npm test` (650 tests), `npm run lint`, `npm run typecheck`,
`npm run format:check` and `npm run build:firefox` pass. No permission, schema
version or UI string was added; the notice reuses the approved `handoff-failed`
text. Live check: `manual-acceptance.md`, items 98 and 99, pending.

## Stale hand-off on page load (2026-09-25)

- **Done.** With the flag on, each JoyClub page load in a tab asks the
  background to drop a hand-off marker meant for another page
  (`action.ignoreDelete.dropStale`). The run is closed as
  `Failed:handoff-failed`. The marker's own profile keeps it. See ADR 0011.
- **Still open:** a cancel followed by the same member's profile within the
  15-second wait continues the run.

Validation: `npm test` (668 tests), `npm run lint`, `npm run typecheck`,
`npm run format:check` and `npm run build:firefox` pass. Live check:
`manual-acceptance.md`, item 100, pending.
