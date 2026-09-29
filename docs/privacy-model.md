# Privacy model

JoyFox is local-first. It reads only the current DOM on a page the user opened
and locally stored observations from such pages. It does not crawl, open
profiles automatically, call JoyClub APIs, load remote code, use remote fonts,
send telemetry, or log sensitive content.

All persisted records are isolated by extension account. Missing observations
remain unknown. The passphrase used by the encryption proof of concept exists
only as a function input and is neither returned nor persisted. No sync
transport exists in this milestone.

Synthetic tests use invented names and text only. No real member information or
captured page is committed.

Notes and tags describe an identifiable third party, so they are written only
when a stable member identity is available: the verified numeric member ID from
the profile URL or the conversation header. On any other page the editor does
not appear, and the service refuses a write without a resolved identity. Nothing
is stored from a display name. The editor says the note is private and stored
only in this browser, and sets note and tag text as text, never as markup. While
the editor is shown, its text is part of the JoyClub page's document, so the
editor does not claim that JoyClub cannot see it.

The template spam detector stores the normalized form of messages the user
already had on screen, never the original text, and purges them on the 12-month
window PRD Section 13.3 sets. Its explanations name what matched and how
closely, never the message text, so an explanation stays safe to show and safe
to log. Comparison is local and deterministic, with no model and no network.

Removing an account from the options page deletes every record in that scope and
clears the active-account pointer first, so an interrupted removal cannot leave
the extension active on a half-removed scope.

On verified JoyClub pages the content script reads member IDs, badge codes,
photo counts and word counts. The nickname a card shows (the inbox sender name,
a search result's name, a guest-list entry's name) is never used as an identity
and never logged. Since 2026-09-27 it is stored, by the owner's decision, so
JoyFox's own texts can name a member instead of a number (see "Member nicknames"
below). The optional development diagnostics log counts, the page type, its
detection state and the inbox list state, never a URL, name, ID or message.

Milestone C adds local triage. When an account is active, opening a profile page
stores a snapshot of its counts, codes and join dates, never its text. Since
V1-10 it also keeps one record per member while you have marked that member as
met in person, for card signals only. Logged trust outcomes and manual
placements are stored per account and per member ID. The trust score uses only
this browser's own records; nothing is shared with other members or sent
anywhere. Triage changes only what the user's own inbox shows: it never deletes,
archives, sends or changes anything on JoyClub. The sender name appears in the
"Details" panel as JoyClub shows it and is never logged. "Mark qualified" and
"Mark as junk" store the user's own placement and log one trust outcome
(Positive or Negative) in this browser; only "Mark as junk" on a conversation
page also moves the conversation to JoyClub's trash (see below).

The Compatibility Overlay (V1-2) reads a profile's "Vorlieben" checklist and
stores, with the profile's snapshot, the labels of the tags it lists at a
positive level. Tags at "Mag ich nicht so" or "Geht gar nicht" are not stored.
The viewer's own profile is recognized by the "Account" headline only it shows,
and its snapshot is marked as the viewer's own. These labels are
special-category data (PRD Section 13.1): they stay in this browser, follow the
snapshot history limit (V1-12), are exported and deleted with the other
snapshots, and are never logged. JoyFox shows how many tags two profiles share,
never a percentage.

Milestone D adds user control. The options page shows every stored record as
text, per account and per data type, and deletes one record, one data type, one
account's data or everything. "Delete all JoyFox data" empties every store and
every `storage.local` setting. Exports are files the user saves through the
browser; nothing is uploaded, and no `downloads` permission is used. An export
holds sensitive data (notes, tags, cached normalized messages). The user chooses
where the file goes, and its name never holds an account identifier.

The "First message contains" rule condition (ADR 0013) reads the message preview
on each inbox row, which is the sender's latest message as JoyClub already shows
it. The content script sends the preview to the background with the row's member
ID; the background compares it with the phrases in the user's own rule and drops
it. It is never stored and never logged. When a preview holds a phrase, only
that result is stored: the member ID, the rule's normalized phrase and the time.

The shared-event exception (V1-13, ADR 0016) stores the member IDs a tracked
event's guest list shows, as far as JoyClub has loaded it; JoyFox never clicks
"Mehr Ergebnisse". Which members go to which event is sensitive information
about other people: only member IDs are kept with the event, never names, only
for events the user tracks, and they are deleted when the event is no longer
tracked. The exception is off by default.

Conversation History Search (V1-4, ADR 0016) reads the message bubbles of a
conversation the user opens, sent and received, and stores each message's text
as shown, JoyClub's message ID, the conversation ID, the other member's ID, the
direction and the send time. It is on by default, as PRD Section 13.3 says, and
turned off on the options page ("Messages") or by setting
`joyfox.messageCaching` to `false`; then nothing new is stored. Messages older
than the purge window (12 months by default, 1 to 120,
`joyfox.messageRetentionMonths`) are deleted automatically, and each message can
be seen and deleted under "Your data". The text is special-category data kept
unencrypted in this browser's extension database and in export files; the owner
accepted this with the risk stated. JoyFox reads only what a conversation shows
on screen: it never scrolls, never loads older messages and never logs message
text.

Message templates are the user's own text and are stored per account. The
composer picker is on by default and turned off by setting
`joyfox.templatePicker` to `false` (ADR 0007). It reads the template list from
the background, inserts at the cursor and never reads what the user typed, never
sends and never clicks JoyClub's Send button.

An automated test checks that no source file uses a network API or names a
remote address, and that running every page feature against the synthetic
fixtures makes no request (build plan Section 23).

Apart from running a saved search (below), three conversation actions perform
JoyClub writes, and each only after the user clicks it on a conversation page
(ADR 0017):

- **Delete** moves that conversation to JoyClub's trash. It needs no setting.
- **Mark as junk** (on a conversation page only) stores the Junk placement and a
  Negative outcome, then runs the same Delete. On a profile page and in the
  inbox it clicks nothing on JoyClub.
- **Ignore and Delete** (M9) moves the conversation to JoyClub's trash, opens
  the member's profile in the same tab, and ignores the member there through
  JoyClub's menu and dialog. It is experimental and on by default: the switch on
  the options page's "Contact rule" tab (`joyfox.quickIgnoreDelete`, `false` to
  turn it off) controls only this action.

Each click is recorded in the ActionLog first. The ActionLog holds member and
conversation IDs, the action, step names, times and failure codes, never message
text. For Ignore and Delete, a one-time hand-off marker for the tab (the run's
ID, account, next step and profile path) is kept in `storage.session`, in memory
only, and is removed when the profile page reads it. None of these actions ever
sends a message.

Saved searches (V1-3) click two of JoyClub's controls, and only after the user
clicks a saved search: the filter button, then "Anwenden", once each. JoyClub
then lists the results of the saved filters and stores them on the account, as
it does when the user clicks "Anwenden" (`11-search.md`). JoyFox sets no filter
value itself: the values come from the saved address. The page load carries a
`#joyfox-run-search` fragment, which never reaches JoyClub's server; JoyFox
removes it before the click, so a reload never runs the search again. The click
on the saved search also leaves a record in the tab's own session storage: the
saved address and an expiry one minute later. The next page reads and removes
it, and runs the search only when it names that page. So a link from another
site or a bookmark that carries the fragment never makes JoyFox click. If the
user leaves the page while JoyFox waits for JoyClub's controls, JoyFox clicks
nothing.

Import reads a file the user chooses, in the options page only. Nothing is
fetched or uploaded. The file is checked in full before anything is stored. A
file that fails the check writes nothing. A file that passes is imported as soon
as the user chooses it, with no second confirmation, and the options page then
shows what changed.

## Member nicknames (owner decision, 2026-09-27)

JoyFox's own texts named other members by their member number, which means
nothing to the user. By the owner's decision, JoyFox now keeps each member's
JoyClub nickname, as an inbox row, a search result or a guest-list entry shows
it, with the member record of the active account (`JoyClubMember.nickname`). It
is sent to the background only with the account the page's cards came from, and
refused after an account switch. It is used only to name the member in JoyFox's
own texts: saved-message results, the note editor's title and the record lines
of "Your data". It is never an identity (the member ID is), never logged, and
never leaves the browser except in an export file the user saves. It is
exported, imported and deleted with the other records. When JoyFox has never
seen a member's nickname, its texts show "Member" and the number.

## Page session storage (UX audit, 2026-09-28)

Besides the saved-search run record above, JoyFox keeps three small choices in
the JoyClub tab's own session storage, so they survive JoyClub's full page loads
for that tab: `joyfox.inboxView` (the inbox view, for example "quarantined"),
`joyfox.eventFilter` (the event list filter's kind, for example "attending") and
`joyfox.profileTypeFilter` (the profile types ticked on the "My JOY" lists, for
example `["woman","couple"]`, V1-14). JoyClub's own scripts can read this
storage, so it holds no member data and no text the user typed: a tag filter is
never kept. JoyClub could see which profile types the user filters for. The keys
go when the tab closes; the event filter key is also removed on an account
switch. A tab that the browser duplicates, or that opens from a JoyClub tab,
starts with a copy.

## Private windows (owner decision, 2026-09-28)

Firefox runs an extension in private windows only when the user allows it, and
the default is off. The manifest has no `incognito` key, so once allowed JoyFox
runs there in Firefox's default "spanning" mode. It then stores what it reads in
a private window exactly as in a normal window: message text while message
storing is on, profile facts, nicknames and guest lists. These records go to the
same local database and stay after the private window closes. By the owner's
decision (UX audit, 2026-09-28) this is documented rather than changed: the
README and the options page's "Messages" tab say so, and every such record can
be deleted under "Your data". Notes and tags the user types are stored in both
cases, as the user asked for them.

## Update check (V1-9, ADR 0016)

The manifest's `update_url` makes Firefox itself, not JoyFox, fetch
`updates.json` from raw.githubusercontent.com about once a day. GitHub receives
what any web request carries, such as the IP address and Firefox's user agent.
The request holds no JoyFox data: no account, member, note or setting. The
address has no placeholders, so Firefox adds nothing to it. The update file and
the `.xpi` come from the public repository, and the `.xpi` is checked against
`update_hash`. JoyFox's own code still sends no network request (network
isolation test).
