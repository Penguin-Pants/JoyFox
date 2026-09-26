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
| F8 | Blocked | Research draft in `docs/distribution.md` (2026-09-25), from search summaries only: the environment could not reach the Mozilla pages. Still needed: the owner's channel choice and extension ID, and the draft's verification checklist. Found: the manifest's extension ID is a placeholder, and `data_collection_permissions` is missing, which AMO now requires for signing. |
| M1 | Partial | Engine, fact merge and extraction are complete. Milestone C added the page badge, the explanation panel and profile snapshot capture. The 95 percent manual trial over 50 messages remains. |
| M2 | Partial | Tab bar, per-row badges, in-place filtering, per-sender manual placement and dynamic rows are complete and tested (`milestone-c-audit.md`). A manual Qualified placement is the PRD 7.4 trusted exception (ADR 0015). Live acceptance passed on 2026-09-23, including the split-view re-check. The existing-conversation exception is blocked on reply detection. |
| M4 | Partial | One global rule in the V1-compatible schema, a pure evaluator with explicit unknown handling, and the two-box options builder are complete and tested. The advanced editor (rule groups with AND/OR and "not", ADR 0012) is built and tested; its live acceptance (items 75 to 80) passed on 2026-09-25. The "First message contains" condition (ADR 0013) is built and tested; its live acceptance (items 86 to 90) is pending. Presets are deferred. Live acceptance of the two-box builder passed on 2026-09-23. |
| M6 | Partial | Point-count trust score with a full explanation, outcome logging and undo on conversation and profile pages are complete and tested. Live acceptance passed on 2026-09-23. The spam point stays unknown until M3 reads messages from a page (blocked on the message-bubble evidence). |
| M3 | Partial | Normalization, the pluggable similarity engine, duplicate and known-phrase matching, explanations, and the persisted per-sender override are complete. Nothing reads a message from a page yet, which waits on F1. |
| M5 | Partial | Notes and tags persist, keyed to account plus a verified member ID. The note and tag editor is complete and tested on the profile and conversation pages, including the acceptance "survives a restart and a markup change that keeps the same profile ID" (`milestone-b-audit.md`, M5 editor). Live acceptance (`manual-acceptance.md`, items 36 to 42) is pending. Inbox, search and event surfaces are "later" in build plan Section 12. |
| M7 | Partial | Explicit active account, account-scoped repositories, options switcher, and the Section 14 isolation test. Automatic account detection waits on F1 and F9. |
| M8 | Done | Account selector, counts, per-entity inspection, delete record, data type, account data and everything, account and full JSON export with the schema version. Export completeness is tested item by item against every entity (`milestone-d-audit.md`). Live acceptance passed on 2026-09-23 (`manual-acceptance.md`, items 27 to 30 and 35). |
| M10 | Partial | Create, edit, delete, folders and exact insertion at the cursor are complete, tested and accepted live on the standard composer (items 31 to 34, 2026-09-23). The picker is on by default (ADR 0007). The event ClubMail composer is unverified, so "every compose context" stays open. |
| M9 | Partial | Live driver built (ADR 0011, owner choice "conversation first", 2026-09-24): Delete through the conversation's three-dot menu, a tab-bound hand-off in `storage.session`, then Ignore on the profile page. Off by default. Item 43 (both steps succeed) passed live on 2026-09-24. Items 44 to 54 were accepted on 2026-09-25: 48, 49 and 51 to 54 passed live; 44, 45, 47 and 50 cannot be caused by hand and are covered by synthetic tests; 46 ends in the correct state but does not say the member was already ignored; the owner keeps it as is. The guided mode is dropped (ADR 0015). Review follow-ups built on 2026-09-25 (ADR 0011): the hand-off is refused from any page but the run's conversation, and a cancelled move to the profile withdraws the marker. Items 98 and 100 were accepted on 2026-09-25 as not reproducible by hand (synthetic tests cover them); item 99, a normal run, is pending. |

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

M9 is judged separately, under its own matrix (items 43 to 54), which was
accepted by hand on 2026-09-25 (ADR 0011, `manual-acceptance.md`).

### Follow-up work recorded during Milestone B

- Confirm what an unverified member shows (no shield, code `2`, or another
  code), so verification can fail as well as pass. Code `1` is mapped as
  verified; code `3` is the separate "personally known" signal.
- "Personally known" (code `3`) is available as the `requirePersonallyKnown`
  criterion. Offer it in the M4 rule builder, and use it in M6 trust and the
  PRD 7.4 triage exception for previously met senders. Done: it is the
  "Personally known" rule condition and a trust point (ADR 0015).
- Observe more "Angemeldet seit" forms (days, weeks, years, singular) to
  confirm the parser, and whether JoyClub rounds the duration down.
- Done in Milestone C: the qualification badge on inbox rows and in the
  conversation header, and snapshot capture on the profile page.

- Add a member index for user tags and message observations, so per-member
  reads and the retention purge do not scan the account. This changes the
  database schema and belongs with M8.
- Add the user-facing toggle for message caching that ADR 0004 requires,
  before anything writes a message observation from a live page.
  Deferred by the owner (2026-09-25, ADR 0015): built with the first feature
  that stores message text.
- Tune the spam thresholds against a real inbox and record the outcome, since
  build plan Section 30 keeps the acceptable false-positive threshold open.
- Done (2026-09-25): account creation is atomic. The duplicate check and the
  write share one IndexedDB transaction, so two creates at once cannot both
  register an identifier (`milestone-b-audit.md`, hardening).
- Replace the user-declared account identifier with a verified one once F1 and
  F9 establish where the JoyClub account identity appears.

### Follow-up work recorded during Milestone C

- Add the existing-conversation exception (PRD Section 7.4) once the
  read-status icon's meaning is confirmed.
- Add rule presets (PRD Section 11.3) once thresholds for "Complete profiles
  only" and "High-trust members" are decided. Now V1-11 (D8).
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
  second click. Live acceptance passed on 2026-09-25.

### Owner requests (2026-09-25)

- German and English UI with a toggle in the options header, live switching in
  open tabs, and German as the default when Firefox runs in German. Build after
  the M9 manual matrix (items 43 to 54) passes; it was accepted on 2026-09-25,
  so this can start. Spec: `docs/i18n-spec.md`.
  Triggered by the owner: most JoyClub members are native German speakers.

### Follow-up work recorded during Milestone D

- Capture evidence for the event ClubMail composer (`manual-verification-needed.md`
  item 6), then add it as a second picker context.
- The member index for user tags and message observations (recorded during
  Milestone B for M8) is deferred: no M8 acceptance criterion needs it, and it
  needs a database version change best made with its first real caller.
- Done (commit 7caf140): the double-click guard (`src/options/confirm.ts`) on
  the Accounts panel's "Remove".
- Done (2026-09-25): failure-injection tests for account-wide deletes. They
  found a real gap: a store that threw between requests left the deletes
  already queued for other stores to commit. Every multi-step write now aborts
  its transaction on a throw (`commitAll`, `milestone-d-audit.md`, hardening).
- Template variables, once plain insertion is accepted live (build plan
  Section 17).

### Follow-up work recorded during the M5 editor

- Show notes and tags on the inbox, search and event surfaces (build plan
  Section 12, "reusable later"), once search and events are verified. Now
  V1-10.
- Decide whether to isolate the note editor from JoyClub's scripts, for example
  in a closed shadow root. It would not stop a page script that records
  keystrokes, so it needs a design decision first.

### Follow-up work recorded during the M9 core

- Done (ADR 0011): the live `QuickActionDriver`, the `storage.session`
  hand-off and the resume on the profile page. The manual matrix (items 43 to
  54) was accepted on 2026-09-25.
- M9 review follow-ups (ADR 0011, "Deferred from the review"):
  - Done (2026-09-25): check the sender page in `action.ignoreDelete.handOff`
    too.
  - Done (2026-09-25): drop the marker when the navigation is cancelled. The
    conversation page withdraws it when it is still there 15 seconds after the
    hand-off. Item 98 accepted as not reproducible by hand; synthetic tests
    cover it.
  - Blocked: match the deleted conversation's own row. `01-inbox.md` shows no
    conversation link or ID on an inbox row. Needs that evidence first.
  - Done (2026-09-25): a cancel followed by another page within the
    15-second wait no longer leaves the marker. Every JoyClub page that loads
    in the tab drops a marker meant for another page and closes its run (ADR
    0011, "Stale hand-off on page load"). Item 100 accepted as not
    reproducible by hand; synthetic tests cover it.
- Dropped (owner, 2026-09-25, ADR 0015): the PRD's settings toggle for the
  guided alternative (navigate and stage, the user clicks).
- Done (2026-09-25): a start stored after its tab stopped waiting no longer
  reads as running for 2 minutes. The background refuses a start past the
  tab's deadline, and a run still at `Started` reads as interrupted after 30
  seconds (`milestone-e-audit.md`, "Late start").
- Confirm or tune the step timeout (15 seconds) and the interrupted thresholds
  (2 minutes; 30 seconds at `Started`) against the live site.

M9 is the largest and riskiest MVP task, both in size and in its need to resume across a page navigation, since F7 answered the in-page-versus-navigation question with navigation (Path B). If F1 through F7 push MVP's timeline out meaningfully, M9 is the one task worth reconsidering for a fast-follow release rather than the rest of MVP slipping with it. That is a scope call, not a technical one, and stays with the person running this project.

## V1 Phase

Broken into tasks on 2026-09-25, now that the MVP is close to done. The scope is
PRD Section 20, "V1". The PRD's "Later" list (AMO submission, AI-assisted
classification, weekly digest, context-menu actions, the incognito-off reminder,
the local spend tracker) and its "Experimental" list (a Chromium build) are not
V1.

An acceptance criterion marked **proposed** is not in the PRD. It needs the
owner's approval before the task starts. The others quote the PRD.

| ID | Task | Depends on | Acceptance criteria | Size |
| --- | --- | --- | --- | --- |
| V1-1 | Per-audience contact rules: one rule set per sender profile type (PRD 6.1, 11.4). First step: store the sender's profile type as a fact | M4's rule engine and builder (built; M4's open items are not needed: presets are V1-11, and the live checks stay under M4); D1 | A sender who fails the applicable rule set is quarantined by default; the user can always see which rule failed (PRD 6.1). Users can define a separate rule set per sender profile type (single man, single woman, couple), applied automatically based on the sender's own visible profile type (PRD 11.4). **Proposed:** with a different rule set for every audience D1 confirms (single man and single woman, plus couple and any other couple compositions if D1 says so), a sender of each type is placed by the rule for their own type; a sender whose profile type is unknown follows the rule's unknown handling, never another audience's rule. | M |
| V1-2 | Compatibility Overlay: highlight the viewed profile's preferences that match the user's own on the profile page (PRD 6.2), a compatibility badge on every surface where a profile card shows (search results, the inbox, event attendee lists; PRD 8.3) and a sort-by-compatibility toggle on search results (PRD 10.1) | E1; E3; E4 (attendee lists); D5 | Every tag marked as matching is independently verifiable by reading both checklists manually (PRD 6.2). **Proposed:** for two profiles that share preferences, every shared preference is highlighted and no other; two loaded results with different overlaps show different results and sort in overlap order; each profile card on search results, the inbox and event attendee lists shows the same compatibility result as that member's profile page (PRD 8.3), and the sort orders the loaded search results by it. | M |
| V1-3 | Saved Searches: store a search's URL and filter state, replay it in one click (PRD 6.2, 8.2) | E1 | **Proposed:** a saved search opens the same URL with the same filters. If JoyClub's search address no longer matches, JoyFox says so and opens nothing. | S |
| V1-4 | Conversation History Search: full-text search over the user's own cached messages (PRD 6.2, 13.3) | E2; the message-caching toggle (ADR 0004, deferred to this caller by ADR 0015) | Cached message text is on by default, has a configurable auto-purge window, default 12 months, and is always manually deletable (PRD 13.3). **Proposed:** with caching on, every message shown in an opened conversation is cached; then every cached message that contains the query is found, and no cached message without it is shown; with caching off, nothing is stored. | M |
| V1-5 | Personal Event Tracker: private notes, attendance and tags on event and venue listings, and a personal calendar of tracked events (PRD 6.3, 9.1, 9.2) | E4; D6 | Event notes persist after the listing is removed from JoyClub's own calendar post-event (PRD 6.3). **Proposed:** notes, attendance and tags save and show again on event and venue listings; a filter by the user's own tags or notes shows only the matching events in JoyClub's already-loaded event list, with no new request to JoyClub (PRD 9.1, 10.1); the personal calendar lists every tracked event and filters the same way (PRD 9.1). | M |
| V1-6 | Self-hosted sync: encrypted client-side (ADR 0002) to the user's own endpoint (PRD 13.4, 14.2, 15) | F4 (done); D2 | No network request goes anywhere but joyclub.de or joyce.app until the user has explicitly completed sync setup (PRD 21.1). The encrypted payload is pushed only with an explicit on-screen confirmation; nothing syncs silently (PRD 10.2). The key is derived from a user-held passphrase before anything leaves the device (PRD 13.4); neither the passphrase nor the derived key is stored (ADR 0002). Host access covers only the configured endpoint, is requested at runtime as an optional permission once the user configures sync, and is never in the static manifest; no `<all_urls>` or broad host wildcard (PRD 15, 15.1). When sync is enabled, every other entity also exists, encrypted, on the endpoint (PRD 12.3). **Proposed:** the endpoint receives only ciphertext, and a second browser restores the same data from it with the same passphrase, verified item by item against every entity except `SyncConfig` (as the M8 export test does); a restore with a wrong passphrase fails and changes no data; neither the passphrase nor the derived key appears in storage or in any upload. | L |
| V1-7 | Data-inspector polish (PRD 13.5, 20) | M8 (done) | **Proposed:** each record shows as readable fields, not raw JSON only; a full export stays complete against every entity, verified item by item (PRD 21.4). | S |
| V1-8 | Repository cleanup and documentation (PRD 20) | None; it can run beside the MVP gate items | **Proposed:** cleanup: no placeholder values (such as the extension ID `joyfox@example.invalid`), no unused source files or fixtures, and no debug output outside the diagnostics flag remain, and every check passes; docs: every document in build plan Section 33 is current, and the README states how to build, install and verify a release; a license file exists (D3). | S |
| V1-10 | Cross-surface profile signals: the completeness badge, trust score, note icon and profile tags on every surface where a profile card shows (search results, the inbox, event attendee lists; PRD 8.3, 8.4), notes and tags editable inline there (PRD 6.2, 9.3), and a filter that hides incomplete profiles in the loaded search results (PRD 8.1). V1-2 covers the compatibility overlay | E1; E4 (attendee lists); D8 (what counts as incomplete) | The signals render the same way on every surface where a profile card shows up (PRD 8.3). A note or tag attached to a profile ID follows that profile everywhere, not just where it was created (PRD 8.4). The note icon is editable inline wherever it appears (PRD 6.2). **Proposed:** for one member, each signal on a search-result card, an inbox row and an attendee-list entry matches the same signal on that member's profile page; a tag added from a search result shows on that member's attendee-list entry; a tag and a note, each created and then edited from an attendee-list entry, save to that member's profile ID and show on the profile page; for a member whose photo count, word count and verification are known, the completeness badge shows those values (PRD 6.2); with one loaded result below the D8 completeness level and one at or above it, the badge marks only the first as incomplete, and the incomplete-profile filter hides only that one, with no new request to JoyClub. | M |
| V1-11 | Rule presets: Open, Complete profiles only, Verified members, High-trust members and Custom (PRD 11.3) | M4's rule builder (built); D8 | The presets mirror the standalone spec's presets (PRD 11.3). **Proposed:** each preset fills the builder with the conditions PRD 11.3 names, using the D8 thresholds; the user can then edit the result like any other rule; Custom opens the builder with no conditions set. | S |
| V1-12 | Configurable `ProfileSnapshot` retention (PRD 13.3). Today `PROFILE_SNAPSHOT_RETENTION` in `src/storage/repositories.ts` keeps the newest 20 per member, with no setting | None | The default keeps the latest snapshot plus a short history window, configurable, to bound how much sensitive data sits at rest (PRD 13.3). **Proposed:** a setting controls how many snapshots are kept per member, default 20 (the current value); after the user lowers it, each member keeps only that many of the newest snapshots, including the ones already stored; the latest snapshot is always kept. | S |
| V1-13 | Shared-event exception: store the attendees that a tracked event's page shows, and a configurable triage exception for senders who share a tracked event with the user (PRD 7.4, 9.3). `EventMetadata` has no attendee field yet (`src/domain/types.ts`). "Previously met" is already the "Personally known" rule condition (ADR 0015) | V1-5; E4 | The extension reads and locally caches whatever attendee information JoyClub's own event page already renders to the logged-in viewer (PRD 9.3). A shared event co-attendee gets a configurable, but not automatic, exception; every exception is per-sender and reversible (PRD 7.4). **Proposed:** opening a tracked event's page stores the shown attendees' profile IDs with that event, and that member's profile page lists the event; the exception is off by default; with it on, a sender who appears on a tracked event that the user marked as attending is placed Qualified, the "Why" panel names the event, and the user can undo it for that sender. | M |
| V1-9 | Self-distributed public release on GitHub (PRD 18.2, 20) | V1-1 to V1-8 and V1-10 to V1-13; the personal dogfooding period after MVP feature-complete (PRD 24.7: "MVP feature-complete → personal dogfooding period → V1 feature-complete → self-distributed public release"; D7); MVP release gate (build plan Section 28); F8; D3; D4 | **Proposed:** the GitHub repository and its release are public and hold the source under the chosen license (D3); the signed build attached to the release installs on release Firefox and passes the MVP release gate; building the release tag's public source with the documented command gives files identical to the ones in the signed `.xpi`, apart from the signature files (reproducible builds, PRD 13.2). | M |

### Blocked on site evidence

- **E1:** the search page and one result (`manual-verification-needed.md`,
  item 4). Blocks V1-3 and the search parts of V1-2 and V1-10.
- **E2:** message text on the conversation page and whether a message has a
  stable identifier (item 2). Blocks V1-4, and M3 on pages.
- **E3:** the profile's preference checklist on another member's profile and on
  the user's own profile. No evidence file covers it yet. Blocks V1-2.
- **E4:** the event, calendar and venue pages (item 5 covers events and the
  calendar; no item covers venue pages yet). Blocks V1-5, V1-13 and the
  attendee-list parts of V1-2 and V1-10.

### Owner decisions needed

- **D1:** does the per-audience builder need a distinct "couple" audience? PRD
  11.4 lists couple as a profile type, but Section 23 leaves it open ("likely
  yes, needs confirming before V1"). V1-1's criterion follows the answer.
  Codes `1`, `2` and `3` are confirmed (`08-attribute-matrix.md`); whether other
  couple compositions use other codes is not known.
- **D2:** the sync protocol: a simple REST endpoint, WebDAV, or something like
  remoteStorage (PRD Section 23). The encryption is decided (ADR 0002).
- **D3:** the open-source license and the repository name for the public
  release. The repository has no license file.
- **D4:** the formal ToS review of JoyClub's terms and the GDPR
  household-exemption consult, both recommended before any public release (PRD
  Section 23).
- **D5:** which preference fields the overlay compares, and whether it shows a
  count or only highlights.
- **D6:** the attendance values. `EventMetadata` already defines `attendance`
  as interested, attending, not attending or unknown (`src/domain/types.ts`);
  confirm them before the tracker uses them.
- **D7:** the length of the personal dogfooding period. PRD 24.7 names the
  period but gives no length. It starts once the MVP is feature-complete.
- **D8:** the thresholds for the "Complete profiles only" preset (completeness
  level and photo count) and the "High-trust members" preset (completeness,
  account age and minimum trust score; PRD 11.3). V1-10's incomplete-profile
  filter uses the same completeness level.
- The proposed acceptance criteria above.

### Order

A task with **proposed** criteria starts only after the owner approves them (see
"Owner decisions needed"); each step below assumes that approval.

1. Ready once its decision is made: V1-1 (D1), V1-6 (D2), V1-11 (D8). V1-1
   starts by storing profile type as a fact: `ProfileSnapshot` has no field
   for it yet, and `profileTypeFromCode` (`src/extraction/joyclub.ts`) has no
   caller.
2. Ready once their proposed criteria are approved: V1-7, V1-8 and V1-12.
3. Blocked on evidence, decisions or other tasks: V1-3 (E1), V1-4 (E2), V1-2 (E1, E3, E4,
   D5), V1-5 (E4, D6), V1-10 (E1, E4, D8), V1-13 (V1-5, E4).
4. Last: V1-9, after V1-1 to V1-8 and V1-10 to V1-13, the personal dogfooding
   period (D7), the MVP release gate, F8, D3 and D4.
