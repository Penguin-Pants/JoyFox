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
| F0, F2, F4 to F6 | Done | See `foundation-audit.md`. F2's live acceptance passed on 2026-09-23 (10 of 10 inbox loads). |
| F3 | Done | Automated wake-counter test passes, and the forced event-page restart in devtools passed on 2026-09-23 (`wakeCount` rose by one). |
| F1 | Partial | Inbox, conversation and profile verified from `docs/live-evidence/`. Search, events and the ClubMail composer remain. |
| F9 | Partial | Matrix in `08-attribute-matrix.md`. Verification appears on all three pages, photo count only on the profile, profile text on the conversation and the profile. Account age comes from the profile's "Angemeldet seit" badge. Profile type comes from the gender codes (`1` man, `2` woman, `3` couple). Still Unclear: photo count on the inbox row, and account age on the inbox and conversation. |
| F7 | Done | Answer: Path B. Ignore is only on the profile page ("Profil ignorieren" in `profile-context-menu`, then a `j-modal` confirmation); afterwards the item reads "Profil nicht mehr ignorieren". Delete asks for no confirmation; from the inbox row, the row goes and a 5-second Undo notice appears (`live-evidence/10-ignore.md`, 2026-09-24). The conversation page's Delete also asks for no confirmation; the row leaves the list and the conversation stays open at first (2026-09-24). |
| F8 | Blocked | Human-assisted verification. See `manual-verification-needed.md`. |
| M1 | Partial | Engine, fact merge and extraction are complete. Milestone C added the page badge, the explanation panel and profile snapshot capture. The 95 percent manual trial over 50 messages remains. |
| M2 | Partial | Tab bar, per-row badges, in-place filtering, per-sender manual placement and dynamic rows are complete and tested (`milestone-c-audit.md`). Live acceptance passed on 2026-09-23, including the split-view re-check. The existing-conversation exception is blocked on reply detection. |
| M4 | Partial | One global rule in the V1-compatible schema, a pure evaluator with explicit unknown handling, and the two-box options builder are complete and tested. The advanced editor (rule groups with AND/OR and "not", ADR 0012) is built and tested; its live acceptance (items 75 to 80) passed on 2026-09-25. Presets are deferred. Live acceptance of the two-box builder passed on 2026-09-23. |
| M6 | Partial | Point-count trust score with a full explanation, outcome logging and undo on conversation and profile pages are complete and tested. Live acceptance passed on 2026-09-23. The spam point stays unknown until M3 reads messages from a page (blocked on the message-bubble evidence). |
| M3 | Partial | Normalization, the pluggable similarity engine, duplicate and known-phrase matching, explanations, and the persisted per-sender override are complete. Nothing reads a message from a page yet, which waits on F1. |
| M5 | Partial | Notes and tags persist, keyed to account plus a verified member ID. The note and tag editor is complete and tested on the profile and conversation pages, including the acceptance "survives a restart and a markup change that keeps the same profile ID" (`milestone-b-audit.md`, M5 editor). Live acceptance (`manual-acceptance.md`, items 36 to 42) is pending. Inbox, search and event surfaces are "later" in build plan Section 12. |
| M7 | Partial | Explicit active account, account-scoped repositories, options switcher, and the Section 14 isolation test. Automatic account detection waits on F1 and F9. |
| M8 | Done | Account selector, counts, per-entity inspection, delete record, data type, account data and everything, account and full JSON export with the schema version. Export completeness is tested item by item against every entity (`milestone-d-audit.md`). Live acceptance passed on 2026-09-23 (`manual-acceptance.md`, items 27 to 30 and 35). |
| M10 | Partial | Create, edit, delete, folders and exact insertion at the cursor are complete, tested and accepted live on the standard composer (items 31 to 34, 2026-09-23). The picker is on by default (ADR 0007). The event ClubMail composer is unverified, so "every compose context" stays open. |
| M9 | Partial | Live driver built (ADR 0011, owner choice "conversation first", 2026-09-24): Delete through the conversation's three-dot menu, a tab-bound hand-off in `storage.session`, then Ignore on the profile page. Off by default. Item 43 (both steps succeed) passed live on 2026-09-24. Items 44 to 54 were accepted on 2026-09-25: 48, 49 and 51 to 54 passed live; 44, 45, 47 and 50 cannot be caused by hand and are covered by synthetic tests; 46 ends in the correct state but does not say the member was already ignored (deferred review item). The guided mode is not built. |

### MVP release gate (build plan Section 28)

| Gate item | Status |
| --- | --- |
| Cold installation works | Met: build, load, no errors (`manual-acceptance.md`, items 1 to 3) |
| Onboarding gets the extension into a usable state | Built: the options page opens on install and "Get started" tracks the steps. Timed live check pending (item 55) |
| Triage operates without hidden network access | Met: automated network-isolation test on every build |
| Missing sender information is shown as Unknown | Met (M1, M2) |
| Every triage decision can be explained | Met (M2, M4) |
| Classification overrides persist | Met (M2) |
| Profile notes survive restart | Met in automated tests (M5); live check pending (items 36 to 42) |
| Accounts remain isolated | Met: automated isolation tests (M7, M5 editor) |
| Data export covers all stored entities | Met (M8) |
| Complete data deletion works | Met (M8, item 35) |
| No automated Send action exists | Met: tests prove the picker never sends; M9 never sends |
| Synthetic-fixture tests pass | Met |
| Live manual selector acceptance passes | Partial: inbox, conversation and profile pass; search, events and the ClubMail composer are unverified (F1) |
| Unsupported markup causes graceful degradation | Met: features stay off without a verified selector |
| Permissions match documentation | Met: permission check in lint |

M9 is judged separately, under its own matrix (items 43 to 54), which is now
ready to run by hand (ADR 0011).

### Follow-up work recorded during Milestone B

- Confirm what an unverified member shows (no shield, code `2`, or another
  code), so verification can fail as well as pass. Code `1` is mapped as
  verified; code `3` is the separate "personally known" signal.
- "Personally known" (code `3`) is available as the `requirePersonallyKnown`
  criterion. Offer it in the M4 rule builder, and use it in M6 trust and the
  PRD 7.4 triage exception for previously met senders.
- Observe more "Angemeldet seit" forms (days, weeks, years, singular) to
  confirm the parser, and whether JoyClub rounds the duration down.
- Done in Milestone C: the qualification badge on inbox rows and in the
  conversation header, and snapshot capture on the profile page.

- Add a member index for user tags and message observations, so per-member
  reads and the retention purge do not scan the account. This changes the
  database schema and belongs with M8.
- Add the user-facing toggle for message caching that PRD Section 19.5
  requires, before anything writes a message observation from a live page.
- Tune the spam thresholds against a real inbox and record the outcome, since
  build plan Section 30 keeps the acceptable false-positive threshold open.
- Make account creation atomic, so two concurrent creates cannot both pass the
  duplicate identifier check.
- Replace the user-declared account identifier with a verified one once F1 and
  F9 establish where the JoyClub account identity appears.

### Follow-up work recorded during Milestone C

- Add the existing-conversation exception (PRD Section 7.4) once the
  read-status icon's meaning is confirmed.
- Add rule presets (PRD Section 11.3) once thresholds for "Complete profiles
  only" and "High-trust members" are decided.
- Decide whether the inbox retries on its own after a failed background answer.
- Wire the spam detector to pages, so the "not template spam" condition and the
  trust score's spam point can become known.

### Owner requests (2026-09-24)

- Done: the contact rule autosaves on each change, with no Save button
  (`manual-acceptance.md`, items 56 to 58). Triggered by a lost rule: the
  owner expected a ticked box to be kept.
- Done: import of JSON exports (full and single-account), merged into what is
  stored by the owner-approved rules (ADR 0009), with a preview and a confirm
  step (`manual-acceptance.md`, items 59 to 62). PRD Section 13.3 names export
  only; this extends M8. Live acceptance passed on 2026-09-24 (items 59 to 62).

- Done: the JoyFox panel, note editor and Ignore and Delete panel share one
  full-width strip under the header row, with details on demand, and all
  injected UI takes its colors from the page (ADR 0010,
  `manual-acceptance.md` items 63 to 67). Triggered by the owner's screenshot
  of narrow white columns in the dark ClubMail header. Live acceptance passed
  on 2026-09-24 (items 63 to 67).
- Done: inbox views hide each row's wrappers too, so the rows of a view sit
  together at the top with no gaps (`manual-acceptance.md` items 68 and 69).
  Triggered by the owner's screenshot of gaps in the "Needs Review" view.
  Live acceptance passed on 2026-09-24.
- Done: the options page shows one section per tab, and the data table's
  Actions column, the rule condition columns and dark mode are fixed
  (`manual-acceptance.md` items 70 to 72). Triggered by the owner's report of
  a misaligned table and too much scrolling. Live acceptance passed on
  2026-09-24.
- Done: Import (text, file chooser, preview and confirm) moved to the Accounts
  tab, under the account list; the data panel still runs it
  (`manual-acceptance.md` items 73 and 74). Live acceptance passed on
  2026-09-24.
- Done: choosing a file imports it at once, with no "Confirm import" step; a
  table then shows what changed (`manual-acceptance.md` items 83 to 85).
  Triggered by the owner: the confirm button needed extra scrolling and a
  second click. Live acceptance not yet run.

### Owner requests (2026-09-25)

- German and English UI with a toggle in the options header, live switching in
  open tabs, and German as the default when Firefox runs in German. Build after
  the M9 manual matrix (items 43 to 54) passes. Spec: `docs/i18n-spec.md`.
  Triggered by the owner: most JoyClub members are native German speakers.

### Follow-up work recorded during Milestone D

- Capture evidence for the event ClubMail composer (`manual-verification-needed.md`
  item 6), then add it as a second picker context.
- The member index for user tags and message observations (recorded during
  Milestone B for M8) is deferred: no M8 acceptance criterion needs it, and it
  needs a database version change best made with its first real caller.
- Done (commit 7caf140): the double-click guard (`src/options/confirm.ts`) on
  the Accounts panel's "Remove".
- Add a failure-injection test that an account-wide delete rolls back.
- Template variables, once plain insertion is accepted live (build plan
  Section 17).

### Follow-up work recorded during the M5 editor

- Show notes and tags on the inbox, search and event surfaces (build plan
  Section 12, "reusable later"), once search and events are verified.
- Decide whether to isolate the note editor from JoyClub's scripts, for example
  in a closed shadow root. It would not stop a page script that records
  keystrokes, so it needs a design decision first.

### Follow-up work recorded during the M9 core

- Done (ADR 0011): the live `QuickActionDriver`, the `storage.session`
  hand-off and the resume on the profile page. Next: run the manual matrix
  (items 43 to 54).
- M9 review follow-ups (ADR 0011, "Deferred from the review"): report an
  already ignored member as such; match the deleted conversation's own row, if
  inbox rows carry its link; drop the marker when the navigation is cancelled;
  check the sender page in `action.ignoreDelete.handOff` too.
- The PRD's settings toggle for the guided alternative (navigate and stage, the
  user clicks).
- Confirm or tune the step timeout (15 seconds) and the interrupted threshold
  (2 minutes) against the live site.

M9 is the largest and riskiest MVP task, both in size and in its need to resume across a page navigation, since F7 answered the in-page-versus-navigation question with navigation (Path B). If F1 through F7 push MVP's timeline out meaningfully, M9 is the one task worth reconsidering for a fast-follow release rather than the rest of MVP slipping with it. That is a scope call, not a technical one, and stays with the person running this project.

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
