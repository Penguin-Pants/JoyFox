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
| `01-inbox.md`            | Inbox list, row structure, code values        | 1 (partial)                                    |
| `02-conversation.md`     | Open conversation, header, composer, controls | 2 (partial), 6 (partial), 7 (observation only) |
| `03-profile.md`          | Profile page fields                           | 3                                              |
| `08-attribute-matrix.md` | Where each qualification criterion appears    | 8 (partial)                                    |
| `09-navigation.md`       | Full page load versus client-side navigation  | 9 (partial)                                    |
| `10-ignore.md`           | Where Ignore lives: profile, not conversation | 7 (partial)                                    |

What each partial item still lacks:

- **1:** loading behavior. Scrolling was not exercised, and a search for a
  sentinel class cannot detect a scroll listener or a virtualized list.
- **2:** message identifiers. No stable per-message ID was looked for, so it is
  neither present nor recorded as absent.
- **6:** the standard composer accepts a programmatic change followed by `input`
  and `change` (confirmed live on 2026-09-23, `manual-acceptance.md` item 33).
  The event ClubMail composer is not captured.
- **8:** photo count on the inbox row, and account age on the inbox and
  conversation, are Unclear. Profile type (codes confirmed 2026-09-23) and the
  profile's account age are resolved; see `08-attribute-matrix.md`.

Not yet captured: search (4), events (5), event ClubMail composer (6), the rest
of item 7 (the conversation page's result after its Delete control; the Ignore
result and the inbox-row Delete result are in `10-ignore.md`), the remaining
navigation moves (9) and the distribution channel (10).
