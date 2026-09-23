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
15. Confirm a data export reports schema version 2 and includes the message
    observation and sender override collections.
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
20. In "Contact rule", tick "Personally known" in the ALL box, keep
    "Quarantined", and save. Confirm the message "Rule saved".
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
26. In the options page, untick "Sort my JoyClub inbox with this rule" and save.
    Confirm the inbox tab bar, badges and hidden rows disappear.

**Result (2026-09-23): passed, with one finding.** The project owner ran items
19 to 26 on the PR #14 build. Every item was confirmed, including item 23 (a
badge click did not open the conversation) and item 24 (scrolling and row clicks
unchanged).

- Finding: JoyClub keeps the conversation list on screen beside an open
  conversation. After opening and answering a message, the tab bar was gone from
  that list until a reload or a click on "Postfach". Inbox triage now stays on
  for a conversation page while the list is visible there, and still turns off
  when the list is kept in the page but hidden. The fix needs a re-check: open a
  conversation from the inbox, answer it, and confirm the tab bar and badges
  stay on the list.

Live selector and action acceptance must wait for the evidence checklist in
`manual-verification-needed.md`. Never perform destructive action testing
automatically.
