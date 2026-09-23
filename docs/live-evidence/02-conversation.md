# Open conversation

Method: same as 01-inbox.md — read-only JS querying class names/attribute
names/attribute presence only. No message text, sender name, or photo was read
or reproduced. Values shown below are either structural (selectors, attribute
names) or German UI control labels (aria-label/title text on buttons — site
chrome, not personal data).

## URL pattern

`https://www.joyclub.de/clubmail/conversation/conversation-wrapper-personal-0000000-0000000/`
(two numeric segments in the path — likely a pair of participant/conversation
identifiers; digits replaced with 0, no trailing word to replace with NAME)

## Message bubble

- Repeated message wrapper: `li.cm-message-list-item.cm-message-list__item`
- Bubble element: `div.cm-message-bubble` (contains
  `div.cm-message-bubble__content` inside a `<j-message-bubble>` custom element)
- Mine vs. theirs: carried by a BEM modifier class on the bubble itself:
  - `cm-message-bubble--right` — 1 of the 2 modifiers seen (structurally
    consistent with "sent/mine" in a typical chat layout — inferred from
    position convention only, not from reading who sent it)
  - `cm-message-bubble--left` — the other modifier (structurally consistent with
    "received/theirs")
- No other class or data- attribute distinguished sender on the bubble itself.

## Sender header

Container: `a.cm-conversation-header.cm-conversation-header--normal` (the whole
header is itself a link — see Profile link row below)

| Field                   | Present? | Selector                                                                                                                                    |
| ----------------------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| Verification badge      | Present  | `.cm-conversation-header j-veri-icon` (attribute `verification-status`, same coding as inbox rows)                                          |
| Gender icon             | Present  | `.cm-conversation-header j-gender-icon` (attribute `universal-gender`, same coding as inbox rows)                                           |
| Photo count             | Absent   | not found in header (no matching element by class-name search)                                                                              |
| Account age / join date | Absent   | not found in header (no matching element by class-name search)                                                                              |
| Profile text            | Present  | `.cm-conversation-header__description` — plain text node (no child elements), non-empty                                                     |
| Profile link            | Present  | `.cm-conversation-header[href]` — the header `<a>` itself; `href` is `/profile/{digits}.{username}.html` (both parts sanitized in practice) |

Name element (for completeness, not requested but adjacent):
`.cm-conversation-header__name-readonly .title-ellipsis`

## Compose box

- Element type: `<textarea>`
- Selector: `textarea.joy-input-wonder__input` (has `rows`, `placeholder`,
  `maxlength`; `id` sanitizes to `joy-input-wonder-textarea` — no digits in it)
- Containing form: `form.joy-input-wonder.joy-input-wonder--expanded`
- Send control: `button.joy-input-wonder__button[data-e2e="button-submit"]` —
  separate element from the textarea, visible label "Senden" ("Send"). Not
  clicked.
- Other controls in the same toolbar (attachments, emoji, "Extras", templates)
  are present but out of scope for this file.

## Ignore / Block / Delete controls

| Control | Present? | Visible label                                                            | Selector                                                  | Notes                                                                                                                                                                     |
| ------- | -------- | ------------------------------------------------------------------------ | --------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Delete  | Present  | "Unterhaltung in den Papierkorb schieben" ("Move conversation to trash") | `j-control-button[data-e2e="button-delete-conversation"]` | Directly visible, not inside a menu. Not clicked.                                                                                                                         |
| Ignore  | Unclear  | —                                                                        | —                                                         | No directly-visible control found labeled ignore/block/report. Likely lives inside the header's "Optionen" (options) kebab menu — see below. Not opened, per instruction. |
| Block   | Unclear  | —                                                                        | —                                                         | Same as Ignore.                                                                                                                                                           |

A header options ("kebab") menu exists:
`j-control-button[data-e2e="button-conversation-kebap"]`, aria-label "Optionen".
This was **not opened** (task said not to open menus), so whether it contains
Ignore/Block items is unconfirmed.

## Skipped or unclear

- Ignore/Block presence inside the "Optionen" kebab menu — not checked, menu not
  opened.
- Conversation ID vs. sender member ID: not distinguished — the URL has two
  numeric segments and no DOM attribute was checked in this pass to say which is
  which (out of scope for this request).
