# Milestone C audit

Milestone C is M2, M4 and M6 (build plan Section 27): incoming messages are
explained and sorted locally into Qualified, Needs Review and Quarantined. The
open design decisions are recorded in
`architecture-decisions/0006-triage-presentation-and-trust.md`.

## Completed

### M4 global contact rule

- `src/rules/contact-rule.ts` holds the rule in the V1-compatible schema: schema
  version, audience (`all` in the MVP; `man`, `woman`, `couple` stored for V1),
  enabled flag, the placement for a sender who does not meet the rule, and a
  condition tree of All/Any groups.
- Conditions: verified, personally known, minimum photos, minimum profile words
  (completeness), minimum account age in days, not template spam and minimum
  local trust score. Each condition states what an unknown fact counts as: Needs
  Review (default), met or not met.
- `evaluateContactRule` is pure. It returns `placement`, `reasons` and
  `evaluatedConditions`, as build plan Section 11 requires. An unknown fact
  never fails a condition unless the user chose "count as not met".
- `RuleService` stores one global rule per account and validates it before any
  write. The options page has a rule builder with PRD Section 11.5's two boxes
  (ALL of these, or ANY of these) in plain language.

### M2 inbox triage and quarantine

- A tab bar above the inbox list, with counts. The default view hides
  Quarantined rows only. Every row gets a badge that names its placement in
  words; its "Why" panel lists the reasons and every checked condition.
- One click moves a sender to any group, and "Use my rule again" clears it. The
  change shows at once, in this tab and in other open tabs.
- Rows that load later are triaged on the next page mutation. JoyFox writes to
  the page only when a value changes, so its own mutations settle.
- With no account, no rule, a disabled rule or no answer from the background,
  JoyFox changes nothing on the page. `teardown` restores the list exactly.
- The inbox shows only the shield, so photos, profile words and account age come
  from cached profile snapshots. A profile page now stores one snapshot when its
  facts change (counts, codes and dates only).

### M6 basic local trust score

- `computeTrustScore` is pure and lists every point (ADR 0006). It states that
  it is not a JoyClub or community rating.
- The conversation and profile pages show a JoyFox panel after JoyClub's header
  with the placement, the trust score and buttons to log a positive, neutral or
  negative outcome, or undo the last one. The score updates at once after a log
  (M6 acceptance).

### Messaging

- New typed messages: `triage.evaluate`, `triage.setOverride`, `trust.get`,
  `trust.log`, `trust.undo`, `snapshot.capture` and `options.open`. The
  background checks every payload field and resolves the active account on each
  request.

## Review findings

### Confirmed issues fixed now

- Every inbox update rewrote each badge's `data-member` attribute, so the page
  never settled. The write is now skipped when the value is unchanged.
- Vitest blanked the content stylesheet in tests, so the view-hiding rules were
  not tested. The config now processes it, and a test checks which rows each
  view hides.
- Saving a rule stored extra fields inside condition nodes. The service now
  copies only the fields each node defines.
- Leaving and reopening the inbox kept the previous "Why" selection. Teardown
  now clears it.

Codex review of PR #14 found seven more, all confirmed and fixed:

- An account switch left the previous account's inbox placements and panel on
  screen, with live buttons, until the new answer arrived. The UI is now removed
  at once on a switch.
- A profile captured for one account was not captured again after a switch, so
  the new account never got the snapshot. A switch now resets the capture
  marker.
- An older options render could finish after a newer one and draw the wrong
  account's form, with save handlers for that account. Renders now carry a
  generation, and a save checks the form's account is still active.
- "Undo last outcome" showed when the score came only from "personally known",
  with nothing to undo. It now shows only when an outcome is logged.
- Two outcomes logged in the same millisecond sorted by random ID, so undo could
  remove the older one. IDs now carry a logging sequence.
- An empty inbox never asked whether triage was on, so the tab bar never showed.
  It now asks once with an empty list.
- Reasons listed every condition whose outcome matched the result, including
  conditions in a group that did not decide it. Reasons now follow the cause
  through the All/Any tree; the full list still shows every condition.

A second Codex review found two more, both confirmed and fixed:

- Profile captures ran in parallel, so a slow, partial capture could finish last
  and become the newest snapshot. Captures from one page now run one after
  another.
- "Remove rule" deleted the rule of the account the form was drawn for, even
  after another account became active. It now checks the account first, like
  saving does.

A third Codex review found four more, all confirmed and fixed:

- A client-side route to another member could keep the old member's panel, with
  live buttons, until the new answer arrived. The panel now goes at once when
  the member changes.
- Two snapshots captured in the same millisecond sorted by random ID. Snapshot
  IDs now carry a capture sequence.
- A quick "Log" then "Undo" could reach storage in the other order. Panel and
  inbox writes now run in click order.
- If the change marker in `storage.local` failed after a committed write, the
  write was reported as failed, and a retry stored it twice. The marker is now
  best effort.

A fourth Codex review found four more, all confirmed and fixed:

- A write sent or queued just before an account switch landed in the newly
  active account. Every answer now names its account, every write sends it back,
  and the background drops a write whose account is no longer active. Profile
  captures wait until an answer names the account.
- JoyClub can keep the inbox list on other routes, so a late answer or a change
  in another tab could re-apply triage there. The inbox feature is now inactive
  until the page is the inbox again.
- A log and an undo from two tabs could interleave in the one background
  service. Trust writes are now serialized in the background.
- A quick "Save rule" then "Remove rule" could end with the rule saved. The
  options panel now runs them in click order.

A fifth Codex review found four more, all confirmed and fixed with one mechanism
plus an observer change:

- A write accepted just before an account removal could land after the sweep and
  recreate data for a removed account. Writes from different tabs (rule save and
  remove, profile captures) could also interleave. Every write and the account
  removal now hold one lock per account, shared by the background and all
  options tabs (Web Locks API), and a write re-checks inside the lock that its
  account is still active.
- The navigation observer saw only added and removed nodes, so an in-place
  change to a profile link, shield code, gender code or photo label was not
  noticed. It now also watches those attributes and text changes, never JoyFox's
  own `data-joyfox-*` attributes.

A sixth Codex review found one more, confirmed and fixed:

- A capture made before the page rendered every field stored the missing fields
  as unknown, and inbox triage then lost facts an earlier capture knew (listed
  earlier as a possible risk). A field not seen now keeps its newest known value
  until a later observation replaces it.

Each fix has a regression test confirmed to fail without it.

### Confirmed issues deferred

- A failed background answer turns the inbox off until the next rule, account,
  placement or trust change, or a page reload. Retrying on its own would need a
  retry policy no document sets.
- Presets (PRD Section 11.3) are not built. "Complete profiles only" and
  "High-trust members" need thresholds no document defines.
- Per-audience rules and nested groups in the builder are V1 scope. The schema
  already holds them, and the builder refuses to edit a rule it cannot show.

### Possible risks

- The badge is inserted after the sender-name element inside a JoyClub row. If
  JoyClub re-creates that element, the badge is added again on the next
  mutation; if JoyClub handles clicks on `mousedown` or in the capture phase, a
  badge click may also open the conversation. Both need a live check.
- Hiding rows with `display: none` inside a framework-managed list is assumed to
  leave JoyClub's scrolling and loading intact. Not yet checked live.

## Blocked or remaining

- Spam status is always unknown on pages, because no page reads message text yet
  (M3 blocker). Only the user's own "not spam" correction counts.
- The automatic existing-conversation exception (PRD Section 7.4) waits on the
  read-status meaning.
- Live acceptance of the triage UI on JoyClub (see `manual-acceptance.md`, items
  19 to 26).
- M1's 95 percent acceptance over 50 messages needs a manual trial.

## Phase status

Milestone C is implemented and tested against synthetic fixtures. Live
acceptance on JoyClub remains.
