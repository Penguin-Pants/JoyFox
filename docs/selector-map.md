# Selector map

No JoyClub or JOYCE selectors, routes, member identifiers, conversation
identifiers, fields, or controls have been verified. Every page definition is
therefore marked `unverified`, contains no selectors, and produces a safe
missing result.

| Surface                 | Status     | Runtime behavior |
| ----------------------- | ---------- | ---------------- |
| Inbox                   | Unverified | Disabled         |
| Conversation            | Unverified | Disabled         |
| Profile                 | Unverified | Disabled         |
| Search                  | Unverified | Disabled         |
| Event                   | Unverified | Disabled         |
| Event calendar          | Unverified | Disabled         |
| Standard composer       | Unverified | Disabled         |
| Event ClubMail composer | Unverified | Disabled         |

A selector may become verified only with sanitized evidence described in
`manual-verification-needed.md`. Its synthetic fixture and integration test must
be committed with the selector update.
