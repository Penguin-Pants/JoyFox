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
