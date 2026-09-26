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
photo counts and word counts. The inbox sender name is read for display alone:
it is never used as an identity, never stored and never logged. The optional
development diagnostics log counts, the page type, its detection state and the
inbox list state, never a URL, name, ID or message.

Milestone C adds local triage. When an account is active, opening a profile page
stores a snapshot of its counts, codes and join dates, never its text. Logged
trust outcomes and manual placements are stored per account and per member ID.
The trust score uses only this browser's own records; nothing is shared with
other members or sent anywhere. Triage changes only what the user's own inbox
shows: it never deletes, archives, sends or changes anything on JoyClub. The
sender name appears in the "Why" panel as JoyClub shows it and is never stored
or logged.

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
Conversation message bubbles are never read.

Message templates are the user's own text and are stored per account. The
composer picker is on by default and turned off by setting
`joyfox.templatePicker` to `false` (ADR 0007). It reads the template list from
the background, inserts at the cursor and never reads what the user typed, never
sends and never clicks JoyClub's Send button.

An automated test checks that no source file uses a network API or names a
remote address, and that running every page feature against the synthetic
fixtures makes no request (build plan Section 23).

Quick Ignore and Delete (M9) is the only feature that performs JoyClub writes.
It is off by default: only with `joyfox.quickIgnoreDelete` set to `true`, and
only after the user clicks its button on a conversation, does its live driver
(ADR 0011) click JoyClub's own controls. It moves that conversation to JoyClub's
trash, opens the member's profile in the same tab, and ignores the member there
through JoyClub's menu and dialog. Each click is recorded in the ActionLog
first. The ActionLog holds member and conversation IDs, step names, times and
failure codes, never message text. A one-time hand-off marker for the tab (the
run's ID, account, next step and profile path) is kept in `storage.session`, in
memory only, and is removed when the profile page reads it. M9 never sends a
message.

Import reads a file the user chooses, in the options page only. Nothing is
fetched or uploaded. The file is checked in full before anything is stored. A
file that fails the check writes nothing. A file that passes is imported as soon
as the user chooses it, with no second confirmation, and the options page then
shows what changed.
