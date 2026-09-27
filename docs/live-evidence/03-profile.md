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

## Mobile and desktop headers (owner's live checks, 2026-09-27)

The profile page holds two headers and hides one by screen width. Measured in
the Web Console on a desktop window:

- `[data-e2e="profile-header-base-info"]` matches once. It sits in
  `div.profile-header__base-information--mobile`, which has `display: none`, so
  it has no layout boxes.
- The displayed header carries no `data-e2e` marker. Its chain, from the gender
  and verification icons up: `div.profile-base-info__line-1` (flex row),
  `div.profile-base-info` (flex column),
  `div.profile-header__base-information--desktop` (flex column, 110 px),
  `div.profile-header__main-infos` (flex row, 220 px, with
  `div.profile-header__pic`), `div.profile-header` (block, 310 px).

JoyFox anchored its strip on the only marked header, the hidden mobile one, so
the strip was in the page with a height of 0. A first fix (PR #72) assumed two
marked copies and did not help. The root selector now also matches
`.profile-header__base-information--desktop`, and JoyFox takes the matching
header that has layout boxes. The strip follows the desktop header's row
(`div.profile-header__main-infos`), full width under the photo and the header.
The gender and verification codes are still read from the mobile header, which
holds them while hidden.

## Verification badge and shield codes (owner's live check, 2026-09-27)

Measured in the Web Console on two profiles. Badge texts with digits replaced by
`N`:

- Verified member: shield code `1` in both headers; badges "Verifiziertes
  Mitglied", "N Forenbeiträge", "N Forenthema", "Angemeldet seit N Jahren".
- Member not verified: shield code `0` in both headers; badges "Mitglied noch
  nicht verifiziert Mitglied" (the text as read, with the word twice), "Neu im
  JOYclub".
- A member marked "persönlich bekannt": code `3` in both headers. On a verified
  member, the verification badge then holds a second text in its `description`
  slot, and the whole item reads "Persönlich bekannt Verifiziertes Mitglied".
  Sanitized fragment:

  ```html
  <j-list-item>
    <div class="profile-badge__icon profile-badge__icon--green" slot="image">
      …
    </div>
    <div slot="description">Persönlich bekannt</div>
    Verifiziertes Mitglied
  </j-list-item>
  ```

  JoyFox reads a badge's own label (its text outside slotted children) and falls
  back to the whole text only when the label says nothing.

Both grey codes show the same grey shield; green replaces it. The shield holds
no `title` or label text.
