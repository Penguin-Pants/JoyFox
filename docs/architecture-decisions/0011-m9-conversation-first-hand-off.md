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
   browser can name (`RouteContext.tabId`), with the profile path it will open.
   The page navigates only after the run returns `handed-off`, so a late answer
   after a timeout never moves it. The profile address comes from the
   conversation header's own link, and only when that link names the run's
   member on the same site; without it, nothing is started, not even Delete. A
   stop reason (the flag turned off, an account switch) ends the run before the
   hand-off. If the marker cannot be stored, the run stops with `handoff-failed`
   (or `timeout`). Content scripts cannot read `storage.session`, so the marker
   is not visible to the page.
4. **Resume once, and only the same run.** The profile page reads its tab's
   marker once; reading removes it, so a reload never runs Ignore again. The
   background answers only while the account is still active, the run is still
   the member's newest, its last stored step is still `DeleteConfirmed`, it
   moved within `STALE_AFTER_MS`, and the sending page, as the browser reports
   it, is the profile path stored in the marker. The profile page resumes only
   for the run's member, and keeps what it read while the page settles. It
   starts when the profile menu is there, or after 10 seconds, when a missing
   control stops the run with a clear reason.
5. **Verification.** Delete is verified by the clicked member's row leaving the
   conversation list, on two reads in a row, while the list is on screen and
   shows rows; a header that re-renders or a list that empties for a moment
   never counts. When that list is not on screen, or shows no row for the
   member, Delete is not started (`unverifiable`), because its result could not
   be checked. Ignore is verified by "Profil nicht mehr ignorieren" in the menu,
   within one 10-second deadline. The driver opens the menu to look only if the
   item does not appear on its own, and closes it again.
6. **The live driver exists.** `liveQuickActionDriver()` returns
   `JoyClubQuickActionDriver`. The button still needs `joyfox.quickIgnoreDelete`
   set to `true`, so M9 stays off by default.
7. **Selectors.** Every selector is from the evidence
   (`src/selectors/quick-action.ts`). Delete on the conversation page is the
   item "In den Papierkorb schieben" in the conversation's three-dot menu
   (`j-context-menu.cm-conversation__context-menu`, opened by
   `button-conversation-kebap`), inside the same `header.cm-clubmail-header` as
   the conversation header (owner evidence, eighth report). The item has no
   `title` or hook, so it is matched by that exact text inside that menu. Unless
   there is exactly one such menu and exactly one such item, nothing is clicked.
   The standalone `button-delete-conversation` is on the inbox rows only and is
   never clicked. (Corrected 2026-09-24: the first live run looked for that
   button in the header row, found none, and stopped before any click.)

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
- Deferred from the review (2026-09-24): a member who is already ignored ends
  with "Ignore: not done" after a 10-second wait, although JoyClub already
  ignores them; Delete counts the member's rows, not the conversation's own row,
  so a member with two conversations in the list can mislead it; if the
  navigation to the profile is cancelled, the marker stays for up to 2 minutes
  and a visit to that member's profile in the tab would continue the run.
