# Sender profile

Method: same as prior files — read-only JS, class/attribute names and value
_shapes_ only. No profile text, name, age, or city value was transcribed; only
their pattern (digits vs. letters) was recorded per the sanitization rules for
this file.

## Page signal

- URL pattern: `https://www.joyclub.de/profile/0000000.NAME.html`
- Unique root/signal: path starts with `/profile/` followed by
  `{digits}.{username}.html`; page also carries
  `[data-e2e="profile-header-base-info"]` as a stable content hook.

## Member ID location

- **Present in URL only**: `/profile/{digits}.{username}.html` — the digit run
  before the first `.` is the member ID.
- **Not found** as a `data-user-id` / `data-member-id` / `data-userid` /
  `data-profile-id` attribute anywhere on the page (scanned, no matches). No
  `<link rel="canonical">` or `og:url` meta tag was present to cross-check.

## Fields

| Field                                     | Present?             | Selector                                                                                                                      | Value shape                                                                                                                                                                             |
| ----------------------------------------- | -------------------- | ----------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Verification badge                        | Present              | `[data-e2e="profile-header-base-info"] j-veri-icon`                                                                           | numeric-coded attribute `verification-status` (same coding as inbox/conversation)                                                                                                       |
| Join date / member-since                  | Absent               | —                                                                                                                             | No element found matching date/since/"seit" naming patterns. An `online-status` element exists (`span.online-status.is_offline`) but that's live online/offline state, not a join date. |
| Photo count                               | Present              | `.amount-badge[aria-label]`                                                                                                   | integer + unit text, shape `"0 Fotos"` (i.e. `<number> Fotos`) — read from the attribute, not rendered text (element's own text content was empty)                                      |
| Photo list (alternative to count)         | Present              | `.profile-main-album-slider .profile-main-album-slider__card` / `.profile-album-card`                                         | repeating card elements — could be counted via `querySelectorAll(...).length` instead of reading the badge                                                                              |
| Profile text block                        | Present              | `.profile-description-motto__text` (short "motto" line) and `.profile-description-maintext__text` (longer paragraph, a `<p>`) | free text, two separate blocks                                                                                                                                                          |
| Profile type / gender                     | Present              | `[data-e2e="profile-header-base-info"] j-gender-icon` (icon, `universal-gender` attribute) **and** a text label               | icon: numeric-coded attribute, same as inbox/conversation. Adjacent text label: short word shape (all-letters, ~4 characters) inside `.profile-base-info__line-2 > span:first-child`    |
| Secondary line-2 text (age/location-like) | Present              | `.profile-base-info__line-2 > span:nth-child(2)`                                                                              | shape `"00 + 00 xxxxx"` — two digit groups plus a word, consistent with an age-or-similar-numeric pair followed by a place name                                                         |
| Profile completeness indicator            | Absent               | —                                                                                                                             | No element matched completeness/progress/percent naming patterns.                                                                                                                       |
| Badge list (other)                        | Present, not decoded | `.profile-sidebar-container__badge-list j-list-item`                                                                          | 3 generic icon badges (`div.profile-badge__icon > j-icon`) present; their meaning wasn't decoded — out of scope for the fields requested.                                               |

## Skipped or unclear

- Did not decode the meaning of the 3 generic profile badges
  (`profile-badge__icon`) — no verification/join-date/completeness naming
  pattern matched them, and decoding would require reading their (sanitized)
  visual icons, which wasn't requested here.
- Did not confirm which of the two `line-2` spans is age vs. which represents
  something else — reported by shape only, not interpreted.
- No join-date/member-since field was found anywhere on the page by class-name
  search; can't rule out that it exists under a naming convention not covered by
  the search terms used.

## Confirmation (2026-09-23)

The project owner found the membership duration on a profile, as one item of the
sidebar badge list (`.profile-sidebar-container__badge-list j-list-item`,
recorded above as "not decoded"). Sanitized fragment; it holds no personal data:

```html
<j-list-item>
  <div slot="image" class="profile-badge__icon">
    <j-icon type="j-ico-user" size="22"></j-icon>
  </div>
  <!---->
  Angemeldet seit 11 Monaten
</j-list-item>
```

The earlier "Join date / member-since: Absent" row is superseded: the class-name
search could not find it because the badge is identified by its text, not a
class. The duration appears on member and couple profiles.
