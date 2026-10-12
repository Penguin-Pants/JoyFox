# Releasing JoyFox

How to publish a listed release on addons.mozilla.org (AMO). The background is
in `distribution.md`; the decisions are in ADR 0016 ("AMO listing"). The listing
texts and images are in `amo-listing.md`.

## Rules

- **Every release has a higher version than all earlier ones.** AMO refuses a
  version number it already has, and Firefox installs only an update with a
  higher version. A fix for a bad release is a new, higher version.
- **The version is in three places:** `package.json` (with `package-lock.json`),
  `manifests/firefox.json` and `manifests/chrome.json`. `npm run lint` checks
  that they match.
- **Every version needs its release notes** in
  `docs/release-notes/<version>.md`, with the README's "Disclaimer" section word
  for word. `npm run lint` checks this.
- **No `update_url`.** AMO refuses it for a listed add-on and updates installed
  copies itself. `npm run lint` checks that the Firefox manifest has none.
- **Every version carries its source package** (`npm run package:source`): the
  build is bundled by esbuild (`distribution.md`, "Source code").
- **Never put the AMO keys in the repository,** a file, a commit, an issue or a
  chat. They live only in the repository's Actions secrets.

## One-time setup (owner)

1. Make the GitHub repository public (Settings > General > Danger Zone > Change
   visibility). The listing links to it as homepage, support site and privacy
   policy source.
2. Create an addons.mozilla.org account and accept the developer agreement.
3. On AMO, open "Developer Hub" > "Manage API Keys" and create credentials: a
   "JWT issuer" and a "JWT secret".
4. In GitHub, open Settings > Secrets and variables > Actions and add two
   repository secrets: `AMO_JWT_ISSUER` (the JWT issuer) and `AMO_JWT_SECRET`
   (the JWT secret).

## First listed version (1.0.1): by hand

The add-on `joyfox@drclaw` already exists on AMO with the unlisted version
1.0.0. The first listed version creates its public listing, so it goes through
the AMO web form, which takes the listing texts and images.

1. On a clean checkout of `main`: `npm ci`, `npm run build:firefox`,
   `npm run lint:amo` (no errors), then
   `npx web-ext build --source-dir dist/firefox --artifacts-dir dist --filename joyfox-{version}.zip --overwrite-dest`
   and `npm run package:source`.
2. On AMO, open "Developer Hub" > "My Add-ons" > JoyFox > "Upload New Version",
   choose "On this site" and upload `dist/joyfox-1.0.1.zip`.
3. Fill in every page with the answers in `amo-listing.md`, in its order.
4. After "Submit Version", wait for AMO's email. Then check the listing page
   (`amo-listing.md`, "After approval").

## Later versions: the workflow

1. **Release PR.** Raise the version with
   `npm version <x.y.z> --no-git-tag-version`, set the same `version` in
   `manifests/firefox.json` and `manifests/chrome.json`, and add
   `docs/release-notes/<x.y.z>.md`. Merge it into `main` once CI is green.
2. **Submit.** In GitHub, open Actions > "Release" > "Run workflow" on `main`.
   The workflow:
   - runs every check, builds `dist/firefox` and runs Mozilla's linter;
   - refuses a version that already has a GitHub release;
   - makes the source package and submits the build to AMO as a listed version,
     with the source attached;
   - checks that the signed `.xpi` holds exactly the built files, apart from
     `META-INF`;
   - drafts the GitHub release `v<x.y.z>` with the `.xpi`, the source package
     and the release notes.
3. **If signing times out.** `web-ext` waits 15 minutes. A manual review takes
   longer: the job fails with "Approval: timeout exceeded" and the AMO address
   of the version. Do not run the workflow again for the same version. AMO
   publishes the version once it is approved. To also draft the GitHub release,
   download the signed `.xpi` from that address, compare it with a build of the
   same commit (README, "Verify a release") and draft the release with the same
   files and notes.
4. **Release notes on AMO.** Open the version on AMO ("Manage Status &
   Versions") and paste the "What it does" part of the release notes into its
   release notes field.
5. **Check and publish** the GitHub draft release. Installed copies get the new
   version from AMO within 24 hours.
