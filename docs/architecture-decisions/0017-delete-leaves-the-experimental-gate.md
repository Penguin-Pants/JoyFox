# 0017: Delete leaves the experimental gate; Mark qualified and Mark as junk

## Status

Accepted (project owner, 2026-09-29). The decisions come from the owner's
answers in `docs/clubmail-actions-change-request.md` (D1 to D15) and from two
answers given during the implementation on 2026-09-29.

## Context

Until now, JoyFox clicked a JoyClub control only in Quick Ignore and Delete (M9,
ADR 0008, ADR 0011), and only while the experimental flag
`joyfox.quickIgnoreDelete` was on (off by default). Three needs came up:

1. A user who reads a conversation often wants it in JoyClub's trash without
   ignoring the member. There was no Delete-only action.
2. Moving a sender to a placement took two clicks ("Why and move", then "Move to
   ..."), and the move logged no trust outcome. A user who reads a message has
   already reviewed it, so a manual move to "Needs Review" has no use.
3. "Quarantined" did not match how users talk about unwanted mail.

## Decision

1. **Delete, always visible.** A "Delete" button shows in the JoyFox strip on
   every conversation page where JoyFox reads the member and the conversation,
   with no setting (D1, D2). One click is the confirmation (Mode A, D4); JoyClub
   asks no confirmation for this step. After a completed run, the notice shows
   for 2 seconds, then the page returns to the ClubMail list, only while it
   still shows that conversation (D5). A failed run stays, and its notice names
   the next manual step.
2. **A new ActionLog action, `quick-delete`**, with the states `Started`,
   `DeleteRequested`, `DeleteConfirmed`, `Completed` and `Failed`. It reuses the
   executor's Delete step (T2), so the identity check, the step timeout and the
   failure codes are the same as in Ignore and Delete. Only one run per member
   goes at a time, whichever action; while one runs, both buttons wait (A8).
3. **Mark qualified and Mark as junk** replace "Move to ..." and "Keep in ..."
   in every view (D11). They show in the member bar on conversation and profile
   pages and in the inbox row panel (D9), whenever a placement result exists.
   Each click runs, in order, and stops at the first step that fails or is
   refused (C7):
   - store the user's own placement (`qualified` or `quarantined`);
   - log one trust outcome, Positive (+1) or Negative (-1) (D8);
   - for "Mark as junk" on a conversation page only, run the Delete flow above
     (D7). On a profile page and in the inbox there is no conversation to trash,
     so nothing is clicked on JoyClub (D10).

   A button is disabled while the user's own choice is already that placement
   (D12). "Use my rule again" stays; it clears the placement only, and a logged
   outcome stays until the bar's "Undo" removes it (D13).

4. **"Quarantined" reads "Junk"** in English and German (D6). The stored value
   stays `quarantined` (T1): no migration, and older exports still import. "Why
   and move" reads "Details" (D14).
5. **The experimental flag controls only Ignore and Delete, and it is on by
   default** (owner answer, 2026-09-29). A stored `false` turns it off.
6. **Without the ClubMail list beside the conversation, "Delete" and "Ignore and
   Delete" are both greyed out**, with the existing hint (owner answer,
   2026-09-29). Before, "Ignore and Delete" stayed clickable and stopped before
   any click.
7. **German strings** were drafted and accepted as drafted, without an owner
   review, on the owner's instruction (this replaces D15's review step).

## Safety rules that stay

- **Identity check.** Before every click, the page must show the expected member
  and conversation; otherwise nothing is clicked.
- **Verification rule** (D3). No trash click unless the ClubMail list shows the
  member's row beside the conversation, so JoyFox can see the row leave it.
- **ActionLog first.** Each step is stored before JoyFox moves on, so a crash
  reads as "not confirmed", never as "not done", and the notice is built from
  the stored steps.
- **No undo claim.** JoyFox never undoes a trash; the notice names how to
  restore the conversation from JoyClub's trash.

## Why

Delete is the lower-risk half of M9: it acts only on the conversation the user
has open, JoyClub itself asks no question for it, and its result is visible in
the list. The M9 matrix (`manual-acceptance.md`, items 43 to 54) proved the
Delete step live on 2026-09-25. Keeping it behind the same flag as Ignore made
the common case (trash, no ignore) cost more clicks and the full setting's risk.

## Consequences

- JoyFox now clicks JoyClub's trash without any setting, after one click on
  "Delete" or "Mark as junk" on a conversation page. The README disclaimer, the
  privacy model and the options text say so.
- Ignore and Delete is on for users who never changed the setting.
- The Action log on the options page shows Delete-only runs with their own
  labels. A junk trash shows as a Delete run (T3).
- Out of scope and unchanged: the steps and order of Ignore and Delete, Ignore
  without Delete, a trash from the inbox list or the profile page, undo of a
  trash, and how the contact rule computes a placement.
