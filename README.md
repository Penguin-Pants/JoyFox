# JoyFox

JoyFox is a local-first Firefox extension that enhances pages a user opens on
JoyClub. It does not fetch profiles or call undocumented APIs. It works on the
inbox, conversation and profile pages of www.joyclub.de, whose selectors are
verified from live evidence (`docs/selector-map.md`). Search, events and JOYCE
are not verified yet, and JoyFox stays inactive there.

## Development

Requires Node.js 22 and npm.

- `npm ci` installs the locked dependencies.
- `npm test` runs unit and synthetic-DOM integration tests.
- `npm run lint` checks source rules and the permission allowlist.
- `npm run format:check` checks formatting.
- `npm run typecheck` checks TypeScript.
- `npm run build:firefox` creates the deterministic unpacked build in
  `dist/firefox`.

## Install

- **For development:** run `npm run build:firefox`, then load
  `dist/firefox/manifest.json` from `about:debugging` > "This Firefox" > "Load
  Temporary Add-on". Firefox removes it when it closes.
- **A signed release:** download the `.xpi` from the GitHub release and open it
  in Firefox (`about:addons` > gear menu > "Install Add-on From File"). Release
  Firefox installs only signed builds; `docs/distribution.md` describes how a
  release is signed.

The extension ID is `joyfox@drclaw`. Firefox keeps an extension's data under its
ID, so a build with a different ID starts empty: export your data under "Your
data" first and import it afterwards.

## Verify a release

The build is deterministic: the same source and the same locked dependencies
give byte-identical files. To check that a release `.xpi` matches its source:

1. Check out the release tag and run `npm ci`, then `npm run build:firefox`
   (Node.js 22).
2. Unpack the `.xpi` (it is a ZIP file), for example
   `unzip joyfox.xpi -d release`.
3. Run `diff -r --exclude=META-INF release dist/firefox`. No output means the
   release holds exactly the files built from the source. `META-INF` holds only
   the signature that Mozilla's signing adds.

## Features

The database is at schema version 4. An existing version 1, 2 or 3 installation
upgrades in place and keeps its records.

JoyFox shows its own text in German or English. It follows the Firefox language
until you pick one with "Sprache / Language" at the top of the options page, and
open JoyClub tabs switch at once (ADR 0014, `docs/manual-acceptance.md`, items
91 to 97).

On a fresh install the options page opens once, and "Get started" at its top
lists the three steps to a triaged inbox. The options page holds the account
switcher. JoyFox cannot detect which JoyClub login a tab uses, so the active
account is the one selected there, and every stored note, tag and rule belongs
to it. A private note and tags can be kept for a member on their profile page
and in a conversation with them, below the JoyFox panel. They are stored only
for a verified member ID, never a display name. See `docs/manual-acceptance.md`,
items 36 to 42.

The options page also holds message templates and "Your data", where every
stored record can be inspected field by field, exported as JSON and deleted, per
account or for the whole extension. It also sets how many profile snapshots
JoyFox keeps per member (20 by default). A "JoyFox templates" button below
JoyClub's message box inserts a template at the cursor; it never sends. See
`docs/manual-acceptance.md`, items 27 to 35.

Quick Ignore and Delete (M9) has its state machine, ActionLog and on-screen
notice. Its live driver follows F7's evidence: Delete on the conversation page,
then Ignore on the member's profile in the same tab (ADR 0011). It stays off
unless `joyfox.quickIgnoreDelete` is set to `true`. The manual matrix
(`docs/manual-acceptance.md`, items 43 to 54) was accepted on 2026-09-25. If the
move to the profile is cancelled, the conversation page withdraws the hand-off
after 15 seconds and says Ignore was not done (item 98). If another JoyClub page
loads in the tab first, that page drops the hand-off at once (item 100). Both
are covered by synthetic tests; item 99, a normal run, checks the hand-off live.

## License

JoyFox is free software under the GNU General Public License, version 3 or (at
your option) any later version (`GPL-3.0-or-later`). See `LICENSE`.
