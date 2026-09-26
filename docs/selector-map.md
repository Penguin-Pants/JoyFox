# Selector map

Selectors are verified only from sanitized live evidence in
`docs/live-evidence/`. The code source of truth is `src/selectors/registry.ts`;
every verified entry there names its evidence file.

Rules:

- Prefer JoyClub's `data-e2e` test hooks, then BEM class names.
- Never select on `data-v-*` attributes. They are Vue build hashes and change
  with each JoyClub release. A test enforces this.
- Only `www.joyclub.de` is verified. JOYCE (`joyce.app`) has no evidence, so no
  page is detected there.
- Identity comes only from the numeric member ID. The inbox sender name is read
  for display alone (the F2 proof of concept); it is never an identity, never
  stored and never logged. The only message text read is the inbox row's
  preview, for the "First message contains" rule condition (ADR 0013): it is
  compared with the rule's phrases and dropped, never stored and never logged.
  Conversation message bubbles are never read.
- The content script starts only on a verified host.
- The member panel (M2, M6) and the note and tag editor (M5) are placed after
  the conversation and profile roots below, and read only the member ID. If the
  root or the member ID is missing, neither appears.

| Surface                  | Status     | Evidence             | Runtime behavior        |
| ------------------------ | ---------- | -------------------- | ----------------------- |
| Inbox                    | Verified   | `01-inbox.md`        | Detected and extracted  |
| Conversation             | Verified   | `02-conversation.md` | Detected and extracted  |
| Profile                  | Verified   | `03-profile.md`      | Detected and extracted  |
| Search                   | Verified   | `11-search.md`       | Saved searches, counts  |
| Event                    | Verified   | `14-events.md`       | Event notes (V1-5)      |
| Event calendar           | Verified   | `14-events.md`       | Event filter (V1-5)     |
| Venue                    | Verified   | `15-venues.md`       | Venue notes (V1-5)      |
| Standard composer        | Verified   | `02-conversation.md` | Template picker (M10)   |
| Conversation Delete item | Verified   | `02-conversation.md` | M9 Delete step, flag on |
| Profile Ignore item      | Verified   | `10-ignore.md`       | M9 Ignore step, flag on |
| Event ClubMail composer  | Unverified | None                 | Disabled                |

## Page signals

Detection matches the URL path first and then waits for the root element, so a
half-rendered page is reported as missing rather than read.

| Page         | Path pattern                                                    | Root                                    |
| ------------ | --------------------------------------------------------------- | --------------------------------------- |
| Conversation | `/clubmail/conversation/conversation-wrapper-personal-<n>-<n>/` | `.cm-conversation-header`               |
| Inbox        | `/clubmail/`                                                    | `.cm-conversation-list`                 |
| Profile      | `/profile/<n>.<nickname>.html`                                  | `[data-e2e="profile-header-base-info"]` |
| Search       | `/member/` and `/member/<segment>/…/`                           | `div.member_search_list`                |
| Event        | `/event/<n>.<slug>.html`                                        | `h1.event_name`                         |
| Event list   | `/dates_partys/…`                                               | `div.card-list-ui`                      |
| Venue        | `/club/<n>.<slug>.html`                                         | `h1.profile_name`                       |

Conversation is checked before inbox, because both are client-side routes of one
app (`09-navigation.md`) and the inbox list can stay in the DOM.

## Fields

| Page         | Field             | Selector                                                                           | Value                                                |
| ------------ | ----------------- | ---------------------------------------------------------------------------------- | ---------------------------------------------------- |
| Inbox        | Row               | `.cm-conversation-list-item`                                                       | One conversation                                     |
| Inbox        | Sender name       | `[data-e2e="conversation-list-item-name"]`                                         | Display only                                         |
| Inbox        | Member ID         | `.cm-conversation-list-item__avatar[href]`                                         | Digits in `/profile/<n>.<nickname>.html`             |
| Inbox        | Verification code | `j-veri-icon[verification-status]`                                                 | `1` verified; `3` personally known (own criterion)   |
| Inbox        | Gender code       | `j-gender-icon[universal-gender]`                                                  | `1` man, `2` woman, `3` couple                       |
| Inbox        | Read state        | `.cm-conversation-list-item__read-status`                                          | BEM modifier; on some rows only; meaning unconfirmed |
| Inbox        | Message preview   | `.cm-conversation-list-item__text`                                                 | Latest message; phrase check only (ADR 0013)         |
| Conversation | Conversation ID   | URL path                                                                           | `personal-<n>-<n>`, kept opaque                      |
| Conversation | Member ID         | `a.cm-conversation-header[href]`                                                   | Digits in the profile link                           |
| Conversation | Verification code | `.cm-conversation-header j-veri-icon[verification-status]`                         | Numeric code                                         |
| Conversation | Gender code       | `.cm-conversation-header j-gender-icon[universal-gender]`                          | Numeric code                                         |
| Conversation | Short description | `.cm-conversation-header__description`                                             | Word count only                                      |
| Conversation | Message item      | `li.cm-message-list-item`                                                          | Recorded, not read (see below)                       |
| Conversation | Composer          | `textarea.joy-input-wonder__input`                                                 | Template insertion target (M10)                      |
| Conversation | Send              | `button.joy-input-wonder__button[data-e2e="button-submit"]`                        | Recorded only, never clicked                         |
| Profile      | Member ID         | URL path                                                                           | Digits before the first `.`                          |
| Profile      | Verification code | `[data-e2e="profile-header-base-info"] j-veri-icon[…]`                             | Numeric code                                         |
| Profile      | Photo count       | `.amount-badge[aria-label]`                                                        | `"<n> Fotos"` or `"1 Foto"`                          |
| Profile      | Profile text      | `.profile-description-maintext__text`                                              | Word count of the main text only (motto not counted) |
| Profile      | Account age       | `.profile-sidebar-container__badge-list j-list-item` with text "Angemeldet seit …" | Join window from a rounded duration                  |
| Search       | Result list       | `div.member_search_list`                                                           | Saved-search bar goes before it                      |
| Search       | Filter button     | `[data-e2e="search-filter-button"]`                                                | Recorded only                                        |
| Profile      | Preference list   | `div.profile-erotic-prefs`                                                         | "Vorlieben"; a visible and a hidden copy per person  |
| Profile      | Preference level  | `div.profile-erotic-prefs__category`                                               | One group per level that has tags                    |
| Profile      | Level name        | `h4.profile-erotic-prefs__category-title`                                          | One of six names (`13-preferences.md`)               |
| Profile      | Preference tag    | `div.profile-erotic-prefs__category-item-list > j-tag`                             | Label: `a.j-tag` in its shadow root; the only key    |
| Profile      | Own profile       | `h2.profile-headline` with text "Account"                                          | Only the viewer's own profile has it                 |
| Search       | Result link       | `a[data-e2e="result-item"]`                                                        | Member ID for the shared count (V1-2)                |
| Search       | Result card       | `j-member-card` in the link                                                        | Badge in its `badge-top-right` slot                  |
| Event        | Event ID          | URL path                                                                           | Digits before the first `.`                          |
| Event        | Title             | `h1.event_name`                                                                    | Kept with the user's notes                           |
| Event        | Start             | `.event_info_box .event-time`                                                      | "Samstag, 27. September 2026 - ab 21:00", local time |
| Event        | Venue link        | `.event_location_detail a.event_club`                                              | `/club/<n>.<slug>.html` and the venue's name         |
| Event        | Guest entry       | `.tab-pane[id^="guest_"] a.card.normal`                                            | Profile link; shared-count badge (V1-2)              |
| Event        | Guest name        | `div.date_moreinfo`                                                                | The badge goes here                                  |
| Event list   | Item              | `div.card-list-ui-list-item`                                                       | Event and date cards alike                           |
| Event list   | Event item        | `div.card-list-ui-list-item.event-card-ui[data-element-id]`                        | `data-element-id` is the event ID                    |
| Event list   | Headline          | `.card-ui-detail-right-headline`                                                   | The badge goes here                                  |
| Venue        | Venue ID          | URL path                                                                           | Digits before the first `.`                          |
| Venue        | Name              | `h1.profile_name`                                                                  | Kept with the user's notes                           |

## Layout dependency (ADR 0010)

The member strip goes after the header's parent when that parent is a horizontal
flex container, found with `getComputedStyle`, not with a class. This relies on
JoyClub laying the conversation header and its menu buttons out as one row, as
seen in the owner's screenshot of 2026-09-24. If that changes, the strip falls
back to following the header element.

The inbox views hide each row's slot: the row and the wrappers around it that
hold nothing else, found by structure (`rowSlot`), not by class. JoyClub wraps
each row in two plain `div`s that keep their height when only the row is hidden
(`01-inbox.md`, "List structure"). The climb stops at the list root and at the
first wrapper with more than one child, so it can never hide the list.

## Compatibility sort (V1-2)

The sort gives each loaded result's item a CSS `order` and never moves JoyClub's
elements. The items are the children of the lowest element that holds every
result link. `order` works only when that element is a flex or grid container,
found with `getComputedStyle`; otherwise JoyFox says the list cannot be sorted.
`11-search.md` does not record the list's layout, so this is a live check
(`manual-acceptance.md`, item 119).

## M9 controls (ADR 0011)

`src/selectors/quick-action.ts`, from `02-conversation.md` and `10-ignore.md`:

| Page         | Control                  | Selector                                                                      |
| ------------ | ------------------------ | ----------------------------------------------------------------------------- |
| Conversation | Menu                     | `j-context-menu.cm-conversation__context-menu` in `header.cm-clubmail-header` |
| Conversation | Menu button              | its direct child `j-control-button[data-e2e="button-conversation-kebap"]`     |
| Conversation | Delete item              | `j-context-menu-item` whose text is "In den Papierkorb schieben"              |
| Profile      | Menu                     | `j-context-menu[data-e2e="profile-context-menu"]`                             |
| Profile      | Menu button              | its direct child `j-control-button[slot="activator"]`                         |
| Profile      | Ignore item              | `j-context-menu-item[title="Profil ignorieren"]` in the menu                  |
| Profile      | Ignored (success signal) | `j-context-menu-item[title="Profil nicht mehr ignorieren"]` in the menu       |
| Profile      | Dialog content           | `.profile-ignore-modal__content`, inside its `j-modal` host                   |
| Profile      | Confirm                  | `j-button[aria-label="Ignorieren"]` in that `j-modal`                         |

The conversation menu's items have no `title`, so the Delete item is matched by
its exact text, inside that one menu only. The standalone
`button-delete-conversation` is on the inbox rows only and is never clicked. The
driver clicks nothing unless there is exactly one menu and one item. The native
buttons sit in open shadow roots; the driver clicks them there.

## Open points

- **Verification codes.** Confirmed by the project owner on 2026-09-23: `1` is
  the grey shield "geprüft", verified by JoyClub. `3` is the green shield
  "persönlich bekannt": the logged-in user marked the member as met in person.
  Only `1` counts as verified. `3` is a separate "personally known" signal and
  hides JoyClub's verification, which then reads as unknown. Code `2`, any other
  code and a missing shield read as unknown, never as "not verified".
- **Gender codes.** Confirmed by the project owner on 2026-09-23: `1` man, `2`
  woman, `3` couple (a male and a female icon side by side). Other codes read as
  unknown. No feature filters by profile type. Per-audience rules were dropped
  from V1 (ADR 0016).
- **Conversation header.** Switching conversations is client-side, so the URL
  can change before the header re-renders. Header data is used only when the
  header's member ID is one of the numbers in the conversation ID. This assumes
  those numbers are participant member IDs; if they are not, header data always
  reads as missing, which is safe but must then be revisited.
- **Inbox loading.** Confirmed on 2026-09-24 (`01-inbox.md`, "List structure"):
  scrolling appends more rows to the same list, so later rows are read on the
  next mutation event.
- **Message identifiers** were not looked for, so no per-message ID exists yet.
- **Composer events.** Confirmed live on 2026-09-23 (`manual-acceptance.md` item
  33): after JoyFox sets the value and sends `input` and `change`, JoyClub
  registers the text, and also its deletion by keyboard. The M10 picker is
  therefore on by default (ADR 0007). It places itself after the composer's form
  (`textarea.form`, no extra selector) and never touches Send.
- **Message text.** `cm-message-bubble--left` and `--right` probably mean
  received and sent, inferred from layout. Nothing reads message text until that
  is confirmed and the message-caching toggle from ADR 0004 exists.
- **Member ID permanence** is unconfirmed (build plan Section 30). IDs of 6, 7
  and 8 digits were seen.
