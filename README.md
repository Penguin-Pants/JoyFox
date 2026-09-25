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

The database is at schema version 3. An existing version 1 or 2 installation
upgrades in place and keeps its records.

JoyFox shows its own text in German or English. It follows the Firefox language
until you pick one with "Sprache / Language" at the top of the options page, and
open JoyClub tabs switch at once (ADR 0013, `docs/manual-acceptance.md`, items
86 to 92).

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
notice. Its live driver follows F7's evidence: Delete on the conversation page,
then Ignore on the member's profile in the same tab (ADR 0011). It stays off
unless `joyfox.quickIgnoreDelete` is set to `true`. The manual matrix
(`docs/manual-acceptance.md`, items 43 to 54) was accepted on 2026-09-25.
