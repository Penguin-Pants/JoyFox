# Manual verification needed

## Status (2026-09-22)

Item 3 is done, and items 1, 2, 6, 8 and 9 are partly done. The evidence is in
`docs/live-evidence/`, and the inbox, conversation and profile selectors are
verified from it. Still open:

- **Item 1:** whether scrolling the inbox loads more conversations, and how.
- **Item 2:** whether a message has a stable identifier.
- **Item 6:** which input or change events the standard composer needs after its
  value is set programmatically.
- **Item 8:** whether a join date or account age appears anywhere, and what
  `universal-gender` codes `2` and `3` mean.
- **Verification codes:** `1` (grey, "geprüft", verified by JoyClub) and `3`
  (green, "persönlich bekannt", you met them) are confirmed. Still open: whether
  code `2` exists and what it means, what an unverified member shows (no shield,
  or a code), and whether a member who is both verified and personally known
  always shows green.
- **Read-status icon (from the F2 check):** a read state was extracted from 9 of
  25 rows. Check how many rows show the icon at all, which modifier classes
  appear (for example `--received`, `--read`), and whether the rows with the
  icon are those where you sent the last message.
- **Empty inbox:** how the inbox renders with no conversations, for example an
  empty-state element. This decides how a feature tells "empty" from "loading".
- **Item 7:** whether the conversation "Optionen" menu contains Ignore or Block.
  The menu was not opened.
- **Item 9:** profile → Back, inbox → search and inbox → events.
- **Items 4, 5, 6 (ClubMail composer) and 10:** not started.

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
   identities hidden; do not perform the action unless you intend to.
8. **F9 — Attribute matrix:** For verification, photo count, account age,
   profile type, and profile text/word count, report Present, Absent, or Unclear
   on inbox row, open conversation, and open profile. This establishes when a
   criterion must remain Unknown. Send the completed matrix, not personal data.
9. **F1 — Navigation:** While moving among the listed pages, report whether URLs
   and documents reload, History API navigation occurs, and content changes
   dynamically. This decides which coordinator signals are necessary. Send a
   short observation per transition.
10. **F8 — Firefox distribution:** Confirm the intended distribution channel
    (temporary development, unlisted self-distribution, or listed AMO). Current
    Mozilla signing requirements then need verification against official
    documentation before release packaging is claimed.

## Phase gate

F2's live acceptance passed on 2026-09-23 (`manual-acceptance.md`, items 14 to
18). Milestone A is complete.
