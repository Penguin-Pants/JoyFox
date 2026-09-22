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
- Names and message text are never extracted. Identity comes only from the
  numeric member ID.

| Surface                 | Status     | Evidence             | Runtime behavior       |
| ----------------------- | ---------- | -------------------- | ---------------------- |
| Inbox                   | Verified   | `01-inbox.md`        | Detected and extracted |
| Conversation            | Verified   | `02-conversation.md` | Detected and extracted |
| Profile                 | Verified   | `03-profile.md`      | Detected and extracted |
| Search                  | Unverified | None                 | Disabled               |
| Event                   | Unverified | None                 | Disabled               |
| Event calendar          | Unverified | None                 | Disabled               |
| Standard composer       | Observed   | `02-conversation.md` | Selector recorded only |
| Event ClubMail composer | Unverified | None                 | Disabled               |

## Page signals

Detection matches the URL path first and then waits for the root element, so a
half-rendered page is reported as missing rather than read.

| Page         | Path pattern                                                    | Root                                    |
| ------------ | --------------------------------------------------------------- | --------------------------------------- |
| Conversation | `/clubmail/conversation/conversation-wrapper-personal-<n>-<n>/` | `.cm-conversation-header`               |
| Inbox        | `/clubmail/`                                                    | `.cm-conversation-list`                 |
| Profile      | `/profile/<n>.<nickname>.html`                                  | `[data-e2e="profile-header-base-info"]` |

Conversation is checked before inbox, because both are client-side routes of one
app (`09-navigation.md`) and the inbox list can stay in the DOM.

## Fields

| Page         | Field             | Selector                                                                  | Value                                    |
| ------------ | ----------------- | ------------------------------------------------------------------------- | ---------------------------------------- |
| Inbox        | Row               | `.cm-conversation-list-item`                                              | One conversation                         |
| Inbox        | Member ID         | `.cm-conversation-list-item__avatar[href]`                                | Digits in `/profile/<n>.<nickname>.html` |
| Inbox        | Verification code | `j-veri-icon[verification-status]`                                        | Numeric code, meaning unconfirmed        |
| Inbox        | Gender code       | `j-gender-icon[universal-gender]`                                         | Numeric code, `1` = man                  |
| Inbox        | Read state        | `.cm-conversation-list-item__read-status`                                 | BEM modifier: `received`, `read`         |
| Conversation | Conversation ID   | URL path                                                                  | `personal-<n>-<n>`, kept opaque          |
| Conversation | Member ID         | `a.cm-conversation-header[href]`                                          | Digits in the profile link               |
| Conversation | Verification code | `.cm-conversation-header j-veri-icon[verification-status]`                | Numeric code                             |
| Conversation | Gender code       | `.cm-conversation-header j-gender-icon[universal-gender]`                 | Numeric code                             |
| Conversation | Short description | `.cm-conversation-header__description`                                    | Word count only                          |
| Conversation | Message item      | `li.cm-message-list-item`                                                 | Recorded, not read (see below)           |
| Conversation | Composer          | `textarea.joy-input-wonder__input`                                        | Recorded only                            |
| Conversation | Send              | `button.joy-input-wonder__button[data-e2e="button-submit"]`               | Recorded only, never clicked             |
| Profile      | Member ID         | URL path                                                                  | Digits before the first `.`              |
| Profile      | Verification code | `[data-e2e="profile-header-base-info"] j-veri-icon[…]`                    | Numeric code                             |
| Profile      | Photo count       | `.amount-badge[aria-label]`                                               | `"<n> Fotos"` or `"1 Foto"`              |
| Profile      | Profile text      | `.profile-description-motto__text`, `.profile-description-maintext__text` | Word count of both blocks together       |
| Profile      | Join date         | None                                                                      | Absent on the site; always unknown       |

## Open points

- **Verification codes.** The evidence saw `1` (grey shield) and `3` (green
  shield) and inferred the meaning from colour only. Until the meaning is
  confirmed, every code reads as unknown, so verification never passes or fails
  on a guess.
- **Gender codes `2` and `3`** are unconfirmed. No feature uses gender yet.
- **Message text.** `cm-message-bubble--left` and `--right` probably mean
  received and sent, inferred from layout. Nothing reads message text until that
  is confirmed and the message-caching toggle from ADR 0004 exists.
- **Member ID permanence** is unconfirmed (build plan Section 30). IDs of 6, 7
  and 8 digits were seen.
