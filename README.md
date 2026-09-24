# JoyFox

JoyFox is a local-first Firefox extension foundation for enhancing pages that a
user opens on JoyClub and JOYCE. It does not fetch profiles, call undocumented
APIs, or contain verified site selectors yet.

## Development

Requires Node.js 22 and npm.

- `npm ci` installs the locked dependencies.
- `npm test` runs unit and synthetic-DOM integration tests.
- `npm run lint` checks source rules and the permission allowlist.
- `npm run format:check` checks formatting.
- `npm run typecheck` checks TypeScript.
- `npm run build:firefox` creates the deterministic unpacked build in
  `dist/firefox`.

Load `dist/firefox/manifest.json` temporarily from `about:debugging` for local
development. The extension safely does nothing on JoyClub until selectors have
been manually verified and enabled in source.

The database is at schema version 2. An existing version 1 installation upgrades
in place and keeps its records.

On a fresh install the options page opens once, and "Get started" at its top
lists the three steps to a triaged inbox. The options page holds the account
switcher. JoyFox cannot detect which JoyClub login a tab uses, so the active
account is the one selected there, and every stored note, tag and rule belongs
to it. A private note and tags can be kept for a member on their profile page
and in a conversation with them, below the JoyFox panel. They are stored only
for a verified member ID, never a display name. See `docs/manual-acceptance.md`,
items 36 to 42.

The options page also holds message templates and "Your data", where every
stored record can be inspected, exported as JSON and deleted, per account or for
the whole extension. A "JoyFox templates" button below JoyClub's message box
inserts a template at the cursor; it never sends. See
`docs/manual-acceptance.md`, items 27 to 35.

Quick Ignore and Delete (M9) has its state machine, ActionLog and on-screen
notice, tested with test drivers. It stays off: F7 shows Ignore is only on the
profile page (Path B), but the live driver and the resume after navigation are
not built yet, so no live click path exists and the button never appears. See
ADR 0008 and `docs/live-evidence/10-ignore.md`.
