# Manual verification needed

## Status (2026-09-23)

Item 3 is done, and items 1, 2, 6, 8 and 9 are partly done. The evidence is in
`docs/live-evidence/`, and the inbox, conversation and profile selectors are
verified from it. Still open:

- **Item 1:** whether scrolling the inbox loads more conversations, and how.
- **Item 2:** whether a message has a stable identifier.
- **Item 6:** done for the standard composer on 2026-09-23. With JoyFox's
  `input` and `change` events, JoyClub registered an inserted template and its
  deletion by keyboard (`manual-acceptance.md`, item 33). The event ClubMail
  composer is still not inspected.
- **Item 8:** gender codes are confirmed (`1` man, `2` woman, `3` couple), and
  account age comes from the profile's "Angemeldet seit" badge. Still Unclear:
  photo count on the inbox row, and account age on the inbox and conversation.
  Whether other couple compositions use other codes is not known.
- **Verification codes:** `1` (grey, "geprüft", verified by JoyClub) and `3`
  (green, "persönlich bekannt", you met them) are confirmed. Green replaces grey
  for a member who is both, and a member can be personally known without being
  verified. Still open: whether code `2` exists and what it means, and what an
  unverified member shows (no shield, or a code).
- **Read-status icon (from the F2 check):** a read state was extracted from 9 of
  25 rows. Check how many rows show the icon at all, which modifier classes
  appear (for example `--received`, `--read`), and whether the rows with the
  icon are those where you sent the last message. If so, "First message
  contains" can count a preview you wrote as met, as the owner chose (ADR 0013).
  The owner reported on 2026-09-25 that an unread row is brighter and has a red
  dot on its right; a read row is lighter and has no dot. No unread count was
  reported.
- **Message preview length:** whether JoyClub cuts the inbox preview text
  (`.cm-conversation-list-item__text`) after a number of characters, or only
  hides the overflow with CSS. A cut preview can hide a phrase at the end of a
  long first message (ADR 0013).
- **Inbox row conversation link (M9, ADR 0011):** whether an inbox row carries
  its own conversation ID, for example a link to
  `/clubmail/conversation/conversation-wrapper-personal-…` on the row root or
  its `button-delete-conversation` control (sanitized as `X` in `01-inbox.md`).
  If it does, M9 can check that the deleted conversation's own row left the
  list, not only one of the member's rows.
- **Empty inbox:** how the inbox renders with no conversations, for example an
  empty-state element. This decides how a feature tells "empty" from "loading".
- **Item 7 (F7), done (2026-09-24):** Ignore is only on the profile page
  (`Profil ignorieren` in `profile-context-menu`), behind a `j-modal`
  confirmation; afterwards the item reads "Profil nicht mehr ignorieren". Delete
  asks for no confirmation, on the inbox row and on the conversation page; the
  row leaves the list and a 5-second Undo notice appears. The address does not
  change in either case (`live-evidence/10-ignore.md`). M9's live driver uses
  this (ADR 0011).
- **Item 9:** profile → Back, inbox → search and inbox → events.
- **Items 4, 5, 6 (event ClubMail composer) and 10:** not started.

Do not include another member's real name, profile text, preferences, messages,
or images. Replace personal values with invented placeholders. For DOM fields,
send either a sanitized relevant HTML fragment, a selector with a description of
what it matches, or a screenshot with DOM inspection notes.

1. **F1 — Inbox:** Inspect one normal inbox row. Identify the page signal,
   stable conversation and member identifiers, sender-name location, row root,
   message preview, and pagination or dynamic loading behavior. This is needed
   for safe page detection and identity checks. Send sanitized evidence and say
   whether navigation is full-page or client-side.
2. **F1/F9 — Conversation:** Inspect an open conversation. Identify its page
   signal, stable conversation/member/message identifiers, sender attributes
   already present, message container, and composer. This determines safe
   extraction without opening a profile. Send sanitized evidence for each field
   and mark absent fields as absent.
3. **F1/F9 — Profile:** Inspect a profile you are permitted to view. Identify a
   stable member ID and the locations, if present, of verification, join date,
   photo count, profile text, profile type, and completeness inputs. This is
   required for snapshots and qualification. Send structure only with all
   personal values replaced.
4. **F1 — Search:** Inspect the search page and one result. Identify the page
   and result roots, stable member identity, visible fields, and dynamic
   loading. This gates search enhancement. Send sanitized evidence.
5. **F1 — Event and calendar:** Inspect an event page and, if separate, its
   calendar/list page. Identify stable event identity, page roots, venue/event
   fields, attendee identity availability, and navigation behavior. This gates
   event metadata. Send sanitized evidence without attendee data.
6. **F1 — Composers:** Inspect the standard message composer and any event
   ClubMail composer available to you. Identify the editable control and which
   input/change events JoyClub requires, and confirm that Send is a separate
   explicit control. This gates safe template insertion. Send sanitized DOM or
   inspection notes; do not send message content.
7. **F7 — Ignore and Delete:** In a conversation, determine whether Ignore is
   available in-page or requires profile navigation. Record the visible steps,
   confirmations, success indicators, Delete path, and behavior after each step.
   This gates the destructive state machine. Send notes/screenshots with
   identities hidden; do not perform the action unless you intend to. The Delete
   control is already observed
   (`j-control-button[data-e2e="button-delete-conversation"]`); its confirmation
   and success signal are not. The M9 driver (`QuickActionDriver` in
   `src/actions/executor.ts`) needs, for Ignore and for Delete separately:
   - the control: where it is (on the conversation page, inside "Optionen", or
     on the profile) and a selector, preferably a `data-e2e` hook;
   - the confirmation: whether JoyClub asks, the dialog's root and its confirm
     button, and its cancel button;
   - success: what JoyClub shows afterwards (a message, a changed control, a
     route change) and how long it takes;
   - identity: whether the dialog or the page after each step still shows the
     member ID or the conversation ID in the URL or the DOM;
   - navigation: whether any step reloads the page or routes elsewhere.
8. **F9 — Attribute matrix:** For verification, photo count, account age,
   profile type, and profile text/word count, report Present, Absent, or Unclear
   on inbox row, open conversation, and open profile. This establishes when a
   criterion must remain Unknown. Send the completed matrix, not personal data.
9. **F1 — Navigation:** While moving among the listed pages, report whether URLs
   and documents reload, History API navigation occurs, and content changes
   dynamically. This decides which coordinator signals are necessary. Send a
   short observation per transition.
10. **F8 — Firefox distribution:** The channel is chosen: unlisted
    self-distribution with automatic updates (owner, 2026-09-26, ADR 0016).
    Current Mozilla signing requirements then need verification against official
    documentation before release packaging is claimed. A research draft with the
    steps, the manifest gaps (the missing `data_collection_permissions`; the
    extension ID is decided, ADR 0016) and a verification checklist is in
    `docs/distribution.md` (2026-09-25); it could not be checked against the
    live pages from this environment.

## Phase gate

F2's live acceptance passed on 2026-09-23 (`manual-acceptance.md`, items 14 to
18). Milestone A is complete.
