# Change request: ClubMail Delete, Mark qualified and Mark as junk

Status: ready for implementation (2026-09-29). All decisions below come from the
owner's answers on 2026-09-29, except the items under "Technical defaults".

## Summary

1. Add a standalone **Delete** button on the conversation page. It is always
   visible. "Ignore and Delete" stays behind its experimental setting.
2. Replace the two-click move flow ("Why and move", then "Move to ...") with two
   one-click buttons: **Mark qualified** and **Mark as junk**.
3. Rename the "Quarantined" placement to **Junk** in the UI.

## User stories

- **US1. Delete only.** As a JoyFox user who reads a ClubMail conversation, I
  want a "Delete" button beside "Ignore and Delete", so that I can move the
  conversation to JoyClub's trash without ignoring the member.
- **US2. Mark qualified.** As a user who already reads the message, I want one
  "Mark qualified" button, so that the sender moves to Qualified and gets a
  positive trust outcome in one click.
- **US3. Mark as junk.** As a user who already reads the message, I want one
  "Mark as junk" button, so that the sender moves to Junk, gets a negative trust
  outcome and the conversation goes to JoyClub's trash in one click.

Reason for US2 and US3: a user who reads a message has already reviewed it. So a
manual move to "Needs Review" has no use. Only Qualified and Junk remain as
manual choices.

## Owner decisions

| ID  | Topic                              | Decision                                                                                          |
| --- | ---------------------------------- | ------------------------------------------------------------------------------------------------- |
| D1  | Delete visibility                  | Always visible on the conversation page. No setting.                                              |
| D2  | Experimental flag                  | Delete and the junk trash step do not need the flag. The flag controls only "Ignore and Delete".  |
| D3  | Delete verification                | Keep the rule: no trash click unless the ClubMail list is beside the conversation.                |
| D4  | Confirmation                       | One click. The click is the confirmation (Mode A), as for "Ignore and Delete" today.              |
| D5  | After a completed trash            | Show the result notice for 2 seconds, then return to the ClubMail list.                           |
| D6  | "Quarantined"                      | Rename to "Junk" in every visible text (English and German).                                      |
| D7  | Junk on JoyClub                    | Trash the conversation only. No Ignore.                                                           |
| D8  | Mark qualified and trust           | Log one Positive trust outcome (+1).                                                              |
| D9  | Where the Mark buttons go          | Conversation page bar, profile page bar, inbox row panel.                                         |
| D10 | Junk outside the conversation page | Profile page and inbox panel: place in Junk and log Negative. No trash (no conversation is open). |
| D11 | Old move controls                  | Remove "Move to ..." and "Keep in ..." everywhere. Keep "Use my rule again".                      |
| D12 | Button already matches             | Disable the button when the user's own choice is already that placement.                          |
| D13 | "Use my rule again" and trust      | Keep the logged trust outcome. The user can remove it with the bar's "Undo".                      |
| D14 | "Why and move" label               | Rename to "Details" (toggle and inbox badge).                                                     |
| D15 | German text                        | Claude Code drafts all German strings. The owner reviews them before release.                     |

## Current behavior (verified in the code)

- **Ignore and Delete** (`src/content/quick-action.ts`, class
  `QuickIgnoreDelete`): one button in the JoyFox strip on the conversation page.
  It shows only when `joyfox.quickIgnoreDelete` is `true`
  (`src/actions/quick-action-setting.ts`). A run is Delete, then Ignore on the
  profile (ADR 0011). Every step goes to the ActionLog first
  (`src/actions/ignore-delete.ts`, `src/actions/executor.ts`). Without the
  ClubMail list beside the conversation, the button is disabled with the hint
  `quick.needsList` (`canVerifyDelete`).
- **No Delete-only action exists.** The state machine has only
  `quick-ignore-delete` (`QUICK_IGNORE_DELETE`).
- **Manual move** (`src/content/triage-ui.ts`, `explanation()`): the drawer
  behind "Why and move" holds three buttons: "Move to / Keep in" Qualified,
  Needs Review and Quarantined, plus "Use my rule again" for an override. The
  same `explanation()` is in the conversation and profile drawer (`memberBar()`,
  via `src/content/member-panel.ts`) and in the inbox row panel
  (`src/content/inbox-triage.ts`). A move calls `triage.setOverride`.
- **Trust score** (`src/trust/trust-service.ts`, `src/trust/trust-score.ts`):
  local. Positive = +1, Negative = -1, Neutral = 0. The bar has "Log: Positive /
  Neutral / Negative" and "Undo".
- **Placements** (`src/domain/types.ts`): stored values `qualified`,
  `needs-review`, `quarantined`. Labels in `src/i18n/catalog/en.ts` and `de.ts`
  (`placement.*`).

## Requirements

### A. Delete button (US1)

- **A1.** Show a "Delete" button in the JoyFox strip on every conversation page
  where JoyFox reads the member and the conversation. It does not depend on
  `joyfox.quickIgnoreDelete`.
- **A2.** With the flag on, show "Delete" and "Ignore and Delete" side by side.
  With the flag off, show "Delete" only.
- **A3.** One click starts the run. JoyClub shows no confirmation for Delete
  (`awaitConfirmation("delete")` returns `"none"` in
  `src/content/quick-action-driver.ts`). Do not wait for a dialog and do not add
  a selector for one. JoyFox verifies the result as today: the member's row
  leaves the ClubMail list.
- **A4.** Add a new ActionLog action (for example `quick-delete`) with the
  states `Started`, `DeleteRequested`, `DeleteConfirmed`, `Completed`, `Failed`.
  Record each state before JoyFox moves on. Use the same identity check (member
  and conversation must match), the same step timeout and the same failure codes
  as the Delete step of "Ignore and Delete".
- **A5.** Keep the verification rule (D3). Without the ClubMail list beside the
  conversation, the button is disabled and the existing hint shows.
- **A6.** After `Completed`: show the notice for `RETURN_WAIT_MS` (2 seconds),
  then go to `/clubmail/` (D5). After `Failed`: stay on the page. The notice
  says what was done, what was not and the next manual step.
- **A7.** Delete does not change the placement or the trust score.
- **A8.** Only one trash run at a time. While Delete, "Ignore and Delete" or a
  junk trash runs, the other trash buttons are disabled. Do not reuse
  `quick.busy` and `quick.otherRunning` as they are: they name "Ignore and
  Delete" and say "Nothing was done here". Make them action-neutral, or add one
  text per action. For a junk trash that is refused as busy, the notice must
  also say that the placement and the Negative log were done (C7).
- **A9.** The "last run" notice and the options page "Action log"
  (`src/options/data-panel.ts`, which today filters on `QUICK_IGNORE_DELETE`)
  also show Delete-only runs, with their own labels.
- **A10.** Update the Delete step's text so it does not say "Ignore and Delete"
  in a Delete-only run (for example `quick.progress.Started`).

### B. Rename "Quarantined" to "Junk" (D6)

- **B1.** Change every visible "Quarantined" / "Quarantäne" text to "Junk" and
  its German draft. This includes `placement.quarantined`, `inbox.aboutText`,
  the contact rule help text (`de.ts` line with „Quarantäne“) and the inbox view
  names.
- **B2.** Search both catalogs and `src/options/` for every other use and update
  it. Keep the English and German catalogs in sync (the i18n tests check this).
- **B3.** Update `docs/i18n-strings.md` and other user-facing docs that name the
  placement.

### C. Mark qualified and Mark as junk (US2, US3)

- **C1.** Conversation page and profile page: show "Mark qualified" and "Mark as
  junk" in the member bar (`memberBar()`), visible without opening the drawer
  (D9).
- **C2.** Inbox row panel: show the same two buttons where the move group is
  today.
- **C3.** Show the buttons only when a placement result exists (same condition
  as the move group today). With no rule or the rule off, show no buttons.
- **C4. Mark qualified** does, in this order:
  1. Set the override to `qualified` (`triage.setOverride`).
  2. Log one Positive trust outcome.
- **C5. Mark as junk** on the conversation page does, in this order:
  1. Set the override to `quarantined` (stored value, see T1).
  2. Log one Negative trust outcome.
  3. Run the Delete flow from section A (same ActionLog action, same checks).
  4. After `Completed`, return to the ClubMail list (D5).
- **C6. Mark as junk** on the profile page and in the inbox panel does steps 1
  and 2 only (D10). No trash click.
- **C7.** Stop at the first failed step. Do not run the next step. The notice
  says what was done and what was not. Examples:
  - Override save fails: show `common.saveFailed`. No trust log, no trash.
  - A refused write counts as failed. `triage.setOverride` and `trust.log`
    answer `{ done: false }` when the active account changed, and
    `messageTriageClient` (`src/content/triage-client.ts`) drops that answer
    today. The Mark flow must read `done` (or the client must reject on
    `done: false`) before it runs the next step.
  - Trash cannot run (ClubMail list not beside the conversation) or fails:
    placement and Negative log stay. The notice says the conversation was not
    moved to the trash and names the manual step (JoyClub's trash button).
- **C8.** Disable a Mark button when the result's source is `override` and its
  placement already equals the button's placement (D12). When the rule or the
  shared-event exception placed the sender there, the button stays enabled.
- **C9.** Set a busy flag synchronously when a Mark click starts, before the
  override request. Keep both Mark buttons `aria-disabled` until the whole
  sequence (override, trust log, trash) ends. Also disable them while a trust
  log or undo from the bar runs (`trustBusy`). A double click must never give
  two trust outcomes or two trash runs.
- **C10.** Remove the "Move to ..." and "Keep in ..." buttons from
  `explanation()` in all views. "Needs Review" stays as a rule result. Only the
  manual move to it goes away.
- **C11.** Keep "Use my rule again" when the source is `override`. It clears the
  override only. It does not remove the logged trust outcome (D13).
- **C12.** Keep the reasons, conditions and score details in the drawer.
- **C13.** Rename the toggle "Why and move" to "Details" (D14). Update
  `bar.whyAndMove`, `inbox.why`, `inbox.whyNamed`, `inbox.badge` and the German
  drafts. Remove or rename the `triage.move.*` strings that have no use.
- **C14.** Keep focus behavior: after a click, focus stays on or returns to a
  predictable control (see the `FOCUS` keys in `triage-ui.ts`). Replace the
  `move:*` focus keys with keys for the new buttons.

### D. Experimental flag and documents (D2)

- **D-1.** `joyfox.quickIgnoreDelete` now controls only "Ignore and Delete".
  Update the comment in `src/actions/quick-action-setting.ts` and the options
  text (`en.ts` line that starts "Experimental and off by default. One click
  moves the conversation to JoyClub's trash ...").
- **D-2.** Write ADR 0017: Delete leaves the experimental gate, why, and the
  safety rules that stay (identity check, verification rule, ActionLog).
- **D-3.** Update `README.md`, `docs/PRD.md`, `docs/Engineering-Build-Plan.md`
  (Section 27), `docs/privacy-model.md`, `docs/permissions.md` and
  `docs/known-limitations.md` where they say JoyFox clicks JoyClub controls only
  with the experimental flag. In `README.md` this includes the M9 paragraph ("It
  stays off until you tick ...") and the Disclaimer line "Quick Ignore and
  Delete ... carries the highest risk; it is off by default". Delete and Mark as
  junk now click JoyClub's trash with the flag off, and the Disclaimer must say
  so.
- **D-3a.** Update `docs/data-model.md` (section "ActionLog") for the new
  `action` value and its state sequence (A4).
- **D-4.** Add manual acceptance items to `docs/manual-acceptance.md` for US1,
  US2 and US3 and for the rename.
- **D-5.** Add a release note entry under `docs/release-notes/`.

## Technical defaults (not owner decisions, confirm at review)

- **T1.** Change only the visible label of `quarantined`. Keep the stored value
  `quarantined`. Reason: no schema migration, and old exports still import.
- **T2.** Reuse the Delete step of `runQuickIgnoreDelete` for the new action, or
  split the executor so both actions share it. Do not copy the step logic.
- **T3.** The junk trash (C5 step 3) uses the same ActionLog action as the
  Delete button. The Action log shows it as a Delete run.

## Out of scope

- No change to the "Ignore and Delete" steps or order.
- No Ignore without Delete.
- No trash from the inbox list or the profile page.
- No undo of a trash. JoyClub's trash is outside JoyFox.
- No change to how the contact rule computes a placement.

## Tests

- **Unit:** new state machine transitions and report lines for the Delete-only
  action; executor stops at the first failure; Mark buttons call override, then
  trust, then trash, in that order.
- **Integration:** update `tests/integration/quick-action.test.ts`,
  `triage-ui.test.ts`, `options-quick-action.test.ts`,
  `options-data-panels.test.ts` and `i18n-live-switch.test.ts`. Cover:
  - Delete shows with the flag off; both buttons with the flag on.
  - Delete disabled without the ClubMail list beside the conversation.
  - Completed Delete returns to `/clubmail/` after 2 seconds; failed Delete
    stays.
  - Mark qualified logs +1; Mark as junk logs -1 and trashes on the conversation
    page only.
  - Junk with a trash failure keeps the placement and the Negative log.
  - Mark button disabled when the override already matches.
  - No "Move to" or "Keep in" button in any view; "Use my rule again" stays.
  - Labels: "Junk", "Details" in English and German.
- **Checks before push:** `npm test`, `npm run lint`, `npm run typecheck`,
  `npm run format:check`, `npm run build:firefox`, `npm run build:chrome`.

## Acceptance criteria

1. With the experimental flag off, a conversation page shows "Delete", and one
   click moves the conversation to JoyClub's trash and returns to the ClubMail
   list.
2. With the flag on, the page shows "Delete" and "Ignore and Delete".
3. "Mark qualified" in the conversation bar moves the sender to Qualified and
   raises the local trust score by 1 in one click.
4. "Mark as junk" in the conversation bar moves the sender to Junk, lowers the
   trust score by 1, trashes the conversation and returns to the ClubMail list.
5. No view offers a manual move to Needs Review.
6. No visible text says "Quarantined" or "Quarantäne".
7. All checks in "Tests" pass.

## Prompt for Claude Code

> Implement `docs/clubmail-actions-change-request.md` on branch
> `claude/club-malfunction-buttons-h9286x`. Follow every requirement and owner
> decision. Do not change anything listed under "Out of scope". If a requirement
> conflicts with the code, stop and ask. Do not guess. Draft the German strings
> and list them in the PR for owner review. Run all checks under "Tests" before
> you push, then open a PR.
