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
when a stable member identity is available. While no member-identifier selector
is verified, every note and tag write is refused and the reason is shown to the
user. Nothing is stored from a display name.

Removing an account from the options page deletes every record in that scope and
clears the active-account pointer first, so an interrupted removal cannot leave
the extension active on a half-removed scope.
