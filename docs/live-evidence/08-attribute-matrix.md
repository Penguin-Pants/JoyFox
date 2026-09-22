# Attribute matrix

Filled in from 01-inbox.md, 02-conversation.md, and 03-profile.md.

| Criterion                         | Inbox row | Open conversation | Open profile |
| --------------------------------- | --------- | ----------------- | ------------ |
| Verification badge                | Present   | Present           | Present      |
| Photo count                       | Absent    | Absent            | Present      |
| Account age or join date          | Absent    | Absent            | Absent       |
| Profile type (man, woman, couple) | Present   | Present           | Present      |
| Profile text or word count        | Absent    | Present           | Present      |

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
