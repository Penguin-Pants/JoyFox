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
15. Confirm a data export reports schema version 2 (3 since ADR 0013) and
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

## Onboarding (build plan Section 28, PRD Section 21.1)

55. Use a fresh Firefox profile with no JoyFox data. Start a timer, build and
    load the extension (item 1). Confirm the JoyFox options page opens by itself
    and "Get started" lists three steps, the first two "Not done yet". Follow
    the steps: add your account, save and turn on a contact rule, open your
    JoyClub inbox. Confirm each step changes to "Done" in words, the summary
    says "JoyFox is set up", and the inbox shows JoyFox's tabs. Stop the timer:
    PRD Section 21.1 asks for under 10 minutes. Reload the extension and confirm
    the options page does not open again.

## M9 destructive-action matrix (build plan Section 24)

**Accepted by hand on 2026-09-25 (ADR 0011); results below the table.** Run
these only on test conversations you mean to trash, with members you are willing
to ignore and then un-ignore ("Profil nicht mehr ignorieren" in the profile
menu). Never run them automatically. Use the split view (conversation list on
the left), because Delete is checked by the row leaving the list.

Turn the button on first, from the console of the JoyFox options page:

- Open the JoyFox options page: in `about:addons`, click the "..." next to
  JoyFox, then **Options** (older Firefox: **Preferences**). It opens in its own
  tab, and the address starts with `moz-extension://`.
- In that tab, press `Ctrl+Shift+K` (macOS: `Cmd+Option+K`) to open the Web
  Console.
- Run `browser.storage.local.set({"joyfox.quickIgnoreDelete": true})`. If
  Firefox asks, type `allow pasting` first.
- To check it, run `browser.storage.local.get("joyfox.quickIgnoreDelete")`. The
  result must show `true`. To turn it off again, run the same `set` with
  `false`.
- Reload the JoyClub tab.

Other consoles give "ReferenceError: browser is not defined": a JoyClub page,
the `about:debugging` page itself, and the Inspect toolbox when its console is
not in the extension's own context. Only extension pages, such as the options
page, can use `browser`.

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

| Item | Case                                   | How to cause it                                                                           | Expected ActionLog steps                                                                           | Expected notice                                                                          |
| ---- | -------------------------------------- | ----------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| 43   | 1. Both succeed                        | Normal run                                                                                | `Started`, `DeleteRequested`, `DeleteConfirmed`, `IgnoreRequested`, `IgnoreConfirmed`, `Completed` | On the profile: "Ignore and Delete finished." Conversation in the trash, member ignored. |
| 44   | 2. Delete control missing              | Run where the conversation shows no Delete control                                        | `Started`, `Failed:control-missing`                                                                | "Nothing was changed on JoyClub." Both next actions.                                     |
| 45   | 3. Delete not seen                     | Hide the conversation list (narrow window), or use a conversation whose row is not loaded | `Started`, `Failed:unverifiable`                                                                   | "JoyFox cannot see JoyClub's result for Delete …". Nothing changed.                      |
| 46   | 4. Delete done, Ignore control missing | Use a member you already ignore                                                           | … `DeleteConfirmed`, `Failed:control-missing`                                                      | "Delete: done." "Ignore: not done." "JoyFox did not undo anything."                      |
| 47   | 5. Ignore confirmation fails           | Close JoyClub's Ignore dialog with "Abbrechen" before JoyFox reaches it                   | … `IgnoreRequested`, `Failed:confirmation-missing` (or `not-verified`)                             | "Ignore: not confirmed." The Ignore next action.                                         |
| 48   | 6. Navigation interrupted              | Navigate away or go offline during a step                                                 | Last step before the stop, then `Failed:timeout` or `Failed:identity-unavailable`                  | Names the step that did not complete.                                                    |
| 49   | 7. Tab closed during the action        | Close the tab right after the conversation leaves the list                                | Ends at the last stored step, with no `Failed`                                                     | On reopening the conversation after 2 minutes: "was interrupted".                        |
| 50   | 8. Member identity mismatch            | While the profile loads, open another member's profile in the same tab                    | … `DeleteConfirmed`, then nothing more on that page                                                | Later, on the conversation: "was interrupted". No Ignore click.                          |
| 51   | 9. Conversation identity mismatch      | Switch to another conversation right after clicking                                       | `Started`, `Failed:conversation-mismatch` (or `member-mismatch`)                                   | "The page showed another conversation …". No Delete click.                               |
| 52   | 10. Markup changes between steps       | Reload the profile page while JoyFox waits for its menu                                   | … `DeleteConfirmed`, `Failed:control-missing`, or the run stays at `DeleteConfirmed`               | Names the step and says JoyFox stopped before it, or later "was interrupted".            |
| 53   | 11. Background restarted mid-run       | Click **Terminate background script** in `about:debugging` during the run                 | The full sequence, or the last stored step then `Failed`                                           | Matches the ActionLog. No step is repeated.                                              |
| 54   | 12. Another account activated mid-run  | Switch the JoyFox account in the options page during the run                              | Account A's log ends at its last stored step; account B has no record                              | "The active JoyFox account changed, so JoyFox stopped at …".                             |

**Result, item 43 (2026-09-24): passed.** The project owner ran Ignore and
Delete on a test conversation in the split view. The exported ActionLog shows
`Started`, `DeleteRequested`, `DeleteConfirmed` (0.24 s after the click, the row
left the list), `IgnoreRequested` (1.7 s, after the move to the profile),
`IgnoreConfirmed` (2.6 s) and `Completed`, one operation with the matching
member and conversation. The first attempt had stopped before any click with
"could not find JoyClub's Delete control"; Delete moved to the conversation's
three-dot menu (`live-evidence/10-ignore.md`, eighth report).

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

## Import (2026-09-24)

59. In "Your data", click "Export all JoyFox data (JSON)" and keep the file.
60. In a second Firefox profile (or after "Delete all JoyFox data"), open the
    options page, choose the file under "Import" (on the Accounts tab since
    2026-09-24), and confirm the preview lists what will be added. Confirm
    nothing changed yet, then click "Confirm import". Confirm accounts, rules,
    templates and notes are back, and the active account is set.
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
74. Choose a JoyFox export file there. Confirm the preview, "Confirm import" and
    the result message appear on the Accounts tab, and that the imported
    accounts show in the account list right after the import.

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

**Result:** not yet run.

## German and English UI (ADR 0013)

86. In a Firefox profile where no JoyFox language was picked yet, set Firefox to
    German (`about:preferences`, Language) and open the options page. Confirm it
    shows German ("Erste Schritte", "Konten") and "Sprache / Language" shows
    "Deutsch". Set Firefox to English and confirm the page shows English after a
    reload.
87. On the options page, choose "English" in "Sprache / Language", then
    "Deutsch". Confirm every tab, heading, button and hint changes at once, with
    no reload, and that the toggle's own label stays "Sprache / Language".
    Confirm typed but unsaved text in "Konto hinzufügen", a template and a rule
    number stays after each switch.
88. Keep a ClubMail inbox and a conversation open in other tabs. Switch the
    language on the options page. Confirm the JoyFox tab bar, the badges, the
    "Warum" panel, the member bar, the note editor and the "Ignorieren und
    löschen" notice change at once. Confirm text typed in an open note editor
    stays.
89. On an installation upgraded from a build before this change, with a sender
    you moved by hand, open the "Warum" panel in German. Confirm it says "Du
    hast diese Person nach „…“ verschoben." and that the sender is still in the
    placement you chose.
90. In German, open the "Warum" panel of a sender you moved by hand. Confirm the
    date shows as `TT.MM.JJJJ` (for example 25.09.2026), and in English as "Sep
    25, 2026".
91. In German, on "Konten", choose a file that is not a JoyFox export. Confirm
    the error is German and ends "Es wurde nichts importiert."
92. In German, look at every tab and every JoyFox element on JoyClub. Confirm no
    English text is left, except brand names (JoyFox, JoyClub, JOYCE, ClubMail)
    and your own data. Confirm "Profil ignorieren" and "In den Papierkorb
    schieben" match JoyClub's own labels.

**Result:** not yet run.
