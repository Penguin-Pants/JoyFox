# Firefox distribution and signing (F8)

## Status

Verified. Research draft from 2026-09-25; items 2 to 4 of the "Verification
checklist" verified on 2026-09-26 with Mozilla's own tools (`web-ext` 10.7.0,
`addons-linter` 10.13.0, `@mdn/browser-compat-data`); items 1, 5 and 6 verified
on 2026-09-28 against the Mozilla web pages, read in a browser for the owner
(see "Checklist results, 2026-09-28"). F8's acceptance criterion ("documented
steps to produce a signed, installable build outside AMO") is met. One question
has no answer on any Mozilla page: whether Firefox follows a redirect from an
`update_link`. V1-9 tests it (see "Open for V1-9").

The owner chose the channel: unlisted, with automatic updates (ADR 0016).

## Channels

| Channel                               | Signed by Mozilla | Where it installs                                     | Updates                              |
| ------------------------------------- | ----------------- | ----------------------------------------------------- | ------------------------------------ |
| Temporary install (`about:debugging`) | No                | Any Firefox, until the browser restarts               | By loading it again                  |
| Unlisted (self-distributed)           | Yes               | Release and Beta Firefox, from a file the owner hosts | Self-hosted `update_url`, or by hand |
| Listed on AMO                         | Yes, after review | Everyone, from addons.mozilla.org                     | AMO                                  |

- Release and Beta Firefox install only signed extensions. ESR, Developer
  Edition, Nightly and unbranded builds can turn this off with the preference
  `xpinstall.signatures.required` set to `false` in `about:config`; the
  extension still needs an ID (Mozilla Support, "Add-on signing in Firefox",
  updated 2026-01-07; Extension Workshop, "Signing and distribution overview").
  Verified 2026-09-28. The draft had left out ESR.
- "Unlisted" add-ons are signed by Mozilla but cannot be found or installed from
  AMO. All add-ons pass automated validation before signing, and any add-on,
  unlisted ones included, can be reviewed by hand at any time after submission.
  Signing can take up to 24 hours, or longer when a submission is picked for
  manual review. A manual review can reject current or earlier versions, or
  block the add-on (Extension Workshop, "Signing and distribution overview").
  Verified 2026-09-28.
- An unlisted add-on can update itself: "If the extension includes an update_url
  in its manifest, Firefox installs any updates with a higher version number
  available on that URL" (Extension Workshop, "Distributing an add-on
  yourself"). Verified 2026-09-28.
- **Every release has a higher version than all earlier ones.** Firefox installs
  only an update with a higher version number, so a reused or lower version
  never reaches a copy that already runs a newer one. A fix for a bad release is
  a new, higher version, never a rollback to an older number.
- PRD Section 20 puts a self-distributed public release in V1 and AMO submission
  in "Later". So the unlisted channel matches the roadmap.

## Steps for an unlisted signed build

1. Create an addons.mozilla.org developer account and accept the developer
   agreement.
2. On AMO's "Manage API Keys" page, create API credentials: a JWT issuer and a
   JWT secret. Keep them out of the repository, shell history and logs.
3. Fix the manifest gaps below.
4. `web-ext` is pinned at 10.7.0 in `devDependencies`, so every release signs
   the same way. `npm run lint:amo` runs Mozilla's validator on `dist/firefox`
   as a self-hosted add-on, and CI runs it after every build.
5. Build: `npm ci`, then `npm run build:firefox`, which writes `dist/firefox`.
6. Make the source package (see "Source code"). Every build is bundled by
   esbuild, so every submission needs it, not only when AMO asks.
7. Sign from `dist/firefox`. Keep the credentials out of the command line, where
   shell history and the process list would show them: put them in the
   environment variables `WEB_EXT_API_KEY` and `WEB_EXT_API_SECRET`, loaded from
   a password manager or a protected prompt, never typed on the command line.
   Then run
   `npx web-ext sign --source-dir dist/firefox --channel=unlisted --upload-source-code <source package>`.
   The signed `.xpi` is downloaded when signing finishes. `web-ext` waits for
   approval for 15 minutes by default (`approvalCheckTimeout` 900000 ms in
   `lib/util/submit-addon.js`), and a manual review can take much longer. When
   the wait runs out, the command stops with "Approval: timeout exceeded" and
   prints the version's AMO edit address; the submission stays with AMO.
   Download the signed `.xpi` from that address once it is approved, and do not
   sign the same version again. `--approval-timeout 0` skips the wait and prints
   the same address at once. Verified in `web-ext` 10.7.0 (`web-ext sign --help`
   and its source): every option also reads a `WEB_EXT_` environment variable
   (`lib/program.js`), `--channel` is required, and `--upload-source-code`
   attaches the source archive. Because the manifest sets an ID, `web-ext`
   submits a version to that ID with the upload's channel
   (`lib/util/submit-addon.js`); with `unlisted` it sends no listing metadata.
   What AMO does on the server side was not checked.
8. Publish the signed `.xpi` on the GitHub release (V1-9).

## Manifest gaps (`manifests/firefox.json`)

- **Extension ID.** Decided (owner, 2026-09-26, ADR 0016):
  `browser_specific_settings.gecko.id` is `joyfox@drclaw`, replacing the
  placeholder `joyfox@example.invalid`. Manifest V3 extensions must set an ID
  for signing; AMO does not assign one (MDN, `browser_specific_settings`). The
  ID is permanent: changing it later makes a new extension with empty storage.
  An installation loaded with the old placeholder ID keeps its data under that
  ID, so export it under "Your data" before switching and import it after.
- **Data collection declaration.** New extensions must declare what data they
  collect in `browser_specific_settings.gecko.data_collection_permissions`
  (since 2025-11-03 for new extensions; Mozilla said it would require it of all
  extensions in the first half of 2026). An extension that collects nothing
  declares `"required": ["none"]`. Without a correct value, AMO refuses to sign
  it. Firefox 140 and later show this at install (Mozilla Add-ons Blog,
  2025-10-23, "Announcing data collection consent changes for new Firefox
  extensions"; Extension Workshop, "Firefox built-in consent for data collection
  and transmission"). JoyFox sends nothing off the device
  (`docs/permissions.md`), so `"none"` matches its design today. **Done
  (2026-09-26):** the manifest declares `{"required": ["none"]}`. The
  `addons-linter` 10.13.0 schema accepts exactly this: `required` is an array of
  at least one value, and `"none"` is allowed. The linter warned
  `MISSING_DATA_COLLECTION_PERMISSIONS` before the change and reports no error
  after it. It still gives 2 warnings: the key works from Firefox 140 (desktop)
  and 142 (Android) (`@mdn/browser-compat-data`), and the minimum is 121. Older
  Firefox skips an unknown key with a warning, so the minimum stays at 121 (PRD
  Section 14.1). Sync (V1-6, deferred by ADR 0016) would send encrypted data to
  the user's own server, so the value must be reviewed before sync ships.
- **Self-hosted updates.** Optional.
  `browser_specific_settings.gecko.update_url` points to an `updates.json` that
  must be served over HTTPS. It is keyed by the extension ID and lists each
  version with its `update_link` (MDN, "Updates"; Extension Workshop, "Updating
  your extension"). The field names are verified (2026-09-28); see "The
  `updates.json` file". Verified with `addons-linter` 10.13.0: a manifest with
  `update_url` passes as a self-hosted add-on and fails with
  `MANIFEST_UPDATE_URL` as an AMO-listed one, so the unlisted channel is the one
  that allows it.
- `strict_min_version` is `121.0`, which the PRD requires (Section 14.1).

## Source code

AMO reviewers must be able to read the code. Bundled, transpiled or minified
code is allowed only with a copy of the original source and instructions to
reproduce the build; obfuscated code is not allowed at all, however the add-on
is distributed (Extension Workshop, "Source code submission"; "Add-on Policies",
updated 2026-04-30). The policies apply to every add-on, "regardless of how they
are distributed", so to unlisted ones too. The source must be attached to
**every** version, and the upload may be at most 200 MB. Verified 2026-09-28.

The build bundles TypeScript with esbuild (`scripts/build-firefox.mjs`), so
every submission needs a source package with:

- the source tree, including `package-lock.json` (the page asks for the
  lockfile, and `npm ci` needs it). The page does not say to leave out
  `node_modules` or build output; JoyFox leaves them out, because `npm ci` and
  the build recreate them. Dependencies may come only from the package in the
  upload or from the official package manager during the build, which `npm ci`
  does. The page names no archive format.
- a README for the reviewer that lists: the operating system used for the build;
  the exact Node.js and npm versions, with links to download and install them;
  every command to build (`npm ci`, then `npm run build:firefox`); and where the
  output goes (`dist/firefox`). Build tools must be open source and must not be
  web-based.

Mozilla's reviewers build on Ubuntu 24.04.4 LTS (ARM64) with Node 24.14.0 and
npm 11.9.0. The README must say where JoyFox's environment differs: CI builds
with Node.js 22 on x86-64 Linux. The lockfile holds esbuild's ARM64 package
(`@esbuild/linux-arm64`), so `npm ci` works on the reviewers' machine.

The build is already deterministic (`README.md`), which makes a reviewer's
rebuild match the submitted file.

## Policy notes

- Add-ons must be self-contained and must not load remote code (Extension
  Workshop, "Add-on Policies"; verified 2026-09-28). JoyFox bundles all its code
  and has no network client (`docs/permissions.md`).
- Personal data may be collected only after explicit consent. The user must get
  a clear way to control data transmission, through the add-on's own consent or
  Firefox's built-in one ("Add-on Policies" 6.2). JoyFox sends no data. The
  policies require testing information and, when any part of the add-on needs an
  account, test credentials ("Add-on Policies" 3). Every JoyFox feature runs on
  JoyClub pages, which need a signed-in account, so each submission must carry
  testing instructions and credentials for a JoyClub account made for reviewers
  (see "Open for V1-9"). No Mozilla policy text found in this pass addresses an
  extension that clicks a site's own controls for the user (M9). That risk stays
  the one the PRD names: JoyClub's terms (PRD Sections 18.3 and 18.4), not
  Mozilla policy. The owner chose no ToS review; the release carries a
  disclaimer instead (D4, ADR 0016).

## Owner decisions

- **Channel:** decided (owner, 2026-09-26, ADR 0016): an unlisted signed build,
  published on the GitHub release (PRD Section 20, V1). An AMO listing stays
  "Later".
- **Extension ID:** decided: `joyfox@drclaw` (ADR 0016).
- **Updates:** decided (owner, 2026-09-26, ADR 0016): automatic, through
  `update_url` and an `updates.json` served over HTTPS from GitHub. The address
  is `https://raw.githubusercontent.com/Penguin-Pants/JoyFox/main/updates.json`
  (owner, 2026-09-26): a file in the repository, updated by each release PR.
  V1-9 adds the file and the manifest key. This address can never change for
  installed copies: "existing installations cannot discover a new update_url on
  their own" (Extension Workshop, "Updating your extension").

## The `updates.json` file

Verified 2026-09-28 (Extension Workshop, "Updating your extension"):

- The top-level key is `addons`, with one entry per extension ID. Each entry
  holds an `updates` list; each item has `version` and `update_link`.
- `update_link` must be an HTTPS address, or `update_hash` must be given.
  `update_hash` is otherwise optional; when present it is `sha256:` or `sha512:`
  followed by the hex hash of the linked file.
- The minimum Firefox version inside an update item is
  `applications.gecko.strict_min_version`. The page names no
  `browser_specific_settings` form there, although the manifest itself uses
  `browser_specific_settings`.
- The file must be served over HTTPS. The page names no content type.
- Firefox checks for updates every 24 hours. For a test, set
  `extensions.update.interval` to `120` in `about:config`.

JoyFox's file, one item per release (V1-9):

```json
{
  "addons": {
    "joyfox@drclaw": {
      "updates": [
        {
          "version": "<version>",
          "update_link": "<HTTPS address of the signed .xpi>",
          "update_hash": "sha256:<hex hash of the signed .xpi>",
          "applications": { "gecko": { "strict_min_version": "121.0" } }
        }
      ]
    }
  }
}
```

JoyFox gives `update_hash` although the link is HTTPS: it makes Firefox check
the file it downloads. It must be the hash of the signed `.xpi`, not of the
unsigned build.

## Open for V1-9

Built in V1-9 (2026-09-28); the procedure is `release.md`.

- **Redirects.** A GitHub release download link redirects to another HTTPS host.
  No Mozilla page says whether Firefox follows that redirect for an
  `update_link`. It is checked with the first update after 1.0.0 (`release.md`,
  "First update: the redirect check"). If it fails, only `updates.json` changes:
  the `update_link` then points to an address without a redirect.
- **Source README.** Done: README, "Build from source (for Mozilla's
  reviewers)". `npm run package:source` makes the source package from the
  committed tree. A clean archive built with Node.js 24.14.0 and npm 11.9.0 gave
  files identical to the Node.js 22 build (x86-64; ARM64 not tested).
- **Reviewer account and testing notes.** The policy requires test credentials
  when a feature needs an account. The owner decided on 2026-09-28 not to give a
  reviewer account for now and accepts the risk: a manual review can be delayed
  or rejected, or the add-on blocked (ADR 0016). The README tells reviewers that
  every feature needs a JoyClub account and that none is provided.
- **Signing wait.** The Release workflow uses `web-ext`'s 15-minute wait. After
  a timeout, the signed `.xpi` comes from the AMO edit address (`release.md`,
  step 3).
- **Web download.** A web server that offers the `.xpi` for a click to install
  must send `Content-Type: application/x-xpinstall` ("Distributing an add-on
  yourself"). JoyFox's install instructions open the downloaded file from
  `about:addons`, which does not depend on it.

## Verification checklist

Done. Items 2, 3 and 4 were verified on 2026-09-26 with Mozilla's own tools;
items 1, 5 and 6 on 2026-09-28 from the Mozilla web pages (below).

1. Extension Workshop, "Signing and distribution overview" and "Distributing an
   add-on yourself": the unlisted flow, review and timing.
2. Mozilla Add-ons Blog, 2025-10-23, and Extension Workshop, "Firefox built-in
   consent for data collection and transmission": the exact
   `data_collection_permissions` format and whether it is now required of all
   extensions.
3. `web-ext sign --help` and the `web-ext` changelog: the version to pin, its
   current flags, how it uploads source code, and that `--channel=unlisted`
   creates no public listing.
4. MDN, `browser_specific_settings`: the ID rules for Manifest V3. Verified in
   `web-ext` 10.7.0 (`lib/cmd/sign.js`): signing a Manifest V3 extension with no
   ID stops with "An extension ID must be specified in the manifest.json file".
   The linter accepts `joyfox@drclaw`.
5. Extension Workshop, "Source code submission": what to upload.
6. Extension Workshop, "Updating your extension": the `updates.json` field
   names.

## Checklist results, 2026-09-28

The owner had a browser assistant read the pages and quote them; the report
gives each claim a verdict, a quote and the page.

| Claim                                                                           | Verdict                                                                                             | Source                                                                |
| ------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------- |
| Unlisted add-ons are signed through AMO but cannot be viewed or installed there | Confirmed                                                                                           | Signing and distribution overview                                     |
| All add-ons pass automated validation before signing                            | Confirmed                                                                                           | Signing and distribution overview                                     |
| Any add-on can be reviewed by hand at any time after submission                 | Confirmed                                                                                           | Signing and distribution overview                                     |
| Signing takes up to 24 hours, or longer for a manual review                     | Confirmed                                                                                           | Signing and distribution overview                                     |
| Only Nightly, Developer Edition and unbranded builds can turn off signing       | Different: ESR can too                                                                              | Add-on signing in Firefox (2026-01-07)                                |
| `web-ext sign --channel=unlisted` creates no listing                            | Confirmed                                                                                           | `web-ext` command reference (2026-07-18)                              |
| An unlisted add-on can use its own `update_url`                                 | Confirmed                                                                                           | Distributing an add-on yourself                                       |
| Each version must be higher than all earlier ones                               | Not found as an AMO rule (only for a rollback on AMO); required by the update check, see "Channels" | Version rollback (2025-09-16)                                         |
| Bundled code needs the original source and build steps                          | Confirmed                                                                                           | Source code submission; Add-on Policies (2026-04-30)                  |
| Obfuscated code is never allowed                                                | Confirmed                                                                                           | Source code submission; Add-on Policies                               |
| The source rules apply to unlisted add-ons                                      | Confirmed                                                                                           | Add-on Policies                                                       |
| What the build README must hold                                                 | Found; see "Source code"                                                                            | Source code submission                                                |
| What the source upload holds                                                    | Partly: lockfile required, 200 MB limit; no format, no exclusions named                             | Source code submission                                                |
| Add-ons must not load remote code                                               | Confirmed                                                                                           | Add-on Policies                                                       |
| `addons` → extension ID → `updates` → `version`, `update_link`                  | Confirmed                                                                                           | Updating your extension                                               |
| `update_link` must be HTTPS or have `update_hash`                               | Confirmed; redirects not mentioned                                                                  | Updating your extension                                               |
| `update_hash` format                                                            | Optional over HTTPS; `sha256:` or `sha512:` plus hex                                                | Updating your extension                                               |
| Minimum version field in an update item                                         | `applications.gecko.strict_min_version`                                                             | Updating your extension                                               |
| `updates.json` must be served over HTTPS                                        | Confirmed; no content type named                                                                    | Updating your extension; MDN `browser_specific_settings` (2026-04-20) |

Other findings the report quoted:

- `data_collection_permissions` takes the form `{"required": ["none"]}`, and all
  new extensions need it since 2025-11-03 (Extension Workshop, "Firefox built-in
  consent", updated 2026-03-12). JoyFox's manifest already has exactly this form
  (see "Manifest gaps").
- A Manifest V3 extension needs an ID for signing, listed or self-distributed
  (MDN, `browser_specific_settings`).
- `web-ext` 8 and later require `--channel`; `--approval-timeout` defaults to 15
  minutes (`web-ext` command reference).
- An add-on package may be at most 200 MB ("Submitting an add-on").
