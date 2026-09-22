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
