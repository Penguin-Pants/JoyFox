# JoyFox 1.0.0 UX audit

Date: 2026-09-28. Audited at `0dd21ab` (JoyFox 1.0.0). The audit itself changed
nothing; the approved fixes followed in the same pull request (see
"Implementation status" at the end). Screenshots named below (for example
`inbox-norule.png`) were taken in the audit session and are not committed.

## How the audit was done

- **Documents:** README, PRD, known limitations, ADR 0006, 0010, 0011, 0016,
  manual acceptance, manifest.
- **Code:** all of `src/options`, `src/content`, `src/background`, the
  quick-action modules, `content.css`, `options.css` and both string catalogs.
- **Tests:** 65 files, 895 tests, all pass on this commit.
- **Rendered UI:** the built bundles ran in Chromium with a `browser` API shim.
  - The options page ran in every tab, with no data and with data, in light and
    dark themes and in English and German.
  - The inbox, conversation and profile pages ran as synthetic JoyClub pages
    built from the test fixtures, with the real content and background scripts.
- **Firefox facts:** checked against Mozilla documentation. Direct fetches of
  Mozilla sites are blocked in this environment, so these checks used search
  excerpts; the sources are listed at the end.
- **Limits:** there was no live JoyClub session and no real Firefox. Findings
  that depend on JoyClub's real CSS, or on Firefox-only behavior, are marked
  "needs validation".

## UX baseline

| Item                                   | Baseline                                                                                                                                                                                                                                                                             |
| -------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Primary user                           | One JoyClub member (the owner) on desktop Firefox; couples with two logins; future public users                                                                                                                                                                                      |
| Main problem                           | Too many low-quality first messages, and no private memory of other members                                                                                                                                                                                                          |
| Core journeys                          | J1 triage the inbox · J2 notes and tags on members · J3 saved searches · J4 event notes · J5 templates · J6 Quick Ignore and Delete (off by default)                                                                                                                                 |
| Frequency                              | Daily: J1, J2, J5. Weekly: J3, J4. Rare: rule setup, account switch, export and import                                                                                                                                                                                               |
| After install                          | The options page opens once on "Get started": 1) add an account, 2) save a contact rule, 3) open the inbox                                                                                                                                                                           |
| Toolbar                                | None. There is no `action`, so the options page is reachable only through `about:addons` or the Extensions panel menu                                                                                                                                                                |
| Popup, sidebar, context menu, shortcut | None                                                                                                                                                                                                                                                                                 |
| Options page                           | Language, Get started, Accounts (+ Import), Contact rule (+ Ignore and Delete switch), Templates, Events calendar, Messages search, Your data                                                                                                                                        |
| Page content                           | Inbox triage bar and badges; member strip on conversation and profile (placement, Why and move, trust log, notes, compatibility); card chips on inbox, search and guest lists; saved-searches bar; event and venue box; event-list filter; template picker; Ignore and Delete button |
| Background                             | Event page: message router, IndexedDB, account lock, M9 hand-off in `storage.session`                                                                                                                                                                                                |
| Permissions                            | `storage`; hosts `*://*.joyclub.de/*`, `*://*.joyce.app/*` (JOYCE is inactive)                                                                                                                                                                                                       |
| External services                      | None. JoyFox reads the DOM only; it writes to JoyClub only for M9 and when it clicks "Anwenden" to replay a saved search                                                                                                                                                             |
| Local data                             | IndexedDB (per account) and `storage.local` (settings, revision markers)                                                                                                                                                                                                             |
| Outputs                                | JSON export (`<a download>`)                                                                                                                                                                                                                                                         |
| Constraints                            | DOM-only; no remote addresses in the code; the account is declared by the user; the 18 px card line                                                                                                                                                                                  |

## Summary

- **Release blockers:** none. A user who follows "Get started" can complete
  every core journey.
- **Surviving findings:** 27 confirmed issues (16 should fix before release, 11
  can fix after release), 19 possible risks and 26 deferred improvements.
- **Removed in Pass 2:** 16 findings.

---

## Phase 3: findings by category

Each finding gives: **severity · category · location**, then current behavior,
user impact, evidence, journey, confidence, scope and recommended change. The
`U` numbers are stable IDs.

### 1. Installation and first use

**U1. JoyClub pages do not show when setup is incomplete**

- **Should fix before release · First use · Location:**
  - `src/content/inbox-triage.ts:395-398`
  - `src/content/member-panel.ts:316-319`
  - `src/content/member-notes.ts:281-283`
  - `src/content/quick-action.ts:590-593`
- **Current behavior:**
  - With no account, JoyClub pages show no JoyFox UI at all.
  - With an account but no rule, the inbox shows card chips and no tab bar, with
    no message.
  - Only the conversation and profile panel say "No contact rule is set…" and
    offer "Open JoyFox options".
- **Impact:**
  - A user who closed the options tab after install, or who skipped step 2,
    cannot tell "not set up" from "broken".
  - Get started step 3 promises "JoyFox adds its tabs above the list".
- **Evidence:**
  - Screenshots `inbox-noaccount.png` and `inbox-norule.png`.
  - The test `triage-ui.test.ts:340-360` asserts the silence.
  - ADR 0006 requires silence only when the rule is off or the background fails.
- **Journey:** first use, J1. **Confidence:** High. **Scope:** Small.
- **Change:** for `no-account` and `no-rule` only, show one line with the
  existing "Open JoyFox options" button: in the member panel and in place of the
  inbox tab bar. Keep "rule turned off" and failures silent, as ADR 0006 says.

**U2. The "JoyClub account identifier" field is not explained**

- **Should fix before release · First use · Location:**
  `src/options/account-panel.ts:246-257`; `accounts.identifier` (en.ts:702,
  de.ts:652).
- **Current behavior:** a bare text field. The user cannot tell whether to enter
  a nickname, a member number or an email. After the account is added, the list
  shows only the label, not the identifier.
- **Impact:**
  - This is the first input a new user meets.
  - The identifier is the merge key for import, so different spellings in two
    browsers do not merge.
  - The identifier cannot be edited; fixing a typo means removing the account
    and all of its data.
- **Evidence:** screenshot `empty-light-accounts.png`; `data.import.hint`
  (en.ts:983).
- **Journey:** first use. **Confidence:** High. **Scope:** Small (copy).
- **Change:** add a hint under the field: "Your JoyClub nickname works well.
  JoyFox uses it only to tell your accounts apart and to match imports. It is
  not checked."

**U3. Get started reports "set up" when access to joyclub.de is missing** (needs
validation)

- **Possible risk · First use and permissions · Location:** no
  `permissions.contains`, `request`, `onAdded` or `onRemoved` in `src/`;
  `get-started.ts:31-35`.
- **Current behavior:**
  - Firefox shows MV3 host permissions at install from Firefox 127. The user can
    revoke them in `about:addons` or the Extensions panel.
  - On Firefox 121 to 126 (allowed by `strict_min_version`), they are not
    granted at install.
  - If access is missing, the content script does not run, and Get started still
    says "JoyFox is set up".
- **Impact:** a total, silent failure of every page feature, with a false "set
  up" message.
- **Evidence:** grep; MDN `host_permissions` ("should check whether any required
  host permissions are available and request them").
- **Journey:** first use, all. **Confidence:** High that the check is absent;
  Medium on how often access is missing. **Scope:** Small to medium.
- **Change:**
  - In Get started, check `permissions.contains` for the JoyClub origin.
  - If access is missing, show a step "Allow JoyFox on joyclub.de" with a button
    that calls `permissions.request`.
  - No new permission is needed.
  - Optionally, raise `strict_min_version` to 127.

**U4. Get started goes blank when storage cannot be read**

- **Deferred · First use · Location:** `get-started.ts:52-56`;
  `options/index.ts:41-43` swallows the error.
- **Impact:** the first screen is empty in this rare case. **Confidence:** High
  on the code, Low on how often it happens. **Scope:** Small.
- **Change:** show a read-failed line.

**U5. Get started step 1 says "Add your account" when accounts exist but none is
active**

- **Deferred · First use · Location:** `get-started.ts:31`.
- **Impact:** wrong instruction after the active account is removed.
  **Confidence:** High. **Scope:** Small.

### 2. Core user journey

**J1 rule setup (Get started step 2)** takes 3 to 6 interactions with a preset,
or about 2 per condition in the Simple editor. The friction is U6 to U10.

**U6. Ticking a number condition in the Simple editor shows an error at once**

- **Should fix before release · Rule setup · Location:** `rule-panel.ts:1005`
  (the field is drawn empty), `521-534` (the tick autosaves) and `1099-1113`
  (the empty value fails).
- **Current behavior:** ticking "Minimum photos" raises the alert "Enter a whole
  number from 0 to 100,000 for "Minimum photos". The rule was not saved."
- **Impact:** almost every user who sets a threshold meets an error for doing
  the expected thing. Screen readers announce it as an alert.
- **Evidence:** verified in Chromium (`verify1.mjs`). The Advanced editor avoids
  this on purpose (`rule-panel.ts:238-243, 820-825`; test
  `options-rule-panel.test.ts:623-645`). The Simple tests set `.checked` without
  a `change` event.
- **Journey:** J1 setup. **Confidence:** High. **Scope:** Small.
- **Change:** when a number or text condition is ticked while its field is
  empty, move focus to the field and do not save or show an error. Save when a
  valid value is entered.

**U7. The rule's save and error messages appear below the whole form, and an
invalid field is not marked**

- **Should fix before release · Feedback · Location:** `rule-panel.ts:451` (the
  status is appended after the form); no `aria-invalid` anywhere.
- **Current behavior:**
  - The status line is about 1,200 px below the controls at the top of the form.
  - A field with a bad value (for example `-5`) shows no mark, and the top note
    still says "A rule is saved".
  - The autosave explanation is the last of four hints.
- **Impact:** a sighted user does not see "Rule saved", or that the rule was not
  saved, and can keep editing a rule that no longer saves.
- **Evidence:** screenshots `rule-invalid.png` and `rule-invalid-ticked.png`;
  `role=alert` fires out of view.
- **Journey:** J1 setup and edit. **Confidence:** High. **Scope:** Small to
  medium.
- **Change:**
  - Show the status next to the rule note at the top of the form.
  - Set `aria-invalid` on the bad field and show a short inline error beside it.
  - Move the autosave hint to the top.

**U8. A rule with no conditions is saved as "Rule saved", and Get started says
"set up"**

- **Should fix before release · Rule setup · Location:**
  - `rule-panel.ts:1063-1070`: the Simple path has no "no conditions" notice.
  - `rule-panel.ts:996-1043`: the controls of unticked rows stay enabled.
  - `get-started.ts:31-35`.
- **Current behavior:** changing the placement, or typing a number into an
  unticked row, saves `{enabled, no conditions}` (every sender qualifies) with
  "Rule saved".
- **Impact:** the user believes the inbox is filtered when it is not.
- **Evidence:** verified. Typing `3` in unticked "Minimum photos" gave "A rule
  is saved for the active account." The Advanced editor warns with
  `rule.savedNoConditions`.
- **Journey:** J1 setup. **Confidence:** High. **Scope:** Small.
- **Change:**
  - Show `rule.savedNoConditions` in the Simple path when both boxes are empty.
  - Disable the number, text and "If JoyFox cannot see this" controls of
    unticked rows.

**U9. "Not flagged as template spam" can never be met**

- **Should fix before release · Rule setup · Location:** `rule.spamHint`
  (en.ts:722), shown below the editor.
- **Current behavior:** the condition is offered like any other. Spam status is
  always unknown, so with the default "Send to Needs Review", ticking it sends
  every sender to Needs Review.
- **Impact:** the whole inbox moves to Needs Review, and the reason is explained
  only below the form.
- **Evidence:** the code and the hint text.
- **Journey:** J1 setup. **Confidence:** High. **Scope:** Small.
- **Change:** add an inline note on the row: "(not checked yet: always
  unknown)".

**U10. The inbox "Why" panel opens at the top of the list and does not return to
the row**

- **Possible risk · Journey · Location:**
  `inbox-triage.ts:456-459, 498-502, 535-546`.
- **Impact:** for a row far down the list, the user loses their place after Move
  or Close. **Confidence:** High on the code, Medium on the impact. **Scope:**
  Small.
- **Change:** on Close, focus the badge of the same row and scroll it into view.

### 3. Entry points

**U11. There is no toolbar entry, and the page UI has no link to the options
page once JoyFox is set up**

- **Possible risk (owner decision) · Entry points · Location:** manifest (no
  `action`); the options buttons exist only in not-set-up states
  (`member-panel.ts:390-395`, `saved-searches.ts:381-390`,
  `listing-panel.ts:274-283`, `template-picker.ts:174-188`).
- **Current behavior:**
  - The options page is reachable only through `about:addons` or the Extensions
    panel's menu, where JoyFox shows greyed out.
  - It holds recurring tasks: switching accounts (JoyFox cannot follow the
    JoyClub login), message search, the events calendar and templates.
- **Impact:** recurring tasks take four or more steps through browser settings.
- **Evidence:** the manifest; Mozilla Support "Extensions button";
  `known-limitations.md:64-67`.
- **Journey:** all repeat use. **Confidence:** High on the behavior, Medium on
  the impact. **Scope:** Small.
- **Change (either or both):**
  - (a) An `action` with no popup whose click opens the options page. No new
    permission.
  - (b) An "Open JoyFox options" button in the inbox "?" text, under "Why and
    move", and at the bottom of the template list.

**U12. The same concepts have different names on different surfaces**

- **Deferred · Entry points · Location:**
  - The inbox badge says "Show why"; the strip says "Why and move" (en.ts:312,
    331).
  - Trust is "Local trust score: 2." in the strip but "Trust +2" on chips.
  - The German chips say "Vertrauen" where the glossary says "Vertrauenswert"
    (de.ts:492-495; `i18n-spec.md:325-341`).
- **Confidence:** High. **Scope:** Small.

**U13. The three note editors behave differently**

- **Deferred · Entry points · Location:** `member-notes.ts`,
  `card-note-editor.ts`, `listing-panel.ts`.
- **Current behavior:** the card editor has no Discard button and no privacy
  note, and it trims the note. The pronouns mix "Your" and "My".
- **Confidence:** High. **Scope:** Small.

### 4. Information architecture

**U14. Export is on "Your data" and Import is on "Accounts", with no pointer
between them**

- **Can fix after release · IA · Location:** `options/index.ts:50-60`;
  `data.hint` (en.ts:898).
- **Impact:** a user who exported from "Your data" looks for Import there.
  **Evidence:** the owner placed Import on Accounts (acceptance items 73 to 74).
  **Confidence:** High. **Scope:** Small.
- **Change:** one line in "Your data": "To import a file, go to Accounts." with
  a link.

**U15. The event box is always open, and the shared-preferences list is always
expanded**

- **Deferred · IA · Location:** `listing-panel.ts:132-141, 284-288`;
  `compatibility.ts:364-369`.
- **Impact:** permanent clutter on every event and profile page. **Confidence:**
  Medium. **Scope:** Small to medium.

**U16. On your own profile, the strip shows placement, trust logging and a note
editor about yourself**

- **Deferred · IA · Location:** `member-panel.ts:209-239`;
  `member-notes.ts:146-171`.
- **Confidence:** High. **Scope:** Small.

**U17. The card note editor can cover JoyClub's composer**

- **Possible risk · IA · Location:** `content.css:725-738` (fixed at the bottom
  right, very high `z-index`).
- **Confidence:** Medium. **Scope:** Small.

### 5. Controls and interaction

**U18. "Delete whole contact rule" deletes on one click**

- **Should fix before release · Destructive action · Location:**
  `rule-panel.ts:1227-1256`; test `options-rule-panel.test.ts:170-188`.
- **Current behavior:** one click deletes every condition (up to 10 Advanced
  groups) and turns sorting off. Every other delete in JoyFox needs two clicks
  (`confirm.ts`).
- **Impact:** the user loses a rule they built, with no way to recover it.
- **Evidence:** verified in Chromium.
- **Journey:** J1 edit. **Confidence:** High. **Scope:** Small.
- **Change:** use the existing arm-then-confirm pattern (`confirmAllowed`,
  `confirmTiming`).

**U19. The account removal prompt understates what gets deleted, and removing
the active account leaves none active without saying so**

- **Should fix before release · Destructive action · Location:**
  - `accounts.removePrompt` (en.ts:697, de.ts:647), `accounts.hint`,
    `accounts.empty`.
  - `account-service.ts:139-150`; `accounts.removed`.
- **Current behavior:**
  - The prompt says "also deletes its notes, tags and rules".
  - Removal also deletes templates, stored messages, event notes, snapshots and
    the action log (`repositories.ts:445-447`).
  - Afterwards, no account is active, and the status does not say so.
- **Impact:** unexpected data loss despite the confirmation. After removal,
  every page stops sorting with no explanation.
- **Evidence:** the code, and a jsdom run by the audit agent.
- **Journey:** account management. **Confidence:** High. **Scope:** Small
  (copy).
- **Change:**
  - "Removing {name} deletes everything JoyFox stored for it: notes, tags, rule,
    templates, messages and event notes."
  - After removal: "No account is active now. Choose one with "Use this
    account"."

**U20. Lowering "Keep messages for (months)" deletes messages at once, without
warning**

- **Should fix before release · Destructive setting · Location:**
  `messages-panel.ts:214-239`; `message-cache-service.ts:136-141`;
  `messages.onHint` (en.ts:474).
- **Current behavior:** Save with 1 deletes up to 11 months of stored messages.
  The snapshot setting next door warns about this (en.ts:953); this one does
  not.
- **Impact:** silent data loss. **Evidence:** the code and test
  `options-messages-panel.test.ts:122-140`. **Confidence:** High. **Scope:**
  Small (copy).
- **Change:** "Lowering the number deletes older messages at once. The default
  is 12."

**U21. Ignore and Delete is offered where it cannot work, and its failure text
does not say how to fix it**

- **Should fix before release · Controls · Location:** `quick-action.ts:409-434`
  (always drawn); `quick-action-driver.ts:83-87` (checked only after the click);
  `action.failure.unverifiable` (en.ts:191).
- **Current behavior:** without the ClubMail list beside the conversation (for
  example in a narrow window), the click ends with a seven-line report. The
  report says "Next: open the conversation", but the user is already on it.
- **Impact:** this is the most likely failure, and the user is not told "widen
  the window". **Evidence:** `known-limitations.md:137-139`; acceptance item 45.
  **Confidence:** High. **Scope:** Small.
- **Change:** when `canVerify("delete")` is false, show "Works only while the
  ClubMail list shows beside this conversation. Widen the window." Add the same
  line to the failure text.

**U22. A double click on a trust button logs two outcomes**

- **Can fix after release · Controls · Location:** `triage-ui.ts:418-441`;
  `member-panel.ts:344-351, 417-427`.
- **Impact:** a wrong trust score. Undo removes one outcome at a time.
  **Evidence:** in Chromium, each click changed the score by 1. **Confidence:**
  High. **Scope:** Small.
- **Change:** ignore trust clicks while one is saving.

**U23. Submitting "Add account" twice adds the account, then shows an error**

- **Can fix after release · Controls · Location:** `account-panel.ts:266-282`
  (no in-flight guard).
- **Current behavior:** the status ends as "That account identifier is already
  registered. Nothing was changed." in red.
- **Evidence:** a jsdom run. **Confidence:** High. **Scope:** Small.
- **Change:** copy the template panel's `#saving` guard.

**U24. The Ignore and Delete busy state is not visible**

- **Can fix after release · Controls · Location:** `quick-action.ts:617-619`
  (`aria-disabled`); `content.css:101-104` styles only `:disabled`.
- **Confidence:** High. **Scope:** Small (one CSS rule).

**U25. Other destructive rule edits act on one click**

- **Deferred · Controls · Location:** Advanced "Remove rule"
  (`rule-panel.ts:777-788`); the preset confirm has no grace period (`593-607`).
- **Confidence:** High. **Scope:** Small.

**U26. "Move to {current placement}" stays enabled when the rule chose that
placement**

- **Deferred · Controls · Location:** `triage-ui.ts:281-283`.
- **Confidence:** Medium. **Scope:** Small.

### 6. Feedback and system status

**U27. A saved search runs JoyClub's filter panel with no JoyFox message**

- **Can fix after release · Feedback · Location:**
  `saved-searches.ts:295-315, 405-433`.
- **Current behavior:** the page loads, JoyClub's filter opens, and "Anwenden"
  is clicked. No message says JoyFox is doing this, or which saved search is
  showing.
- **Impact:** automated clicks on JoyClub with no explanation reduce trust.
  **Confidence:** High. **Scope:** Small.
- **Change:** show "Running "{name}"…" and then "Showing "{name}"."; mark the
  current saved search.

**U28. The rule status stays after an account switch and contradicts the rule
note**

- **Can fix after release · Feedback · Location:** `rule-panel.ts:425`.
- **Current behavior:** the panel shows "No rule is saved…" together with "Rule
  saved."
- **Evidence:** a jsdom run. **Confidence:** High. **Scope:** Small.

**U29. Three options panels re-create their status element**

- **Can fix after release · Feedback · Location:**
  `quick-action-panel.ts:85-95`, `events-panel.ts:347-357`,
  `messages-panel.ts:143-153`.
- **Current behavior:** a save failure is styled and announced as info, and the
  Messages status never clears.
- **Confidence:** High for styling and staleness, Medium for announcement.
  **Scope:** Small.
- **Change:** use `StatusLine`.

**U30. Page status messages are probably not announced**

- **Possible risk (needs a screen-reader test) · Feedback and accessibility ·
  Location:**
  - The element is re-created with its text: `saved-searches.ts:395-402`,
    `listing-panel.ts:289-296`, `card-note-editor.ts:313-318`.
  - `:empty{display:none}`: `content.css:272-274, 500-502, 560-562, 745-747`.
- **Evidence:** the project fixed the same pattern in member notes (milestone B
  audit). **Confidence:** Medium. **Scope:** Small to medium.

**U31. Some failures give no feedback: the Events switch and the language picker
only revert**

- **Deferred · Feedback · Location:** `events-panel.ts:339-341`;
  `options/index.ts:120-123`.

**U32. The "Template inserted…" message stays after the message is sent**
(removed in Pass 2)

### 7. Errors and recovery

**U33. After one failed save, the member panel shows the error for every member
shown afterwards**

- **Can fix after release · Errors · Location:**
  `member-panel.ts:127, 400-403, 417-427`. `#error` is reset only by the next
  write, not by `leave` or a member change.
- **Impact:** a false "could not save" message on other members' panels.
  **Confidence:** High. **Scope:** Small.
- **Change:** store the member ID with the error.

**U34. The card editor's conflict message tells the user to "discard your
changes", but the card editor has no Discard button**

- **Deferred · Errors · Location:** `card-note-editor.ts:232-243`;
  `notes.conflict` (en.ts:345).
- **Confidence:** High. **Scope:** Small.

**U35. The "template too long" refusal gives no numbers and no next step**

- **Deferred · Errors · Location:** `template-picker.ts:218-223`;
  `picker.result.too-long`.

**U36. Some error texts give no next step**

- **Deferred · Errors · Location:**
  - `rule.readFailed`, `accounts.readFailed`, `templates.readFailed`,
    `data.readFailed` (no "Reload the page").
  - `common.saveFailed`.
  - Data-panel failures end "Nothing was deleted" even after an export
    (`data-panel.ts:882-896`).
  - Import errors use "schema version" and "scope" (en.ts:1063, 1092).

**U37. An interrupted Ignore and Delete run is recorded only as the raw
ActionLog**

- **Deferred · Recovery · Location:** `record-fields.ts:215-257`;
  `data-panel.ts:168-177`.
- **Impact:** after a closed tab, a slow profile move or a switch-off mid-run,
  the only record shows `DeleteConfirmed` and `handoff-failed`. **Confidence:**
  High. **Scope:** Small to medium.
- **Change:** show `reportOperation(log).lines` above the fields.

**U38. An extension update while JoyClub tabs are open is untested**

- **Possible risk · Recovery · Location:** no `runtime.onUpdateAvailable`; no
  cleanup of an old instance's UI (`content/index.ts`).
- **Impact:** an M9 run can die mid-way, and a stale profile notice can stay.
  **Confidence:** Medium. **Scope:** Small to medium.
- **Change:** a manual test first (reload in `about:debugging` with the inbox, a
  conversation and a profile open).

### 8. Permissions and trust

The code-level check that access is present is U3 (possible risk).

**U39. The manifest description promises JOYCE**

- **Should fix before release · Trust · Location:** `manifests/firefox.json:5`:
  "Local-first enhancements for pages you open on JoyClub and JOYCE."
- **Current behavior:** the install prompt and `about:addons` claim JOYCE
  support. The content script exits on JOYCE (`content/index.ts:54`), and the
  README says JOYCE is inactive.
- **Confidence:** High. **Scope:** Small.
- **Change:** name only JoyClub in the description.

**U40. JoyFox asks for access to joyce.app, which it does not use**

- **Possible risk (owner decision) · Permissions · Location:**
  `manifests/firefox.json:7, 13`; `config/permissions.json`;
  `docs/permissions.md:11`.
- **Trade-off:** removing it now is honest. But Firefox does not prompt for a
  host permission added in a later update (bug 1893232), so turning JOYCE back
  on later needs a runtime request (U3's code). **Confidence:** High. **Scope:**
  Small.

**U41. What JoyFox stores in private windows is not documented, and captures
there are persistent**

- **Possible risk (privacy, owner decision) · Location:** no `incognito` key
  (the default is "spanning"); `background/index.ts:79-85` never reads
  `sender.tab.incognito`; `privacy-model.md`.
- **Current behavior:** extensions are off in private windows by default. If the
  user allows JoyFox there, it keeps message text, profile facts and nicknames
  on disk, messages for up to 12 months.
- **Impact:** for this site, users plausibly use private windows for discretion.
  **Confidence:** High on the code, Medium on what users expect. **Scope:**
  Small for docs, Medium to skip captures.

**U42. The Ignore and Delete switch leaves out the facts that matter most**

- **Should fix before release · Trust · Location:** `quickSetting.hint`
  (en.ts:441, de.ts:412); `quick-action-panel.ts:211-236`.
- **Current behavior:** the hint describes the steps. It does not say:
  - that JoyClub may restrict or close the account (README:161-165, release
    notes: "highest risk");
  - how to undo (restore from the trash; "Profil nicht mehr ignorieren");
  - that the ClubMail list must show beside the conversation. It also names
    "ActionLog", but the row is labelled "Action log" / "Aktionsprotokoll".
- **Impact:** users turn on the riskiest feature without the risk the project
  itself documents. **Confidence:** High. **Scope:** Small (copy plus
  `aria-describedby`).

### 9. Settings and configuration

U8, U9 and U20 are above.

**U43. Some settings autosave and others need a Save button, on the same page**

- **Deferred · Location:** `messages-panel.ts:214-220`, `data-panel.ts:539-563`
  against `rule.autosaveHint`.
- **Confidence:** Medium. **Scope:** Small.

**U44. The template picker can be turned off only from the browser console**

- **Location:** `joyfox.templatePicker`. Removed in Pass 2.

### 10. State persistence

**U45. Unsaved note text is lost on a full page load, including JoyFox's own
"Open profile" link**

- **Possible risk (owner decision) · Location:** there is no `beforeunload`
  handler; the drafts are held in memory (`member-notes.ts:125-126`,
  `card-note-editor.ts:39-40`, `listing-panel.ts:103-104`).
- **Confidence:** High on the code. **Scope:** Small.
- **Decision needed:** leave-page prompts can annoy users.

**U46. The card editor drops its draft on Escape, Close or another ✎, without
warning**

- **Possible risk · Location:** `card-note-editor.ts:58, 73-75, 82-97`.
- **Confidence:** High. **Scope:** Small.

**U47. Typed but unsaved retention values revert after background redraws; Save
then saves the old value**

- **Possible risk · Location:** `data-panel.ts:237`,
  `messages-panel.ts:129-141`, `options/index.ts:163-191`.
- **Confidence:** High on the code, Medium on how often it happens. **Scope:**
  Small.

**U48. The inbox view and the event-list filter reset on every reload**

- **Deferred · Location:** `inbox-triage.ts:148`;
  `event-list-filter.ts:73, 114`.
- **Confidence:** High. **Scope:** Small.

**U49. A page restored from the back/forward cache is not refreshed**

- **Possible risk · Location:** no `pageshow` handler; `16-navigation.md`.
- **Confidence:** Low to medium.

### 11. Accessibility

**U50. Keyboard focus falls to the page after actions on the options page**

- **Should fix before release · Accessibility · Location:**
  `account-panel.ts:73`, `template-panel.ts:116`, `data-panel.ts:237`
  (`replaceChildren` with no restore).
- **Current behavior:** after "Remove", "Delete" or "Delete all" arms, focus is
  on `<body>`. The keyboard user must find "Confirm" from the top of the page.
- **Evidence:** verified in Chromium (`verify1.mjs`: `BODY`).
- **Journey:** account and data management. **Confidence:** High. **Scope:**
  Small to medium.
- **Change:** before a redraw, save the focused control by a stable key, and
  focus its replacement afterwards.

**U51. The card note editor is hard to use with a keyboard**

- **Should fix before release · Accessibility · Location:**
  `card-note-editor.ts:57-80` (never focuses; appended to the end of `<body>`),
  `94-96` (returns focus to a ✎ that was replaced; see
  `card-signals.ts:321-327`), `279-285` (Enter does not add a tag).
- **Current behavior:** after ✎, focus stays on the card, so the panel is
  reached only by tabbing through the whole JoyClub page.
- **Evidence:** in Chromium, the active element after opening was the ✎ button.
- **Journey:** J2 from a card. **Confidence:** High. **Scope:** Small.
- **Change:**
  - Focus the note field on open.
  - On close, return focus to the current ✎ of the same member.
  - Enter adds a tag, as in the other editors.

**U52. Placement and error text fail the 4.5:1 contrast minimum on light
backgrounds**

- **Should fix before release · Accessibility · Location:**
  `content.css:397-410` (pills), `136-139` (`.joyfox-error`), `339-342` (brand).
- **Current behavior:** on white:
  - "Quarantined" #e0544a: 3.33:1
  - "Qualified" #2ea663: 2.73:1
  - "Needs Review" #d49b1f: 2.17:1
  - error text: 3.79:1
  - The card editor is always white.
- **Impact:** the core triage result is hard to read for low-vision users (WCAG
  1.4.3). **Confidence:** High on white, Medium on JoyClub's real background.
  **Scope:** Small.
- **Change:** keep the colored border and dot. Make the pill text a darker shade
  on light themes, or `color-mix` the text toward `currentColor`. Use about
  #b3261e for error text on white.

**U53. The Simple/Advanced switch shows no focus ring**

- **Should fix before release · Accessibility · Location:**
  `options.css:220-225` (`overflow: hidden` clips the 2 px offset outline).
- **Evidence:** screenshot `switch-focus.png`, compared with `tab-focus.png`
  (WCAG 2.4.7). **Confidence:** High. **Scope:** Small.

**U54. Page surfaces lose focus after actions**

- **Can fix after release · Accessibility · Location:** member panel
  `member-panel.ts:325`; inbox panel `inbox-triage.ts:573`; saved searches
  `saved-searches.ts:365`; event box `listing-panel.ts:252-261, 408-418`; sort
  `compatibility.ts:415-435`.
- **Evidence:** the same bug was fixed before in member notes and in M9.
  **Confidence:** High. **Scope:** Medium.
- **Change:** reuse member-notes' focus restore; use `aria-disabled` for busy
  states.

**U55. The Ignore and Delete note is not linked to its button**

- **Can fix after release · Accessibility · Location:**
  `quick-action.ts:664-679`.
- **Impact:** the click is the confirmation, but a screen reader announces only
  "Ignore and Delete, button". **Confidence:** Medium to high. **Scope:** Small.
- **Change:** `aria-describedby`.

**U56. Accessible names do not start with the visible label (WCAG 2.5.3)**

- **Deferred · Location:** "Use this account", "Confirm delete", "Delete this
  account's data" (en.ts:688-689, 856-858, 945-946).

**U57. Focus colors come from the platform's `Highlight`**

- **Possible risk · Location:** `options.css:10, 92-95`.
- **Evidence:** a macOS-style light `Highlight` would give 1.49:1 on white.
  **Confidence:** Medium. Needs a check on macOS.

**U58. Faint field borders (1.98:1) and missing focus styles on some page
inputs**

- **Possible risk · Location:** `content.css:24`;
  `.joyfox-saved-searches__name`, `.joyfox-listing__*`,
  `.joyfox-event-filter__select`.
- **Evidence:** it depends on JoyClub's CSS. Needs a live check.

**U59. Card-line targets are about 20×16 px, and a near miss opens the profile**

- **Deferred · Location:** `content.css:772-801`; acceptance item 126.
- **Note:** the height is an accepted limitation. `min-width: 24px` is a small
  change.

**U60. Up to six JoyFox landmarks on one page, and mixed heading levels**

- **Deferred · Location:** the `<section aria-label>` elements in the content
  modules.

**U61. JoyFox writes into a JoyClub list marked `aria-live`**

- **Possible risk (needs a screen-reader test) · Location:** `01-inbox.md:7`;
  `card-line.ts:185-191`.

### 12. Visual clarity

**U62. The card chip "Unknown" does not say what is unknown, and a card with a
note is hard to spot**

- **Possible risk · Location:** `signals.state.unknownShort` (en.ts:517);
  `content.css:803-806`.
- **Evidence:** screenshot `inbox-rule.png` shows "Needs Review · Unknown ·
  Trust –", which can read as "placement unknown". **Confidence:** Medium.
  **Scope:** Small.

**U63. The card editor ignores JoyClub's dark theme**

- **Possible risk · Location:** `content.css:736-737` (`Canvas`/`CanvasText`).
- **Needs validation:** depends on JoyClub's `color-scheme`.

**U64. A pointer cursor on badges that cannot be clicked**

- **Deferred · Location:** `content.css:80-90`.

**U65. Full-width Save buttons; German tab row wraps; German select text
truncates** (removed in Pass 2)

### 13. Copy and terminology

**U66. English strings point "above" or "below" to the wrong place; the German
is correct**

- **Can fix after release (quick win) · Location:**
  - `templates.noAccount` "Choose an active account above" (en.ts:849): Accounts
    is another tab.
  - `data.accountRecordHint` "in Accounts above" (en.ts:919).
  - `messages.cachingOff` "the time below" (en.ts:473): the field is above.
- **Evidence:** screenshot `empty-light-templates.png`. **Confidence:** High.
  **Scope:** Small.

**U67. "Rule" means both the whole contact rule and a group inside it; "Remove"
and "Delete" are mixed**

- **Deferred · Location:** `rule.ruleTitle`, `rule.removeRule`,
  `rule.deleteAll`, `rule.removed`.

**U68. Jargon and unclear labels**

- **Deferred · Location:**
  - "listing" (en.ts:396, 401)
  - "tracked" is never introduced
  - "outcome" (en.ts:298)
  - "All conditions checked (n)" reads like a status
  - raw setting keys in import results (`data-panel.ts:717-742`)
  - records named by ID only (`data-panel.ts:168-177`)

**U69. German wording**

- **Deferred · Location:**
  - "Wird geprüft" is close to "Zu prüfen" on an 11 px badge (de.ts:303, 15).
  - "Schließe dieses Fenster" (de.ts:510).
  - "Angezeigtes Konto" can read as switching accounts (de.ts:848).

### 14. Firefox-specific behavior

U3, U11, U38, U40 and U41 are above. Verified correct:

- `onInstalled` is registered at the top level, and the options page opens only
  when the reason is `install`.
- All listeners are registered synchronously.
- `storage.session` is used for the hand-off.
- `data_collection_permissions` is correct (shown from Firefox 140).
- The export uses `<a download>` with no `downloads` permission.

**U70. Permanent private browsing mode ("Never remember history") may break
IndexedDB**

- **Possible risk · Location:** `storage/database.ts`.
- **Evidence:** search excerpts of Mozilla bugs 1427986 and 1406675. Needs a
  manual check.

### 15. Edge cases

U22, U23, U27, U46 and U47 are above.

**U71. Pasted note text over 4,000 characters is cut off silently**

- **Deferred · Location:** `maxLength` in `member-notes.ts:332`,
  `card-note-editor.ts:193`, `listing-panel.ts:334`.

**U72. Message search reads every stored message on each keystroke, with no
debounce**

- **Possible risk · Location:** `messages-panel.ts:93-120, 274-283`.
- **Note:** matters only for large stores.

**U73. Adding a tag the member already has still says "Tag added."**

- **Deferred · Location:** `notes-service.ts:170-189`.

---

## Phase 4: priorities

### Top 5 high-impact UX fixes

1. **U1: setup state is invisible on JoyClub.**
   - The first thing every new user does after setup is open the inbox (Get
     started step 3).
   - If a step is missing, the page gives no sign, which reads as "broken".
   - Small fix that reuses an existing button.
2. **U6: ticking a threshold shows an error.**
   - It hits nearly every user in the core setup step, and a correct action
     looks like a failure.
   - Small fix that follows a pattern the Advanced editor already uses.
3. **U7: rule feedback is out of view.**
   - Without it, users cannot tell whether the rule saved.
   - Together with U6 and U8, it decides whether a user trusts the sorting at
     all.
4. **U42: the Ignore and Delete switch hides its risks.**
   - The project documents account-closure risk in the README but not where the
     user turns the feature on.
   - It is a trust issue with a severe possible cost.
   - Copy only.
5. **U19: account removal understates the data deleted.**
   - It can delete templates, messages and event notes that the user thinks are
     safe.
   - The confirmation cannot protect against a wrong prompt.
   - Copy only.

Next in line: U50 and U51 (keyboard barriers) and U18 (one-click rule delete).

### Quick wins (checked as low effort)

| ID         | Change                                                                         | Effort                             |
| ---------- | ------------------------------------------------------------------------------ | ---------------------------------- |
| U2         | Hint under the identifier field                                                | 1 string × 2 languages + 1 element |
| U9         | Inline "(not checked yet)" on the spam row                                     | 1 string × 2                       |
| U19        | Removal prompt and "no account active" text                                    | 2 strings × 2                      |
| U20        | Retention warning and default                                                  | 1 string × 2                       |
| U39        | Manifest description                                                           | 1 line                             |
| U42        | Ignore and Delete risk, undo and split-view text; log name; `aria-describedby` | 1 string × 2 + 1 attribute         |
| U53        | Focus ring on the switch                                                       | 1 CSS rule                         |
| U24        | Busy style for `aria-disabled`                                                 | 1 CSS rule                         |
| U66        | Fix "above" and "below"                                                        | 3 strings                          |
| U18        | Two-click rule delete with the existing `confirm.ts`                           | about 20 lines + test              |
| U23        | In-flight guard on Add account                                                 | about 10 lines, copied             |
| U28        | Clear the rule status on account change                                        | about 3 lines                      |
| U51 (part) | Enter adds a tag in the card editor                                            | about 10 lines, copied             |

---

## Phase 5: two-pass review

### Pass 2: challenges applied

For each finding: is it a real user problem, what supports it, is it needed for
the core use, is the fix proportional, is this generic advice, could the change
make things worse, does Firefox explain the current code, and would real users
need to be observed first?

- **U1:** the silence on "no rule" is asserted by a test. ADR 0006 asks for
  silence only for "rule off" and failures, so showing a hint for "no account"
  and "no rule" does not conflict with it. **Kept.**
- **U3:** Firefox 127+ grants host access at install. The risk now is mainly
  revocation, so it depends on how often users revoke. **Kept as a possible
  risk**, recommended because the failure is total and silent.
- **U8:** an empty rule is legitimate (the "Open" preset). The problem is only
  that the Simple editor saves it silently. **Kept**, with the fix limited to a
  notice and disabling unticked rows.
- **U11:** adding an entry point needs a reason. The reason is recurring tasks
  (account switching) that live only on the options page. **Kept as an owner
  decision.**
- **U52:** the real JoyClub background is not recorded. The card editor is
  always white, so it fails for certain. **Kept.**
- **U42:** click-as-confirmation is the owner's decision and is **not**
  re-flagged. Only the missing facts are flagged.

### Removed in Pass 2

| Finding                                                                                  | Why it was removed                                                                  |
| ---------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| The Ignore and Delete switch sits on the Contact rule tab under "never deletes anything" | Separate heading; the owner placed it there on 2026-09-27; no evidence of confusion |
| The shared-event exception is on the Events tab, not the rule tab                        | The "Why" panel names the event whenever it applies                                 |
| The snapshot setting sits under the per-account section                                  | Its hint says "in every account"                                                    |
| No options switch for the template picker (U44)                                          | A new setting with no evidence that users need it                                   |
| The destructive button has no warning style                                              | Its note is always visible; off by default; a style preference                      |
| The search page stacks three JoyFox boxes                                                | A layout redesign with no evidence of harm                                          |
| "Your data" lists unused types (Spending log, Sync settings)                             | PRD 21.4 requires a full accounting of every entity                                 |
| Full-width Save buttons; German tab wrap; select truncation (U65)                        | Style only; they still work                                                         |
| Text-only zoom clips the card line                                                       | An accepted known limitation                                                        |
| The "Template inserted" message stays (U32)                                              | Trivial; does not affect a task                                                     |
| Other options tabs do not refresh accounts or templates                                  | Rare; the error message recovers                                                    |
| Diagnostic message handlers ship in the release                                          | Not UX; pages cannot reach them (a security-hygiene note only)                      |
| A background failure looks the same as "not set up"                                      | Accepted in ADR 0006 and the known limitations                                      |
| The "Inbox" and "Show all" tabs have no count                                            | Preference                                                                          |
| The "?" disclosure opens full width                                                      | Style                                                                               |
| The profile page shows no notice while M9 waits, then a doubled line                     | Short (about 1.7 s live); low impact; kept in the deferred notes only               |

### Final set

**Confirmed issues (27)**

- **Should fix before release (16):**
  - U1, U2, U6, U7, U8, U9
  - U18, U19, U20, U21
  - U39, U42
  - U50, U51, U52, U53
- **Can fix after release (11):** U14, U22, U23, U24, U27, U28, U29, U33, U54,
  U55, U66

**Possible risks (19):** U3, U10, U11, U17, U30, U38, U40, U41, U45, U46, U47,
U49, U57, U58, U61, U62, U63, U70, U72

- Of these, U3, U11, U40, U41 and U45 need an owner decision. The rest need a
  live check.

**Deferred improvements (26):** U4, U5, U12, U13, U15, U16, U25, U26, U31, U34,
U35, U36, U37, U43, U48, U56, U59, U60, U64, U67, U68, U69, U71, U73, plus
account label editing and the M9 report wording (the doubled profile line, and
"check whether" after nothing was done).

## Sources (Firefox)

- MDN `host_permissions`:
  https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/manifest.json/host_permissions
- Mozilla Add-ons Blog, "Manifest V3 updates" (2024-05-14):
  https://blog.mozilla.org/addons/2024/05/14/manifest-v3-updates/
- Mozilla Add-ons Blog, "Unified extensions button" (2022-11-17):
  https://blog.mozilla.org/addons/2022/11/17/unified-extensions-button-and-how-to-handle-permissions-in-manifest-v3/
- MDN `runtime.onInstalled`:
  https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/API/runtime/onInstalled
- MDN `runtime.onUpdateAvailable`:
  https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/API/runtime/onUpdateAvailable
- Mozilla Support, "Extensions in Private Browsing":
  https://support.mozilla.org/en-US/kb/extensions-private-browsing
- Mozilla Support, "Extensions button":
  https://support.mozilla.org/en-US/kb/extensions-button
- w3c/webextensions#617 (content scripts injected into open tabs on install and
  update)

## Implementation status (2026-09-28)

The owner approved all confirmed issues and all deferred improvements, and these
owner decisions:

| Decision                                       | Result                                                                 |
| ---------------------------------------------- | ---------------------------------------------------------------------- |
| U1 setup hint on JoyClub pages                 | Approved and built                                                     |
| U3 site-access check in "Get started"          | Approved and built                                                     |
| U11 toolbar button that opens the options page | Approved and built                                                     |
| U40 remove joyce.app access                    | Not approved: the permission stays; only the description changed (U39) |
| U41 private windows                            | Documented only (README, privacy model, "Messages" tab)                |

Built: every confirmed issue (U1, U2, U6 to U9, U14, U18 to U24, U27 to U29,
U33, U39, U42, U50 to U55, U66) and every deferred improvement (U4, U5, U12,
U13, U15, U16, U25, U26, U31, U34 to U37, U43, U48, U56, U59, U60, U64, U67 to
U69, U71, U73, account label rename, and the M9 report wording). The new checks
are `docs/manual-acceptance.md`, items 139 to 166.

Not built (possible risks that need a live check or a decision first): U10 is
covered in part by the focus return on Close; U17, U30, U38, U45 to U47, U49,
U57, U58, U61 to U63, U70 and U72 remain open.
