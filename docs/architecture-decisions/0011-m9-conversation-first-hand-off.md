# 0011: M9 live path, conversation first, with a hand-off to the profile

## Status

Accepted (project owner, 2026-09-24: "Conversation first").

## Context

ADR 0008 built M9's core without a live driver, because F7 had not shown where
Ignore lives. The owner's evidence (`live-evidence/10-ignore.md`) now answers
it:

- Ignore is only on the sender's profile page: the menu `profile-context-menu`,
  its item "Profil ignorieren", then "Ignorieren" in a `j-modal` dialog.
  Afterwards the item reads "Profil nicht mehr ignorieren", which is a lasting
  success signal. The page address does not change.
- Delete ("Unterhaltung in den Papierkorb schieben") is on the conversation page
  and on each inbox row. It asks for no confirmation. The conversation's row
  leaves the list at once, a 5-second notice with "Rückgängig" (Undo) appears,
  and the address does not change. On the conversation page the conversation
  stays open at first.

So the two steps are on two pages (Path B), and ADR 0008's order (Ignore, then
Delete, both on the conversation page) cannot work. The owner chose among three
flows: conversation first, profile first, or two separate buttons.

## Decision

1. **Order: Delete, then Ignore.** The run starts on the conversation page where
   the user reads the message. `STEP_ORDER` is `["delete", "ignore"]`, and the
   state machine is `Started`, `DeleteRequested`, `DeleteConfirmed`,
   `IgnoreRequested`, `IgnoreConfirmed`, `Completed`. M9 never ran live, so no
   stored log uses the old order.
2. **Each step on its own page.** The identity check requires the conversation
   page for Delete and the profile page for Ignore. Everything else in ADR 0008
   stays: `…Requested` stored before each click, identity read again right
   before each click, stop at the first problem, report from the stored steps.
3. **Hand-off through the background, bound to the tab.** After
   `DeleteConfirmed` is stored, the conversation page asks the background to
   store a marker in `storage.session` under its own tab ID, which only the
   browser can name (`RouteContext.tabId`). Only then does it navigate to the
   profile address from the conversation header's own link, and only when that
   link names the run's member on the same site. If the marker cannot be stored,
   the run stops with `log-unavailable`. Content scripts cannot read
   `storage.session`, so the marker is not visible to the page.
4. **Resume once, and only the same run.** The profile page reads its tab's
   marker once; reading removes it, so a reload never runs Ignore again. The
   background answers only while the account is still active, the run is still
   the member's newest, its last stored step is still `DeleteConfirmed`, and it
   moved within `STALE_AFTER_MS`. The profile page resumes only for the run's
   member. It starts when the profile menu is there, or after 10 seconds, when a
   missing control stops the run with a clear reason.
5. **Verification.** Delete is verified by the member's row leaving the
   conversation list. When that list is not on screen, or shows no row for the
   member, Delete is not started (`unverifiable`), because its result could not
   be checked. Ignore is verified by "Profil nicht mehr ignorieren" in the menu.
   The driver opens the menu to look only if the item does not appear on its
   own, and closes it again.
6. **The live driver exists.** `liveQuickActionDriver()` returns
   `JoyClubQuickActionDriver`. The button still needs `joyfox.quickIgnoreDelete`
   set to `true`, so M9 stays off by default.
7. **Selectors.** Every selector is from the evidence
   (`src/selectors/quick-action.ts`). The conversation's own Delete control is
   the one outside every inbox row and inside the header's row; if there is not
   exactly one, nothing is clicked.

## Consequences

- The manual matrix (`manual-acceptance.md`, items 43 to 54) is rewritten for
  the new order and can now be run, by hand only, on test conversations.
- JoyClub's own "Rückgängig" (Undo) notice for Delete appears on the
  conversation page for 5 seconds and is gone when JoyFox navigates away. The
  conversation can still be restored from JoyClub's trash. JoyFox does not offer
  Undo.
- A conversation whose row is not loaded in the list (an older one, further
  down) cannot be deleted by JoyFox; the notice says the result could not be
  checked.
- The 10-second resume wait, the 15-second step timeout and the 2-minute stale
  threshold are provisional and to be tuned against the live site.
- The PRD's guided mode (navigate and stage, the user clicks) is still not
  built.
