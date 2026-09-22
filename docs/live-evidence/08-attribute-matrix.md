# Attribute matrix

Filled in from 01-inbox.md, 02-conversation.md, and 03-profile.md.

| Criterion                         | Inbox row | Open conversation | Open profile | Cached snapshot |
| --------------------------------- | --------- | ----------------- | ------------ | --------------- |
| Verification badge                | Present   | Present           | Present      | Stored          |
| Photo count                       | Unclear   | Absent            | Present      | Stored          |
| Account age or join date          | Unclear   | Unclear           | Unclear      | Field exists    |
| Profile type (man, woman, couple) | Unclear   | Unclear           | Unclear      | Not stored      |
| Profile text or word count        | Absent    | Present           | Present      | Stored          |

## Notes

- Verification badge and profile type (gender icon) use the same numeric-coded
  attribute across all three surfaces (`verification-status` on `j-veri-icon`,
  `universal-gender` on `j-gender-icon`), suggesting shared components.
- Photo count only appears on the full profile page
  (`.amount-badge[aria-label]`, shape `"0 Fotos"`); neither the inbox row nor
  the conversation header shows a count.
- Account age / join date was not found as a distinct field on any of the three
  surfaces. The profile page does show live online/offline status, which is a
  different thing and not counted as "Present" here.
- Profile text: absent on the inbox row (only a message preview exists there,
  which is different from profile text); present on both the conversation header
  (short description) and the full profile (motto + main text blocks).

## Corrections after review

Two rows were first recorded as Absent and Present. They are Unclear, because
the evidence does not establish more:

- **Account age or join date:** the search matched class names only. The profile
  evidence states that a field under another naming convention cannot be ruled
  out, and the inbox was not searched for it.
- **Profile type:** an icon is present on all three pages, but only
  `universal-gender="1"` (man) is mapped. Codes `2` and `3`, used by 14 of the
  25 inbox rows, are unmapped, so the icon cannot yet be read as man, woman or
  couple.
- **Photo count on the inbox row:** Unclear, not Absent. The inbox evidence does
  not record a search for a photo count.

## Cached snapshot column

Added after review, from the `ProfileSnapshot` schema rather than from the site.
A snapshot can only hold what an open profile showed, so it fills a gap on the
inbox or conversation only for a member whose profile was opened before.

- **Stored:** the snapshot has a field for it, and the profile page supplies it
  (verification as a code, photo count, word count).
- **Field exists:** the snapshot has a `joinedAt` field, but no page supplies a
  join date yet, so it stays unknown.
- **Not stored:** the snapshot has no field for profile type. A profile-type
  criterion therefore cannot be filled from a cache.
