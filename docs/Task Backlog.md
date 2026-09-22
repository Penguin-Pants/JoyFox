# Task Backlog

Work items derived from the Feature Inventory and Technical Design tabs, sequenced against the Release Roadmap. Every task traces back to a PRD section.

## Foundation Phase

Nothing in MVP starts until F1 through F6 are done. Every task cites the PRD or Technical Design section it traces back to.

| ID | Task | Depends on | Acceptance criteria | Size |
| --- | --- | --- | --- | --- |
| F1 | Verify JoyClub DOM structure: inbox, conversation, profile, search, event pages (PRD 16.1) | None | A selector map is documented per page type; each field's fallback behavior is confirmed | L |
| F2 | POC 1, inbox detection and one-field extraction (PRD 24.4) | F1, partial | Content script reliably extracts the sender name across 10 real inbox loads | S |
| F3 | POC 2, background event-page persistence (PRD 24.4) | None | A counter survives a forced background restart, confirmed in devtools | S |
| F4 | POC 3, WebCrypto encrypt and decrypt round trip against a mock endpoint (PRD 24.4) | None | Ciphertext decrypts back to the original plaintext; the mock server never receives plaintext | S |
| F5 | Build manifest and background scaffolding, the message envelope from Technical Design | F2 | A message sent from a content script reaches the background and gets a reply matched by requestId | M |
| F6 | Implement the Section 12 data model as one repository module per entity | F5 | Get, list, put, delete round-trip tested for every entity | M |
| F7 | Check whether JoyClub's conversation view exposes Ignore in-page, the fastest path for Quick Ignore and Delete | F1 | Documented yes or no, with the same-tab fallback plan confirmed either way | S |
| F8 | Verify Mozilla's current signing requirements for a self-distributed, unlisted build (PRD 18.2, 23) | None | Documented steps to produce a signed, installable build outside AMO | S |

## MVP Phase

Matches the PRD's Section 19.1 scope exactly. Nothing here is not in that list, and nothing in that list is missing here.

| ID | Task | Depends on | Acceptance criteria | Size |
| --- | --- | --- | --- | --- |
| M1 | Sender Qualification Score | F1, F6 | Matches a manual check at least 95 percent of the time across 50 messages (PRD 21.1) | M |
| M2 | Inbox Triage and Quarantine | M1 | A quarantined item never appears in the default view and is fully retrievable (PRD 21.1) | M |
| M3 | Copy-Paste and Template Spam Detector, rule-based | F6 | A near-identical message is flagged automatically; an override persists for that sender (PRD 6.1) | M |
| M4 | One global Contact Rule, simplified rule builder | M1, F6 | A sender failing the rule is quarantined by default, with the reason visible | M |
| M5 | Profile Notes and Tags | F6 | A note survives a restart and a markup change that keeps the same profile ID | S |
| M6 | Local Trust and Compatibility Score, basic version | M1, M5 | Updates immediately after a new interaction outcome is logged | M |
| M7 | Multi-account data scoping | F6 | Switching the active account never shows one account's data under another (PRD 21.3) | M |
| M8 | Data inspector, export, delete | F6 | A full export is complete against every entity, verified item by item (PRD 21.4) | M |
| M9 | Quick Ignore and Delete, Mode A | F7, F5 | Correct sender ignored and correct message deleted in 100 percent of test cases; a partial failure always shows which step failed (PRD 21.2) | L |
| M10 | Message Templates and Composition Assistance | F6 | A saved template inserts with no corruption in every compose context, including event ClubMail (PRD 21.2) | M |

## Status

| ID | Status | Notes |
| --- | --- | --- |
| F0 to F6 | Done | See `foundation-audit.md`. F2's live acceptance waits on F1. |
| F1, F7, F8, F9 | Blocked | Human-assisted verification. See `manual-verification-needed.md`. |
| M5 | Partial | Notes and tags persist, keyed to account plus a resolved member identity. Writes are refused while no member selector is verified, and the profile UI waits on F1. See `milestone-b-audit.md`. |
| M7 | Partial | Explicit active account, account-scoped repositories, options switcher, and the Section 14 isolation test. Automatic account detection waits on F1 and F9. |
| M1, M2, M3, M4, M6, M8, M9, M10 | Not started | |

### Follow-up work recorded during M5 and M7

- Add a member index for user tags so per-member tag reads do not scan the
  account. This changes the database schema and belongs with M8.
- Make account creation atomic, so two concurrent creates cannot both pass the
  duplicate identifier check.
- Replace the user-declared account identifier with a verified one once F1 and
  F9 establish where the JoyClub account identity appears.

M9 is the largest and riskiest MVP task, both in size and in its dependency on F7's still-unverified in-page-versus-navigation question. If F1 through F7 push MVP's timeline out meaningfully, M9 is the one task worth reconsidering for a fast-follow release rather than the rest of MVP slipping with it. That is a scope call, not a technical one, and stays with the person running this project.

## V1 Phase, for Context

Not yet broken into tasks with acceptance criteria. Listed so the Foundation and MVP work above is visibly building toward something, not just an unconnected list.

- Per-audience contact rules
- Compatibility Overlay
- Saved Searches
- Conversation History Search
- Personal Event Tracker
- Self-hosted sync, which depends on F4's encryption groundwork from Foundation
- Data-inspector polish
- Repository cleanup, documentation, self-distributed public release

Task-level detail for this phase is worth doing once MVP is closer to done, not now, since MVP's own build will likely surface V1 scope questions this document cannot anticipate yet.
