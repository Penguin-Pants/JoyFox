# Live evidence

Sanitized observations of the live JoyClub site, captured on 2026-09-22 with
Claude in Chrome from the project owner's own logged-in account. They are the
evidence that `docs/manual-verification-needed.md` requires before a selector
may be marked verified.

Every name, message, profile text, image and URL nickname was replaced with a
placeholder (`NAME`, `TEXT`, `X`, `IMG`), and every digit in an identifier was
replaced with `0`. The code values in `01-inbox.md` (`verification-status`,
`universal-gender`) are site enumeration codes, not personal data.

| File                     | Covers                                        | Checklist item                                 |
| ------------------------ | --------------------------------------------- | ---------------------------------------------- |
| `01-inbox.md`            | Inbox list, row structure, code values        | 1                                              |
| `02-conversation.md`     | Open conversation, header, composer, controls | 2, 6 (standard composer), 7 (observation only) |
| `03-profile.md`          | Profile page fields                           | 3                                              |
| `08-attribute-matrix.md` | Where each qualification criterion appears    | 8                                              |
| `09-navigation.md`       | Full page load versus client-side navigation  | 9 (partial)                                    |

Not yet captured: search (4), events (5), event ClubMail composer (6), the
content of the conversation options menu (7), the remaining navigation moves (9)
and the distribution channel (10).
