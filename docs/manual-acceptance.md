# Manual acceptance

## Foundation shell

1. Build the Firefox extension and load `dist/firefox/manifest.json` temporarily
   from `about:debugging`.
2. Open a permitted page and confirm the extension reports no uncaught errors.
3. Confirm the page is visually and behaviorally unchanged while selectors are
   unverified.
4. Send `diagnostic.ping` from extension devtools and confirm the reply
   preserves its request ID and payload.
5. Invoke the background wake-counter, terminate the background page, invoke it
   again, and confirm the stored value increases rather than resetting. From the
   options page console (`about:addons` → JoyFox → Preferences, then
   Ctrl+Shift+K), run:
   `await browser.runtime.sendMessage({ type: "diagnostic.wake", requestId: "r1", payload: { accountId: "acceptance" } })`
   and note `payload.wakeCount`. In `about:debugging`, click **Terminate
   background script** on JoyFox. Run the same command again (with requestId
   `"r2"`) and confirm `wakeCount` is one higher.
6. Confirm normal use creates no extension-originated network requests.

## Accounts, notes and tags

7. Open the extension options page and confirm it reports
   `Active account: None selected` before any account exists.
8. Add an account, then confirm it is listed and marked `Active` in words, not
   only by styling.
9. Add a second account, switch to it, reopen the options page, and confirm the
   choice survived the reload.
10. Confirm every control is reachable and operable by keyboard alone.
11. Click `Remove` once and confirm nothing is deleted until the second,
    explicit confirmation.
12. Remove an account and confirm the remaining account's data is unchanged.
13. Confirm a note or tag cannot be saved anywhere in the live UI while
    selectors are unverified, and that the refusal states nothing was stored.

## Spam detection and qualification

14. Upgrade an existing installation rather than a clean one, and confirm notes
    and tags written before the upgrade are still present.
15. Confirm a data export reports schema version 2 (4 since ADR 0014) and
    includes the message observation and sender override collections.
16. Confirm no message is cached anywhere while selectors are unverified, since
    nothing reads a page yet.

**Item 5 result (2026-09-23): passed.** After **Terminate background script**,
`wakeCount` was one higher than before, so the counter survives a forced
event-page restart (F3).

## F2 live acceptance (inbox)

14. Build the extension, load `dist/firefox/manifest.json` temporarily from
    `about:debugging`, and log in to JoyClub yourself.
15. Open the JoyFox options page (`about:addons` → JoyFox → Preferences). In
    that tab's console (Ctrl+Shift+K), run
    `browser.storage.local.set({ "joyfox.diagnostics": true })`. Do not use the
    about:debugging Inspect console: the background event page is often
    suspended there, and `browser` is then undefined.
16. Open the inbox and the page's console. Confirm a line such as
    `JoyFox inbox.extracted rows=25 senderName=25 memberId=25 ...` appears. It
    must contain counts only, never a name or number.
17. Reload the inbox ten times. Confirm the line appears each time and that
    `senderName` and `memberId` equal `rows` (or record which rows differ).
18. Turn diagnostics off again in the options page console with
    `browser.storage.local.remove("joyfox.diagnostics")`.

**Result (2026-09-23): passed.** The project owner reloaded the inbox ten times
with diagnostics on. Each load logged the same two lines:

```text
JoyFox inbox.extracted rows=0 senderName=0 memberId=0 verificationCode=0 readState=0
JoyFox inbox.extracted rows=25 senderName=25 memberId=25 verificationCode=24 readState=9
```

- The first line is the list container rendering before its rows. The second
  follows once the rows arrive: the extractor reads what is rendered and runs
  again on the next mutation. Zero rows can therefore be transient; it is not
  yet known how a truly empty inbox renders.
- Sender name and member ID were found on all 25 rows, every time.
- `verificationCode=24` matches the evidence: one row has no verification icon.
- `readState=9`: a read state was extracted from 9 rows. This does not show how
  many rows carry the icon, because a row with the icon but no recognized
  modifier also counts as missing. Its meaning is not confirmed (see
  `known-limitations.md`).
- The lines held counts only; no name or number appeared.

## Milestone C live acceptance (triage, rule, trust)

Use your own account. Never click Ignore, Block or Delete on JoyClub.

19. Build and load the extension (item 14). In the options page, add an account
    if none exists.
20. In "Contact rule", tick "Personally known" in the ALL box and keep
    "Quarantined". The rule saves on its own (there is no Save button since
    2026-09-24). Confirm the message "Rule saved".
21. Open the inbox. Confirm the tab bar appears above the list, every row has a
    badge with a word (Qualified, Needs Review or Quarantined), and green-shield
    senders show Qualified.
22. Click "Quarantined". Confirm only quarantined rows show. Click "Inbox" and
    confirm they are hidden. Click "Show all" and confirm every row shows.
23. Click one badge. Confirm the "Why" panel names the reason and that the
    conversation did not open. Click "Move to Qualified" and confirm the badge
    changes at once. Click "Use my rule again".
24. Scroll the inbox. If more rows load, confirm they get badges. Record whether
    JoyClub's scrolling or row clicks behave differently.
25. Open a conversation and a profile. Confirm the JoyFox panel appears under
    the header. Click "Log positive" and confirm the trust score rises by one at
    once. Click "Undo last outcome".
26. In the options page, untick "Sort my JoyClub inbox with this rule" (it saves
    on its own). Confirm the inbox tab bar, badges and hidden rows disappear.

**Result (2026-09-23): passed, with one finding.** The project owner ran items
19 to 26 on the PR #14 build. Every item was confirmed, including item 23 (a
badge click did not open the conversation) and item 24 (scrolling and row clicks
unchanged).

- Finding: JoyClub keeps the conversation list on screen beside an open
  conversation. After opening and answering a message, the tab bar was gone from
  that list until a reload or a click on "Postfach". A first fix (triage on for
  conversation pages with a visible list) did not help: the owner's re-check
  showed the bar still vanished after sending a reply. Triage now follows the
  list itself, on any page where it is visible, and also notices the list being
  hidden and shown in place.
- Re-check (2026-09-23): passed. With build 8fa0a2c the owner sent a message
  from a second account and replied beside the list; the tab bar and badges
  stayed on the list.

## Milestone D live acceptance (data control, templates)

Use your own account. Never click Send during the template trial unless you mean
to send the text.

27. Build and load the extension (item 14). In the options page, add a template
    under "Message templates" with two lines, an umlaut and an emoji, in the
    folder "Event confirmation". Edit it once and confirm the change shows.
28. In "Your data", confirm the counts match what you created and that "Show"
    lists the template as text. Choose the other account (if any) in "Account to
    inspect" and confirm the active account in "Accounts" did not change.
29. Click "Export this account (JSON)" and "Export all JoyFox data (JSON)". Open
    both files in a text editor. Confirm `schemaVersion` is 2, every data type
    is listed, and the template text is exact.
30. Click one "Delete" and confirm nothing is deleted until "Confirm". Delete
    one record, then one data type, and confirm the counts drop.
31. The picker is on by default (it was an opt-in trial when this item was run).
    To turn it off or on, use the **JoyFox options page** console, never a
    JoyClub tab: a web page's console cannot use `browser` and reports
    `ReferenceError: browser is not defined`. Open `about:addons` → JoyFox →
    Preferences, press Ctrl+Shift+K in that tab, and run
    `browser.storage.local.set({ "joyfox.templatePicker": false })` to turn it
    off, or `browser.storage.local.remove("joyfox.templatePicker")` to turn it
    on again.
32. Open a conversation. Confirm a "JoyFox templates" button appears below
    JoyClub's message box, not inside it. Type a few words, place the cursor
    between them, open the list and pick the template. Confirm the text appears
    exactly at the cursor and the message was not sent.
33. **Item 6 check.** Without typing anything else, confirm whether JoyClub
    noticed the text: for example the Send button becomes active, or a character
    counter changes. Then delete the text with the keyboard and confirm JoyClub
    notices that too. Record the result; do not click Send unless you mean it.
34. Turn the picker off (item 31) and confirm the button disappears at once.
    Turn it on again.
35. Last, in "Your data", click "Delete all JoyFox data" and "Confirm". Confirm
    that no account, rule or template remains, that the JoyClub inbox shows no
    JoyFox UI, and that `await browser.storage.local.get()` in the options page
    console returns `{}`.

**Result (2026-09-23): passed.** The project owner ran items 27 to 35 on the
build from `main` at 9583284 and confirmed every item.

- Items 27 to 30: templates, the data panel, both exports and the record and
  data-type deletes worked.
- Items 31 to 34 (run as the opt-in trial, `joyfox.templateInsertionTrial`): the
  picker appeared below the message box, inserted exactly at the cursor and sent
  nothing. Item 33: JoyClub registered the inserted text before any key was
  typed, and also its deletion by keyboard. This settles
  `manual-verification-needed.md` item 6 for the standard composer. The owner
  then chose to make the picker default-on (ADR 0007).
- Item 35: "Delete all JoyFox data" left no account, rule, template or setting,
  and the inbox showed no JoyFox UI.
- A finding while running item 31: the trial flag was first set in a JoyClub
  tab's console, which has no `browser`. The steps now name the options page
  console.

## M5 live acceptance (notes and tags)

Use your own account and a member you are allowed to view. Use invented note
text; never record the member's real data in this repository.

36. Build and load the extension (item 14), with an account active. Open a
    member's profile. Confirm "Your notes and tags (none yet)" appears after the
    JoyFox panel (or after the profile header), not inside a JoyClub element,
    and is closed.
37. Open it. Type a note with two lines, an umlaut and an emoji, and click "Save
    note". Add one tag with Enter and one with "Add tag". Confirm "Note saved."
    and "Tag added." and both tags in the list.
38. Reload the page, then quit and restart Firefox and open the profile again.
    Confirm the note text is exact and both tags are shown, open by default (M5
    acceptance: the note survives a restart).
39. Open a conversation with the same member. Confirm the same note and tags
    appear after the JoyFox panel below the conversation header, and that
    clicking in the editor does not open the profile.
40. In the options page, switch to another account. Confirm the editor on the
    open JoyClub tab disappears at once and then shows no note for the other
    account. Switch back and confirm the original note and tags are unchanged.
41. Open the same profile in two tabs. Save a new note in the first and confirm
    the second shows it at once. In the second tab, type other text but do not
    save. Save another change in the first tab, then click "Save note" in the
    second. Confirm the warning that the note changed elsewhere, that your text
    stays in the box, and that saving again replaces the note.
42. With the keyboard only, open the editor, type a note, save it, add a tag and
    remove it. Confirm every control is reachable and named. Then, in "Your
    data", delete the "Notes" data type and confirm the open profile's editor
    shows no note.

**Result (2026-09-27): passed.** The project owner ran items 36 to 42 on JoyClub
with the member strip fixes of PRs #72 and #73 (the strip had been placed after
the hidden mobile header, so it did not show); item 40 in the second run the
same day.

## Onboarding (build plan Section 28, PRD Section 21.1)

55. Use a fresh Firefox profile with no JoyFox data. Start a timer, build and
    load the extension (item 1). Confirm the JoyFox options page opens by itself
    and "Get started" lists three steps, the first two "Not done yet". Follow
    the steps: add your account, save and turn on a contact rule, open your
    JoyClub inbox. Confirm each step changes to "Done" in words, the summary
    says "JoyFox is set up", and the inbox shows JoyFox's tabs. Stop the timer:
    PRD Section 21.1 asks for under 10 minutes. Reload the extension and confirm
    the options page does not open again.

**Result (2026-09-27): passed.** The project owner confirmed item 55.

## M9 destructive-action matrix (build plan Section 24)

**Accepted by hand on 2026-09-25 (ADR 0011); results below the table.** Run
these only on test conversations you mean to trash, with members you are willing
to ignore and then un-ignore ("Profil nicht mehr ignorieren" in the profile
menu). Never run them automatically. Use the split view (conversation list on
the left), because Delete is checked by the row leaving the list.

Turn the button on first, on the JoyFox options page (since 2026-09-27; before,
it took a console command):

- Open the JoyFox options page: in `about:addons`, click the "..." next to
  JoyFox, then **Options** (older Firefox: **Preferences**).
- On the "Contact rule" tab, under "Ignore and Delete", tick "Show the "Ignore
  and Delete" button on ClubMail conversations". JoyFox says "Saved." Untick it
  to turn the button off again.
- Open JoyClub tabs follow at once; reload one if the button does not appear.

The run: on the conversation page, JoyFox moves the conversation to the trash,
opens the member's profile in the same tab, and ignores them there. The result
shows in the JoyFox strip on the profile page.

For each item, check three things: JoyClub's final state, the ActionLog record
in "Your data" (steps, in order, with the `errorCode` of `Failed`), and the
on-screen notice. Success means every item ends in the expected state with the
expected ActionLog. Each item has a synthetic test with the same case number in
`tests/integration/quick-action.test.ts`, except item 45: its test is "does not
start Delete when the list that shows its result is missing" in
`tests/integration/quick-action-driver.test.ts` (case 3 there tests a missing
Delete confirmation instead).

| Item | Case                                   | How to cause it                                                                           | Expected ActionLog steps                                                                           | Expected notice                                                                                                                   |
| ---- | -------------------------------------- | ----------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| 43   | 1. Both succeed                        | Normal run                                                                                | `Started`, `DeleteRequested`, `DeleteConfirmed`, `IgnoreRequested`, `IgnoreConfirmed`, `Completed` | On the profile: "Ignore and Delete finished.", then after 2 seconds the ClubMail list. Conversation in the trash, member ignored. |
| 44   | 2. Delete control missing              | Run where the conversation shows no Delete control                                        | `Started`, `Failed:control-missing`                                                                | "Nothing was changed on JoyClub." Both next actions.                                                                              |
| 45   | 3. Delete not seen                     | Hide the conversation list (narrow window), or use a conversation whose row is not loaded | `Started`, `Failed:unverifiable`                                                                   | "JoyFox cannot see JoyClub's result for Delete …". Nothing changed.                                                               |
| 46   | 4. Delete done, Ignore control missing | Use a member you already ignore                                                           | … `DeleteConfirmed`, `Failed:control-missing`                                                      | "Delete: done." "Ignore: not done." "JoyFox did not undo anything."                                                               |
| 47   | 5. Ignore confirmation fails           | Close JoyClub's Ignore dialog with "Abbrechen" before JoyFox reaches it                   | … `IgnoreRequested`, `Failed:confirmation-missing` (or `not-verified`)                             | "Ignore: not confirmed." The Ignore next action.                                                                                  |
| 48   | 6. Navigation interrupted              | Navigate away or go offline during a step                                                 | Last step before the stop, then `Failed:timeout` or `Failed:identity-unavailable`                  | Names the step that did not complete.                                                                                             |
| 49   | 7. Tab closed during the action        | Close the tab right after the conversation leaves the list                                | Ends at the last stored step, with no `Failed`                                                     | On reopening the conversation after 2 minutes: "was interrupted".                                                                 |
| 50   | 8. Member identity mismatch            | While the profile loads, open another member's profile in the same tab                    | … `DeleteConfirmed`, then nothing more on that page                                                | Later, on the conversation: "was interrupted". No Ignore click.                                                                   |
| 51   | 9. Conversation identity mismatch      | Switch to another conversation right after clicking                                       | `Started`, `Failed:conversation-mismatch` (or `member-mismatch`)                                   | "The page showed another conversation …". No Delete click.                                                                        |
| 52   | 10. Markup changes between steps       | Reload the profile page while JoyFox waits for its menu                                   | … `DeleteConfirmed`, `Failed:control-missing`, or the run stays at `DeleteConfirmed`               | Names the step and says JoyFox stopped before it, or later "was interrupted".                                                     |
| 53   | 11. Background restarted mid-run       | Click **Terminate background script** in `about:debugging` during the run                 | The full sequence, or the last stored step then `Failed`                                           | Matches the ActionLog. No step is repeated.                                                                                       |
| 54   | 12. Another account activated mid-run  | Switch the JoyFox account in the options page during the run                              | Account A's log ends at its last stored step; account B has no record                              | "The active JoyFox account changed, so JoyFox stopped at …".                                                                      |

**Result, item 43 (2026-09-24): passed.** The project owner ran Ignore and
Delete on a test conversation in the split view. The exported ActionLog shows
`Started`, `DeleteRequested`, `DeleteConfirmed` (0.24 s after the click, the row
left the list), `IgnoreRequested` (1.7 s, after the move to the profile),
`IgnoreConfirmed` (2.6 s) and `Completed`, one operation with the matching
member and conversation. The first attempt had stopped before any click with
"could not find JoyClub's Delete control"; Delete moved to the conversation's
three-dot menu (`live-evidence/10-ignore.md`, eighth report).

**Result, item 43, return to ClubMail (2026-09-28): passed.** After PR 90, the
project owner ran Ignore and Delete live. The profile showed "Ignore and Delete
finished.", then the tab returned to the ClubMail list (ADR 0011, "Return to the
ClubMail list").

**Result, items 44 to 54 (2026-09-25): accepted.** The project owner ran the
matrix by hand:

- **44 and 45: not reproducible live.** JoyClub always shows the Delete control
  and the list row, so these cases cannot be caused by hand. Synthetic tests
  cover them: case 2 for item 44, and the driver test for a missing list for
  item 45.
- **46: accepted, with a known gap.** The conversation went to the trash and the
  member stayed ignored, so the end state is correct. No notice said the member
  was already ignored. This is the deferred review item in ADR 0011 ("report an
  already ignored member as such"). The owner decided to keep it as is, with no
  fix.
- **47 and 50: not reproducible live.** JoyFox clicks Ignore too quickly to
  press "Abbrechen" or to open another profile first. The owner accepts this as
  is: an unwanted Ignore can be undone by hand. The synthetic tests (cases 5
  and 8) cover them.
- **48, 49 and 51 to 54: passed.**

## Rule autosave (2026-09-24)

56. In "Contact rule", tick one condition. Confirm "Rule saved" appears at once,
    without a Save button, and that "Remove rule" appears.
57. Tick "Minimum photos", type a number, then press Tab. Confirm "Rule saved"
    appears after leaving the field, and that focus stays on the next control.
58. Type a number outside the allowed range and press Tab. Confirm an error
    appears and the saved rule is unchanged. Reload the options page and confirm
    the form shows the last valid rule.

**Result (2026-09-27): passed.** The project owner confirmed items 56 to 58.

## Import (2026-09-24)

59. In "Your data", click "Export all JoyFox data (JSON)" and keep the file.
60. In a second Firefox profile (or after "Delete all JoyFox data"), open the
    options page, choose the file under "Import" (on the Accounts tab since
    2026-09-24), and confirm the preview lists what will be added. Confirm
    nothing changed yet, then click "Confirm import" (removed on 2026-09-25: an
    import now starts when the file is chosen; see items 83 to 85). Confirm
    accounts, rules, templates and notes are back, and the active account is
    set.
61. Choose the same file again. Confirm the preview says nothing would change.
62. Choose a file that is not a JoyFox export. Confirm the error says nothing
    was imported.

**Result (2026-09-24): passed.** The project owner confirmed export and restore
(items 59 and 60), and later that re-importing the same file (61) and refusing a
non-JoyFox file (62) also work.

## Member strip and page colors (ADR 0010)

63. Open a ClubMail conversation. Confirm one JoyFox strip appears under the
    header row, across the full width of the conversation panel, not inside the
    row beside the name. It shows JoyFox, the placement pill, the trust score,
    "Log: Positive, Neutral, Negative", "Why and move" and "Your notes and
    tags".
64. Confirm the strip follows JoyClub's dark theme: no white boxes, and text as
    readable as JoyClub's own.
65. Click "Why and move". Confirm the reasons and "Move to …" buttons appear
    under the bar. Click "Positive" and confirm the drawer stays open and "Undo"
    appears.
66. Click "Your notes and tags". Confirm the editor opens under the bar and the
    note can be saved. Reload and confirm it is closed again.
67. Open a member's profile page and confirm the same strip under the profile
    header. Open the inbox and confirm the triage bar is dark, one row, with a
    "?" that opens the explanation.

**Result (2026-09-24): passed.** The project owner confirmed items 63 to 67.

## Inbox views without gaps

68. Open the inbox and click "Needs Review". Confirm only Needs Review rows
    show, together at the top of the list, with no empty space between them.
    Repeat for "Qualified" and "Quarantined".
69. Scroll down so more rows load, then switch views again. Confirm the new rows
    follow the same view with no gaps. Click "Inbox" and confirm every
    non-Quarantined row is back in its original order.

**Result (2026-09-24): passed.** The project owner confirmed items 68 and 69:
the gaps are closed.

## Options page tabs

70. Open the JoyFox options. Confirm five tabs: Get started, Accounts, Contact
    rule, Templates and Your data. Only one section shows at a time.
71. Click each tab, then reload. Confirm the same tab stays open. In Get
    started, click the "Accounts" and "Contact rule" links and confirm they open
    those tabs. With the keyboard, focus a tab and use the arrow keys, Home and
    End.
72. In Your data, confirm the Actions column lines up with its row. In Contact
    rule, confirm each condition is one row, with the number fields and the "If
    JoyFox cannot see this" choices in straight columns. With Firefox in dark
    mode, confirm the page is dark and the red delete buttons are readable.

**Result (2026-09-24): passed.** The project owner confirmed items 70 to 72.

## Import on the Accounts tab (2026-09-24)

73. Open the options page and click the Accounts tab. Confirm "Import", its
    explanation and the file chooser appear under the account list and the "Add
    account" form. Confirm "Your data" no longer shows Import.
74. Choose a JoyFox export file there. Confirm the preview, "Confirm import"
    (removed on 2026-09-25; see items 83 to 85) and the result message appear on
    the Accounts tab, and that the imported accounts show in the account list
    right after the import.

**Result (2026-09-24): passed.** The project owner confirmed items 73 and 74:
Import now sits under the account list on the Accounts tab.

## Advanced contact rule (ADR 0012)

75. Open the Contact rule tab and click "Advanced". Build: Rule 1 met if ALL of
    "Personally known"; "+ Add rule"; Rule 2 met if ALL of "Verified by
    JoyClub", "Minimum account age in days" 180 and "Minimum photos" 3. Confirm
    "OR" shows between the rules and "Rule saved" after each change.
76. Reload the options page. Confirm it opens in Advanced with both rules as
    built. Click "Simple" and confirm the ALL box holds the Rule 2 conditions
    and the ANY box holds "Personally known". Click "Advanced" again.
77. On a JoyClub inbox, open the "Why" panel of a verified sender with fewer
    than 3 photos. Confirm it is not Qualified and the reasons start with "Rule
    1:" and "Rule 2:". For a sender you marked as personally known, confirm
    Qualified with a "Rule 1:" reason.
78. In Advanced, tick "not" on "Minimum photos". Confirm the "not" label turns
    bold and red, the Simple button turns off and the reason shows next to it.
    Untick it and confirm Simple is offered again.
79. Change "A sender is qualified if ANY" to "ALL". Confirm "AND" shows between
    the rules and Simple turns off. Set it back to ANY.
80. Click "Remove rule" on a rule and ✕ on a condition. Confirm each saves at
    once and the rules are numbered again. Confirm "+ Add rule" turns off at 10
    rules.

**Result (2026-09-25): passed.** The project owner confirmed items 75 to 80.

## Open-profile link for unknown profile facts

81. Set a contact rule with "Minimum photos" and "Minimum profile words". Open a
    ClubMail conversation with a sender whose profile you have not opened.
    Confirm the strip says "The photo count and profile word count are unknown.
    Open the profile and JoyFox reads them." with an "Open profile" button.
82. Click "Open profile". Confirm JoyClub opens the sender's profile in the same
    tab. Go back to the conversation and confirm the link is gone and the
    placement uses the photo and word counts.

**Result (2026-09-25): passed.** The project owner confirmed items 81 and 82.

Live selector and action acceptance must wait for the evidence checklist in
`manual-verification-needed.md`. Never perform destructive action testing
automatically.

## Import without a second confirmation (2026-09-25)

83. On the Accounts tab, click "Browse", choose a JoyFox export file and click
    OK. Confirm the import starts at once: no "Confirm import" button shows, and
    "Import complete" and the table "What the import changed" appear. Confirm
    the imported accounts show in the account list.
84. Choose the same file again. Confirm the message says nothing was changed.
85. Choose a file that is not a JoyFox export. Confirm the error says nothing
    was imported.

**Result (2026-09-25): passed.** The project owner confirmed items 83 to 85.

## First message contains (ADR 0013)

86. On the Contact rule tab, tick "First message contains" in the ALL box, type
    a word from your own profile instruction, and leave the field. Confirm "Rule
    saved". Reload the options page and confirm the text is still there.
87. Ask a test contact to send you a first message that contains the word. Open
    the inbox and confirm the row is Qualified. Open "Why" and confirm it says
    the latest message contains the word.
88. Ask the same contact to send a second message without the word. Reload the
    inbox and confirm the row stays Qualified ("An earlier message … contains").
89. For a sender whose preview does not contain the word, confirm the row goes
    to Needs Review. Set "If JoyFox cannot see this" to "Count as not met" and
    confirm the row goes to Quarantined.
90. Type an emoji as the text (for example 🦊) and repeat item 87 with a message
    that holds the emoji.

**Result (2026-09-27): passed.** The project owner confirmed items 86 to 90
(item 90 in the second run the same day).

## German and English UI (ADR 0014)

91. In a Firefox profile where no JoyFox language was picked yet, set Firefox to
    German (`about:preferences`, Language) and open the options page. Confirm it
    shows German ("Erste Schritte", "Konten") and "Sprache / Language" shows
    "Deutsch". Set Firefox to English and confirm the page shows English after a
    reload.
92. On the options page, choose "English" in "Sprache / Language", then
    "Deutsch". Confirm every tab, heading, button and hint changes at once, with
    no reload, and that the toggle's own label stays "Sprache / Language".
    Confirm typed but unsaved text in "Konto hinzufügen", a template and a rule
    number stays after each switch.
93. Keep a ClubMail inbox and a conversation open in other tabs. Switch the
    language on the options page. Confirm the JoyFox tab bar, the badges, the
    "Warum" panel, the member bar, the note editor and the "Ignorieren und
    löschen" notice change at once. Confirm text typed in an open note editor
    stays.
94. On an installation upgraded from a build before this change, with a sender
    you moved by hand, open the "Warum" panel in German. Confirm it says "Du
    hast diese Person nach „…“ verschoben." and that the sender is still in the
    placement you chose.
95. In German, open the "Warum" panel of a sender you moved by hand. Confirm the
    date shows as `TT.MM.JJJJ` (for example 25.09.2026), and in English as "Sep
    25, 2026".
96. In German, on "Konten", choose a file that is not a JoyFox export. Confirm
    the error is German and ends "Es wurde nichts importiert."
97. In German, look at every tab and every JoyFox element on JoyClub. Confirm no
    English text is left, except brand names (JoyFox, JoyClub, JOYCE, ClubMail)
    and your own data. Confirm "Profil ignorieren" and "In den Papierkorb
    schieben" match JoyClub's own labels.

**Result (2026-09-25): passed.** The project owner confirmed items 91 to 97 on
the build of commit 1f1f5f7, with the upgrade in item 94 from the build of main
at dbba25a (database version 3).

## M9 review follow-ups (ADR 0011, 2026-09-25)

Set up as for the M9 matrix above: the flag on, the split view, a test
conversation you mean to trash, with a member you are willing to ignore.

98. Click "Ignore and Delete", and press `Esc` (or the Stop button) as soon as
    the conversation leaves the list, before the profile opens. Wait 15 seconds.
    Confirm the JoyFox notice on the conversation page says "JoyFox could not
    move on to the member's profile, so it stopped before Ignore." and "Delete:
    done.", and the ActionLog ends `DeleteConfirmed`, `Failed:handoff-failed`.
    Then open the member's profile in the same tab. Confirm JoyFox shows no
    notice there and the member is not ignored. If the profile opens too quickly
    to cancel, record the item as not reproducible live; the synthetic test
    "withdraws the hand-off when the page is not left for the profile" covers
    it.
99. Repeat item 43 on another test conversation. Confirm the run still finishes
    on the profile ("Ignore and Delete finished."), so the new check of the
    sending page does not refuse the normal hand-off.
100.  Click "Ignore and Delete", and press `Esc` as soon as the conversation
      leaves the list. Within 15 seconds, open the inbox with a full page load
      (for example, type the ClubMail address and press Enter). Confirm the
      ActionLog ends `DeleteConfirmed`, `Failed:handoff-failed`. Then open the
      member's profile in the same tab. Confirm the member is not ignored. If
      the profile opens too quickly to cancel, record the item as not
      reproducible live; the synthetic test "drops a hand-off when another page
      loads in the tab first" covers it.

**Result, items 98 and 100 (2026-09-25): accepted as not reproducible by hand.**
The project owner judged that the move to the profile (about 1.7 seconds in
item 43) is too fast to cancel on purpose. Both rest on synthetic tests in
`tests/integration/quick-action.test.ts`: item 98 on "withdraws the hand-off
when the page is not left for the profile", item 100 on "drops a hand-off when
another page loads in the tab first". This matches items 44, 45, 47 and 50. Item
99, a normal run, is still pending: it is the only live check that the
sending-page check does not refuse the normal hand-off.

**Item 99 (2026-09-27): failed; fixed, to be re-tested.** With the switch on,
Delete worked, but the ActionLog ended `DeleteConfirmed`,
`Failed:handoff-failed`, and the member was not ignored. The background resumed
only on a page whose path matched the stored profile path character for
character, and JoyClub's profile can carry another spelling of the nickname slug
than the conversation header's link. It now compares the member ID in the path.
A second fault would have followed: the profile holds its menu three times, two
copies hidden (`profile-header-small__context-menu`, one without a class, and
`profile-container__context-menu-desktop` shown), and the driver took the first.
It now takes the shown one.

**Item 99, second run (2026-09-27): failed again; fixed, to be re-tested.** The
same end, `Failed:handoff-failed`, with the notice still on the conversation
page: the tab never left for the profile. The background refused the hand-off:
its check of the sending page read `sender.url`, the address the content script
started on. JoyClub opens a conversation from the inbox in place
(`09-navigation.md`), so that address was still the inbox. The check now reads
the tab's current address from the browser.

**Item 99, third run (2026-09-27): passed.** With PRs #82 and #83, the owner
opened a test conversation from the inbox list and clicked "Ignore and Delete":
the conversation went to the trash, the tab moved to the member's profile, the
member was ignored, and the run ended "Ignore and Delete finished." with the
ActionLog ending `Completed`. This is the live check that the sending-page check
does not refuse the normal hand-off.

## Readable records in "Your data" (V1-7)

101. On "Your data", click "Show" for "Message templates" and open the template
     from item 27. Confirm each field shows as its stored name and a readable
     value: `name` and `body` as plain text (with the umlaut, the emoji and both
     lines), and `createdAt` and `updatedAt` as a date and time ending in "UTC".
     Open "Stored JSON" under the fields and confirm it shows the same record as
     JSON.
102. Show "Contact rules" (or any record with nested values). Confirm lists show
     as bullet points and nested values as indented fields, and that an empty
     value reads "(empty)". Switch the language to German and confirm yes or no
     values read "ja" or "nein" and numbers use German separators.

**Result (2026-09-27): passed.** The project owner confirmed items 101 and 102.

## Profile snapshot history setting (V1-12)

103. On "Your data", confirm "Profile snapshots kept per member" shows 20 and
     its explanation. Open a test member's profile page several times after
     their profile facts changed (or import a file with several snapshots of one
     member), and note the "Profile snapshots" count.
104. Set the number to 1 and click "Save". Confirm the message says how many
     older snapshots were deleted, the "Profile snapshots" count drops to one
     per member, and the member's triage still shows their latest facts. Set it
     back to 20 and confirm the message says no snapshot needed deleting. Enter
     0 and confirm the error says nothing was changed.

**Result (2026-09-27): passed.** The project owner confirmed items 103 and 104.

## Rule presets (V1-11)

105. On the contact rule, with no rule saved, open "Start from a preset" and
     choose each preset in turn. Confirm the line under it says what the preset
     sets, and that nothing is saved yet ("No rule is saved" stays). Choose
     "High-trust members" and click "Apply preset". Confirm the message says it
     was applied and saved, and the Simple editor shows "Verified by JoyClub",
     "Minimum photos" 3, "Minimum profile words" 50 and "Minimum account age in
     days" 180 ticked in the ALL box, each with "Send to Needs Review", and
     "Minimum local trust score" not ticked. Confirm an open JoyClub inbox tab
     sorts again at once.
106. Change "Minimum photos" to 5 and leave the field. Confirm "Rule saved".
     Choose "Complete profiles only" and click "Apply preset". Confirm the
     button turns to "Replace conditions" and nothing changes yet; click it and
     confirm the editor shows only 3 photos and 50 words. Confirm the "Sort my
     JoyClub inbox" box and the placement choice kept their values.
107. Apply "Open" (click twice) and confirm the message says every sender
     qualifies and the editor shows no ticked box. Apply "Custom" and confirm
     the editor stays empty and the focus is on the first box to tick. Switch
     the language to German and confirm the preset names and texts are German.

**Result (2026-09-27): passed.** The project owner confirmed items 105 to 107.

## Saved searches (V1-3)

108. Open JoyClub's member search ("Mitglieder"). Confirm a "JoyFox saved
     searches" box appears above the results, saying "No saved searches yet."
     Apply one or two filters with "Anwenden", click "Save this search", type a
     name and press Enter. Confirm the message says it was saved and a button
     with that name appears.
109. Running a saved search (the acceptance check for V1-3). Change the filters
     with "Anwenden", so JoyClub's stored filters differ from the saved ones.
     Then click the saved search's button. Confirm the page loads, JoyFox opens
     JoyClub's filter panel and clicks "Anwenden" once, and the results then
     match the saved filters (open the filter panel to check them). The address
     bar must not end in `#joyfox-run-search`. Reload the page and confirm
     JoyFox clicks nothing this time. On the saved search's own results page,
     change a filter in the panel without clicking "Anwenden", then click the
     saved search again: confirm the page reloads and the results match the
     saved filters, not the change. Paste the results address with
     `#joyfox-run-search` added into a new tab and confirm JoyFox clicks
     nothing. If JoyFox says it could not run the search, click "Anwenden"
     yourself and record it. Open the search in a second tab and confirm the
     saved search is listed there too.
110. Click ✕ beside the saved search. Confirm nothing is deleted and the message
     asks you to click again. Click ✕ again and confirm the search is gone. Open
     the inbox and a profile, and confirm the box appears only on the search
     page. Switch the language to German and confirm the box is German.

**Result (2026-09-27): passed.** The project owner confirmed items 108 to 110.
Item 109 first failed: the address filled JoyClub's filter panel, but the
results followed the filters stored on the account. With PR #70 (JoyFox clicks
"Anwenden" once after the user clicks a saved search) it passed.

## Event tracker (V1-5)

111. Open an event page on JoyClub. Confirm a "JoyFox: my notes on this event"
     box appears after the event's date and place, with "My attendance", "My
     note" and "My tags". Set attendance to "Attending", type a note and click
     "Save note", and add a tag. Confirm each says "Saved." and that JoyClub's
     own "Anmelden" and "Event merken" did not change.
112. Reload the page and confirm the attendance, note and tag are still shown.
     Open the event's venue page and confirm a venue box with a note and tags,
     but no attendance.
113. Open "Dates & Events" and find the event in the list. Confirm it shows a
     JoyFox badge with "Attending", the tag and "note". Choose "Only my tag:
     <tag>" in "JoyFox: show" and confirm only matching events stay, with a line
     saying how many are shown. Scroll to load more and confirm new items follow
     the filter. Choose "All loaded events and dates" and confirm the list is
     back as JoyClub showed it.
114. Open the JoyFox options, tab "Events". Confirm the event is listed with its
     date, title, venue, attendance, tags and note, and the venue under "My
     venues". Try the filter and the search.
115. Clear the note (save it empty), remove the tag and set "No status". Confirm
     the message says JoyFox no longer tracks it, and the event leaves "Events".
     After an event you tracked has passed, confirm it stays in "Events" marked
     "(past)". Switch the language to German and confirm every box is German.

**Result (2026-09-27): passed.** The project owner confirmed items 111 to 115.
Finding: the attendance list's open options were unreadable on JoyClub's dark
theme (light text on Firefox's white list); fixed in PR #77 and re-checked live
the same day (passed).

## Compatibility Overlay (V1-2)

116. Open your own JoyClub profile. Confirm a "Shared preferences" section in
     the JoyFox strip says "This is your profile" and gives the number of your
     positive preferences. Count the tags under Unbedingt, Steh ich drauf,
     Situationsabhängig and Möchte ich gerne ausprobieren by hand and confirm
     the number matches.
117. Open another member's profile. Confirm the section lists the shared
     preferences and that JoyClub's checklist frames exactly those tags. Check
     both checklists by hand: every framed tag is at a positive level on both,
     and no other tag is at a positive level on both (PRD 6.2). On a couple
     profile, a tag counts when either partner has it at a positive level.
118. Open the member search. For the member from item 117, confirm the card
     shows "N shared" with the same N as the profile page. Confirm a member
     whose profile you never opened shows no count. Open the inbox and an
     event's guest list ("Gäste") with that member and confirm the same N.
119. On the member search, open two members with different numbers of shared
     preferences first, then click "Sort by shared preferences". Confirm the
     loaded results are ordered by that number, most first, and members with no
     count come last. Scroll to load more and confirm they follow. Click again
     and confirm JoyClub's order is back. If JoyFox says the list cannot be
     sorted, note it: the list's layout needs a new capture.
120. Switch the language to German and confirm "N gemeinsam" and a German
     section. Switch the active account and confirm every count disappears.

**Result (2026-09-27): passed.** The project owner confirmed items 116 to 120,
after the member strip fix (PRs #72 and #73).

## Conversation History Search (V1-4)

121. Open the JoyFox options, tab "Messages". Confirm "Store the messages I open
     in ClubMail" is ticked and "Keep messages for (months)" shows 12. Open a
     ClubMail conversation with a few sent and received messages, then search
     "Messages" for a word from one of them. Confirm every message with that
     word is listed, marked, with "Member <ID> to you" or "You to member <ID>"
     and the time, and no message without it.
122. Reload the conversation and search again. Confirm no message is listed
     twice. Search a word with different capital letters and extra spaces and
     confirm the same results.
123. Untick the switch and confirm "Message storing is off." Open another
     conversation, then search a word from it and confirm nothing is found. Tick
     it again.
124. Set "Keep messages for (months)" to 1 and save. Confirm the message says
     how many older messages were deleted. Under "Your data", show "Stored
     messages (for search)" and delete one; confirm search no longer finds it.
     Switch the language to German and confirm the tab is German.

**Result (2026-09-27): passed.** The project owner confirmed items 121 to 124.

## Profile signals on cards (V1-10)

125. Open a member's profile and note the "Profile completeness" line in the
     JoyFox strip (state, photos, words, verification) and the trust score in
     the member panel. Open the member search, the inbox and an event's guest
     list ("Gäste") where the member appears. Confirm each shows the same
     completeness text, the same trust score and the same tags. On a card, each
     chip shows a short text; hover over it to read the full text.
126. On a search result, click the note button "✎", add a tag and close the
     panel. Confirm the tag shows on the card. Open an event's guest list with
     that member and confirm the tag shows there too.
127. On a guest-list entry, open the note with "✎", type a note and save, then
     change it and save again, and add a tag. Open the member's profile and
     confirm the editor there shows the changed note and the tag.
128. On the member search, with one loaded result below 3 photos or 50 words
     (profile opened before), one at or above both, and one never opened, tick
     "JoyFox: hide incomplete profiles". Confirm only the first is hidden, the
     line says how many, and the one never opened stays, marked "Completeness
     unknown". Untick and confirm all are back. Switch the language to German
     and confirm the texts are German.

**Result (2026-09-27): passed.** The project owner confirmed items 125 to 128.
Before they passed, the live checks found and PRs #73 to #76 fixed: the inbox
chips pushing out the sender's name, the guest-list chips clipped to a line, the
search chips covered by the next row, and the verification reading (codes `0`
and `1`, the green shield, and the profile's sidebar badge). Item 126: the chips
show over the search result's photo, but a click on "✎" opened the profile, so
no note could be added from the search. With PR #77 item 126 passed in the
second run the same day.

## Shared-event exception (V1-13)

129. Track an event (set "Attending"), then open its "Gäste" tab. In the JoyFox
     options, tab "Events", confirm the event shows "N guests stored". Open the
     profile of one guest and confirm a "Shared events" section names the event.
130. Confirm "Shared-event exception" on the "Events" tab is off. With a contact
     rule that places that guest in Needs Review or Quarantined, open the inbox
     or a conversation with them and confirm the rule's placement.
131. Turn the exception on. Confirm the guest is now Qualified, the bar says
     "(shared event)", and the "Why" panel names the event. Click "Don't use the
     shared event for this sender" and confirm the rule's placement is back.
132. Clear the event's notes so it is no longer tracked. Confirm "Shared events"
     is gone from the guest's profile. Switch the language to German and confirm
     the texts are German.

**Result (2026-09-27): passed.** The project owner confirmed items 129 to 132
(130 and 131 in the last run the same day).

## Ignore and Delete switch (2026-09-27)

133. Open the JoyFox options page, tab "Contact rule". Confirm "Ignore and
     Delete" shows a switch, unticked on a fresh profile. Keep a ClubMail
     conversation open in another tab. Tick the switch: confirm "Saved." and
     that the "Ignore and Delete" button appears in the conversation's JoyFox
     strip without a reload. Untick it: confirm the button goes. Switch the
     language to German and confirm the texts are German. Do not click the
     button unless you mean to trash the conversation and ignore the member.

**Result (2026-09-27): passed.** The project owner confirmed item 133.

## Member nicknames (2026-09-27)

134. Open ClubMail, a member search and an event's guest list. Then open the
     JoyFox options, tab "Messages", and search: confirm each result names the
     other member by nickname. Open the note editor ("✎") on a card: confirm its
     title names the member. Open "Your data" and show "Members": confirm each
     record line starts with the nickname. Switch the language to German and
     confirm the texts are German.

**Result (2026-09-27): passed.** The project owner confirmed item 134 and the
German texts.

## Public release (V1-9, 2026-09-28)

Do these after the one-time setup in `release.md`.

135. Run the "Release" workflow (Actions > Release > Run workflow, on `main`).
     Confirm it ends green, and that its summary shows an `update_link` and an
     `update_hash`. Confirm a draft release `v1.0.0` exists with
     `joyfox-1.0.0.xpi`, `joyfox-1.0.0-source.zip` and notes whose "Disclaimer"
     matches the README's. If signing times out, follow `release.md`, step 3,
     and note it here.
136. First export your data under "Your data" in the JoyFox options. On release
     Firefox (not Developer Edition or Nightly), remove the temporary
     development build, then install `joyfox-1.0.0.xpi` from the draft
     (`about:addons` > gear menu > "Install Add-on From File"). Confirm Firefox
     accepts it without a signature warning, the options page opens, and
     `about:addons` shows JoyFox 1.0.0. Open a JoyClub inbox and confirm the
     JoyFox badges appear. If your records are missing, import the export.
137. On a computer with Node.js 22 or 24: download the source package from the
     draft, unpack it, run `npm ci` and `npm run build:firefox`, unpack the
     `.xpi` and run `diff -r --exclude=META-INF <unpacked xpi> dist/firefox`
     (README, "Verify a release"). Confirm there is no output.
138. Publish the release. Confirm the repository is public and that the release
     page and its files open in a private window (not signed in to GitHub). Then
     send the `update_link` and `update_hash` so the `updates.json` PR can add
     1.0.0.

## UX audit fixes (2026-09-28)

These items check the changes from the UX audit (`docs/ux-audit.md`). Where an
item changes what an earlier item expects, it names that item; the earlier
result stays as recorded.

139. Click the JoyFox button in the Firefox toolbar, or in the Extensions menu
     until you pin it. Confirm the options page opens.
140. In `about:addons` > JoyFox > Permissions, turn off access to joyclub.de.
     Reload the options page. Confirm "Get started" first shows "Allow JoyFox to
     access joyclub.de", says four steps and does not say "JoyFox is set up".
     Click the button and refuse Firefox's prompt: confirm the page says access
     is still off. Click again and allow: confirm the step goes.
141. With no account (a fresh profile, or after item 35), open the ClubMail
     inbox and a conversation. Confirm the inbox shows one line, "JoyFox has no
     active account, so it does not sort this inbox.", with "Open JoyFox
     options", that the conversation's JoyFox strip shows a similar line, and
     that no row is labelled or hidden. This replaces item 35's "no JoyFox UI".
     Click "Open JoyFox options" and confirm the options page opens.
142. Add an account but no rule. Confirm the inbox line says that no contact
     rule is saved. Save a rule and confirm the tab bar replaces the line
     without a reload. Turn the rule off and confirm the inbox shows nothing
     from JoyFox.
143. On "Accounts", confirm a hint under each field. Add an account and confirm
     the list shows "Label (identifier)". Click "Add account" twice quickly and
     confirm one account and no red alert.
144. Click "Rename", type a new label and press Enter. Confirm the list shows it
     and an export keeps the identifier. Open "Rename" again and press Escape:
     nothing changes.
145. With two accounts, remove the active one. Confirm the prompt names
     everything that is deleted, that the status then says no account is active,
     and that "Get started" asks you to choose the active account.
146. In the Simple editor, tick "Minimum photos" with an empty field. Confirm it
     fills 3, saves, moves focus to the number and shows no error. Tick "First
     message contains": confirm focus moves to its text field, a hint shows and
     nothing is saved until you type. This changes item 57.
147. Type -5 in "Minimum photos" and press Tab. Confirm the field is marked, a
     short error shows beside it and the status at the top of the form says the
     rule was not saved. Type 3 and confirm the mark goes.
148. Confirm the autosave hint and the status line are at the top of the form,
     and that the fields of unticked rows are greyed out.
149. With no condition ticked, change "A sender who does not meet the rule goes
     to". Confirm the status says every sender qualifies, and "Get started" says
     "Done: no conditions, so every sender qualifies."
150. Confirm "Not flagged as template spam" says "(not checked yet: always
     unknown)" in the Simple and the Advanced editor.
151. Click "Delete whole contact rule". Confirm it asks first, with a prompt
     under the button, and that a double-click does not delete. Click again and
     confirm the rule is deleted. This changes item 56.
152. In the Advanced editor, confirm "Group 1", "+ Add group" and "Remove
     group", and that "Remove group" on a group with conditions asks first. On
     the inbox, confirm the "Why and move" reasons start with "Group 1:". This
     changes the wording in items 75 to 80, and "Why" becomes "Why and move" in
     items 87 and 131.
153. Press Tab to reach "Simple" and "Advanced". Confirm a visible focus ring in
     the light and the dark theme.
154. On "Messages", change "Keep messages for (months)" from 12 to 1 and click
     Save. Confirm nothing is deleted yet, the button says "Save and delete" and
     the message names 1 month. Click again and confirm the older messages are
     deleted. Confirm a higher number saves with one click. On "Your data", do
     the same with "Profile snapshots kept per member" (20 to 5). This changes
     item 124.
155. Confirm the "Ignore and Delete" switch's hint names the account risk, the
     undo steps (JoyClub's trash and "Profil nicht mehr ignorieren") and the
     "Action log". This adds to item 133.
156. On "Your data", confirm "To import a file, go to Accounts." switches to the
     Accounts tab and moves focus to it. Confirm records with a name (a
     template, a saved search, an event) show the name first. After a Quick
     Ignore and Delete run, open its "Action log" record and confirm a plain
     report shows above the fields.
157. On the inbox, choose "Quarantined" and reload: confirm the view stays. With
     the keyboard only, open "Why and move" on a row's badge, move the sender
     and press "Close": confirm focus is back on that row's badge.
158. Double-click "Positive" and confirm the trust score rises by 1. With at
     least two outcomes logged, double-click "Undo" and confirm only one goes.
     Open your own profile and confirm the strip shows no placement, no "Log"
     buttons and no note editor, while the shared-preferences section stays. On
     another profile, confirm the shared-preferences list opens only with "Show
     the shared preferences". This changes item 117.
159. With "Ignore and Delete" on, make the window so narrow that the ClubMail
     list is hidden. Confirm the line "Works only while this conversation shows
     in the ClubMail list beside it. Widen the window, or scroll the list until
     the conversation shows." under the button. In a run, confirm the profile
     page shows "Waiting for JoyClub's profile menu…" until Ignore starts, and
     that the finished report says how to undo. This changes the report texts in
     items 44 and 45.
160. With the keyboard only, press Enter on a card's "✎". Confirm focus is in
     the note box. Type a tag and press Enter: it is added. Press Escape: focus
     is back on "✎". Type a change and click "Discard my changes": the stored
     note shows again. Add a tag the member already has: "Already tagged."
161. Open an event you do not track. Confirm the JoyFox box is closed and says
     "(none yet)", and that the first save says "Saved. JoyFox now tracks this
     event." On "Dates & Events", choose "Only events you attend", use a JoyClub
     quick filter and confirm the choice stays. Confirm the Events tab says
     "Your venues" and that a venue box also stays closed until the venue is
     tracked. This changes items 111 to 115.
162. Click a saved search. Confirm the bar says "Running "<name>"…", then
     "Showing "<name>".", and that the button is marked as the current search.
     Change a filter with JoyClub's own panel and confirm the "Showing" notice
     goes. This adds to item 109.
163. Insert a template longer than the message field allows. Confirm the notice
     says how many characters are too many.
164. On JoyClub's light and dark theme, confirm the placement pill, the "JoyFox"
     label and error texts are easy to read.
165. Paste more than 4,000 characters into a note. Confirm the counter and the
     notice that the rest was not pasted.
166. Switch the language to German and repeat items 141, 146, 151, 154 and 160.
     Confirm every new text is German.
