# Releasing JoyFox (V1-9)

How to publish a signed, unlisted release on GitHub. The background is in
`distribution.md`; the decisions are in ADR 0016.

## Rules

- **Every release has a higher version than all earlier ones.** Firefox installs
  only an update with a higher version. A fix for a bad release is a new, higher
  version, never an older number again.
- **The version is in two places:** `package.json` (with `package-lock.json`)
  and `manifests/firefox.json`. `npm run lint` checks that they match.
- **Every version needs its release notes** in
  `docs/release-notes/<version>.md`, with the README's "Disclaimer" section word
  for word. `npm run lint` checks this.
- **The `update_url` never changes.** Installed copies cannot find a new one. It
  is `https://raw.githubusercontent.com/Penguin-Pants/JoyFox/main/updates.json`,
  so the repository must stay public and `updates.json` must stay on `main`.
- **Never put the AMO keys in the repository,** a file, a commit, an issue or a
  chat. They live only in the repository's Actions secrets.

## One-time setup (owner)

1. Make the GitHub repository public (Settings > General > Danger Zone > Change
   visibility). Firefox reads `updates.json` without signing in, and the release
   must be public (V1-9).
2. Create an addons.mozilla.org account and accept the developer agreement.
3. On AMO, open "Developer Hub" > "Manage API Keys" and create credentials: a
   "JWT issuer" and a "JWT secret".
4. In GitHub, open Settings > Secrets and variables > Actions and add two
   repository secrets: `AMO_JWT_ISSUER` (the JWT issuer) and `AMO_JWT_SECRET`
   (the JWT secret).

## Each release

1. **Release PR.** Raise the version with
   `npm version <x.y.z> --no-git-tag-version`, set the same `version` in
   `manifests/firefox.json`, and add `docs/release-notes/<x.y.z>.md`. Merge it
   into `main` once CI is green.
2. **Sign.** In GitHub, open Actions > "Release" > "Run workflow" on `main`. The
   workflow:
   - runs every check, builds `dist/firefox` and runs Mozilla's linter;
   - refuses a version that already has a release;
   - makes the source package (`npm run package:source`) and signs the build
     with Mozilla as unlisted, with the source attached;
   - checks that the signed `.xpi` holds exactly the built files, apart from
     `META-INF`;
   - drafts the GitHub release `v<x.y.z>` with the `.xpi`, the source package
     and the release notes. Its summary shows the `update_link` and
     `update_hash`.
3. **If signing times out.** `web-ext` waits 15 minutes. A manual review takes
   longer: the job fails with "Approval: timeout exceeded" and the AMO address
   of the version. Do not run the workflow again for the same version. Once AMO
   approves it, download the signed `.xpi` from that address and continue by
   hand: unpack it and compare it with a build of the same commit (README,
   "Verify a release"), take its hash with `sha256sum`, and draft the release
   with the same files and notes.
4. **Check the draft.** Download the `.xpi` from the draft and install it on
   release Firefox (`about:addons` > gear menu > "Install Add-on From File").
   Confirm that the options page opens and the version is right.
5. **Publish** the draft release.
6. **Update PR.** Add the version to `updates.json`, with the `update_link` and
   `update_hash` from the workflow summary:

   ```json
   {
     "version": "<x.y.z>",
     "update_link": "https://github.com/Penguin-Pants/JoyFox/releases/download/v<x.y.z>/joyfox-<x.y.z>.xpi",
     "update_hash": "sha256:<hash>",
     "applications": { "gecko": { "strict_min_version": "121.0" } }
   }
   ```

   Keep the list in version order. Merge it: from then on, installed copies
   update to this version within 24 hours.

## First update: the redirect check

A GitHub release link redirects to another HTTPS host, and no Mozilla page says
whether Firefox follows that for an `update_link` (`distribution.md`, "Open for
V1-9"). Check it with the first update after 1.0.0:

1. Keep 1.0.0 installed from its release.
2. After step 6 for the new version, open `about:config` and set
   `extensions.update.interval` to `120`, or open `about:addons` > gear menu >
   "Check for Updates".
3. Confirm that `about:addons` shows the new version. Set the interval back
   (reset the preference).

If Firefox does not update, the `update_link` must point to an address without a
redirect. Only `updates.json` changes for that, so the installed copies are not
stuck: the `update_url` stays the same.
