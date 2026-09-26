# ClubMail conversation

Captured 2026-09-26 with Claude in Chrome from the owner's account, using the
first version of `capture-prompt-e1-e4.md` (before its review fixes). Sanitized
again on review: nothing further needed.

Method: Opened the ClubMail inbox and clicked the most recent conversation
(owner's choice). Inspected the message list DOM and the `j-message-bubble`
shadow root with read-only `querySelectorAll`, attribute reads and text-length
counts. Scrolled the message pane up twice. No message text, names or links were
recorded; only structure and value shapes.

## Page signal

- URL pattern (inbox): `/clubmail/`
- URL pattern (conversation):
  `/clubmail/conversation/conversation-wrapper-personal-00000000-0000000/`
  - First number: the owner's member ID (verified equal).
  - Second number: the conversation partner's member ID (verified: the header
    profile link contains it).
- Unique root/signal: `[data-e2e="clubmail-header"]` (conversation header, class
  `cm-conversation-header`) and `li.cm-message-list-item`.

## Identity

- **Message ID: Present.** `li.cm-message-list-item[data-message-id]`, shape
  `cm-message-` + UUID (`xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx`, lowercase hex).
  Every list item has one, including date separators and system hints.
- Conversation ID: Absent as a separate token. The URL pair
  `<ownerId>-<partnerId>` identifies the conversation.
- Partner member ID: URL (second number) and header link
  `[data-e2e="clubmail-header"] a[href*="/profile/"]` →
  `/profile/0000000.NAME.html`.

## Fields

| Field               | Present?  | Selector                                                                                                                        | Matches        | Value shape                                                                                          |
| ------------------- | --------- | ------------------------------------------------------------------------------------------------------------------------------- | -------------- | ---------------------------------------------------------------------------------------------------- |
| Inbox entry         | Yes       | `[data-e2e="conversation-list-entry"]` (div.cm-conversation-list)                                                               | 25             | –                                                                                                    |
| Inbox entry name    | Yes       | `[data-e2e="conversation-list-item-name"]`                                                                                      | 25             | `NAME`                                                                                               |
| Message list        | Yes       | `.cm-layout-scroll__inner ul` (the one that contains `li.cm-message-list-item`; 2 `.cm-layout-scroll__inner` exist on the page) | 1              | –                                                                                                    |
| Per-item root       | Yes       | `li.cm-message-list-item.cm-message-list__item`                                                                                 | 15 on load     | has `data-message-id`                                                                                |
| Received message    | Yes       | `div.cm-message-bubble.cm-message-bubble--left[data-e2e="received-message"]`                                                    | 8              | –                                                                                                    |
| Sent message        | Yes       | `div.cm-message-bubble.cm-message-bubble--right[data-e2e="sent-message"]`                                                       | 4              | –                                                                                                    |
| Bubble component    | Yes       | `j-message-bubble` (attrs `context-menu-title="Optionen" time-style="short" bubble-theme="dark"`)                               | 12             | shadow DOM                                                                                           |
| Message text        | Yes       | `div.cm-message-bubble__content` (default slot of `j-message-bubble`)                                                           | 12             | `TEXT` (text nodes + `br`)                                                                           |
| Quote               | Sometimes | `j-message-bubble-quote.cm-message-bubble__quote[slot="quote"]`                                                                 | subset         | `TEXT`                                                                                               |
| Special content     | Sometimes | `div.cm-message-special[slot="special"]`                                                                                        | subset         | –                                                                                                    |
| Time per message    | Yes       | shadow: `j-message-bubble` → `.footer time[datetime]`                                                                           | 12             | `datetime` ISO `0000-00-00T00:00:00.000Z`; text `00:00`                                              |
| Date separator      | Yes       | `li.cm-message-list-item > time.cm-message-list-item__date`                                                                     | 5 (after load) | `datetime="0000-00-00"`, `data-timestamp` 10-digit Unix seconds; text "Wochentag, 00. Monat"         |
| Sticky date         | Yes       | `.cm-message-list__sticky-date-separator > j-badge`                                                                             | 1              | date label                                                                                           |
| System hint         | Yes       | `li > div.cm-message-system-hint[data-e2e="system-message-hint"]`                                                               | 1–2            | `TEXT` + `a.j-anchor.primary` link to a profile                                                      |
| Match message       | Yes       | `li > div.cm-match-message[data-e2e="match-message"]`                                                                           | 1 on load      | headline `span.cm-match-message__headline` + Lottie `svg`                                            |
| Quick actions (top) | Yes       | `div.cm-conversation-quick-actions` (sibling before the `ul`)                                                                   | 1              | "NAME ist nicht in deiner Kontaktliste" + `j-control-button` "Unterhaltung blockieren" (not clicked) |

### Content inside the text element

- Emoji: plain Unicode characters in text nodes. 0 `img` emoji found; 8 of 12
  bubbles contained emoji characters.
- Links: `a.j-anchor` elements.
- Line breaks: `br` elements. `white-space` is `normal`.

### Shadow DOM of `j-message-bubble`

Slots in order: `avatar`, `header`, `quote`, `media`, `special`, default (text),
`cta`, `footer` (holds `time` and `slot[name="context-menu"]`).

## Loading and navigation

- Inbox → conversation (click): client-side (`window.__jf` stayed `1`), URL
  changed.
- Older messages: scrolling the pane to the top loaded 15 more items (15 → 30).
  URL did not change. No "load older" button.
- Second scroll up: count stayed 30. The `div.cm-conversation-quick-actions`
  block sits above the first item. Inference: the conversation start was
  reached.
- Unclear: after the second scroll, the `match-message` item was no longer in
  the DOM (count 0). Inference: the list may virtualize or re-render items.

## Skipped or unclear

- Media messages (images) and their `slot="media"` content: not seen in this
  conversation.
- Whether a dedicated "conversation started" system message exists: Unclear. The
  top of the thread showed the quick-actions block, not a system message.
- Inbox entry ID attribute: none found on `[data-e2e="conversation-list-entry"]`
  (only class, `data-e2e`, `data-testid`).

## Confirmation (2026-09-26)

The project owner reloaded a conversation and confirmed that a message's
`data-message-id` stays the same after the reload.
