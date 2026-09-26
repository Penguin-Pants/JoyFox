# Firefox distribution and signing (F8)

## Status

Research draft, 2026-09-25. **Not verified against the live Mozilla pages.**
This session's network policy refused every Mozilla host (and github.com), so
the findings below come from web-search summaries of the official pages, not
from the pages themselves. Each claim names its source. Before release packaging
is claimed, verify every claim marked **Verify** against the live page (see
"Verification checklist").

F8's acceptance criterion ("documented steps to produce a signed, installable
build outside AMO") is met only as a draft until that check is done. The owner
chose the channel: unlisted, with automatic updates (ADR 0016).

## Channels

| Channel                               | Signed by Mozilla | Where it installs                                     | Updates                              |
| ------------------------------------- | ----------------- | ----------------------------------------------------- | ------------------------------------ |
| Temporary install (`about:debugging`) | No                | Any Firefox, until the browser restarts               | By loading it again                  |
| Unlisted (self-distributed)           | Yes               | Release and Beta Firefox, from a file the owner hosts | Self-hosted `update_url`, or by hand |
| Listed on AMO                         | Yes, after review | Everyone, from addons.mozilla.org                     | AMO                                  |

- Release and Beta Firefox install only signed extensions. Nightly, Developer
  Edition and unbranded builds can turn this off with the preference
  `xpinstall.signatures.required` set to `false` in `about:config`. **Verify**
  (Mozilla Support, "Add-on signing in Firefox"; Mozilla Wiki,
  "Add-ons/Extension Signing").
- "Unlisted" add-ons are signed by Mozilla but cannot be found or installed from
  AMO. All add-ons pass automated validation before signing, and any add-on,
  unlisted ones included, can be reviewed by hand at any time after submission.
  Signing can take up to 24 hours, or longer when a submission is picked for
  manual review. **Verify** (Extension Workshop, "Signing and distribution
  overview", "Distributing an add-on yourself").
- PRD Section 20 puts a self-distributed public release in V1 and AMO submission
  in "Later". So the unlisted channel matches the roadmap.

## Steps for an unlisted signed build

1. Create an addons.mozilla.org developer account and accept the developer
   agreement.
2. On AMO's "Manage API Keys" page, create API credentials: a JWT issuer and a
   JWT secret. Keep them out of the repository, shell history and logs.
3. Fix the manifest gaps below.
4. Install `web-ext` at a pinned version, so every release signs the same way:
   `npm install --save-dev --save-exact web-ext@<version>`, with the version
   chosen in checklist item 3. The repository does not include `web-ext` yet,
   because no version has been checked against its changelog from here.
5. Build: `npm ci`, then `npm run build:firefox`, which writes `dist/firefox`.
6. Make the source package (see "Source code"). Every build is bundled by
   esbuild, so every submission needs it, not only when AMO asks.
7. Sign from `dist/firefox`. Keep the credentials out of the command line, where
   shell history and the process list would show them: put them in the
   environment variables `WEB_EXT_API_KEY` and `WEB_EXT_API_SECRET`, loaded from
   a password manager or a protected prompt, never typed on the command line.
   Then run `npx web-ext sign --channel=unlisted` and upload the source package
   with the submission. The signed `.xpi` is downloaded when signing finishes.
   **Verify** with `npx web-ext sign --help` that the installed version reads
   those variables, how it uploads source code, and that `--channel=unlisted`
   never creates a public listing: `web-ext` 8 reportedly changed the default
   for new add-ons to create a listing (Extension Workshop, "web-ext command
   reference"; `mozilla/web-ext` releases).
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
  (`docs/permissions.md`), so `"none"` matches its design today. **Verify** the
  exact format first. Sync (V1-6, deferred by ADR 0016) would send encrypted
  data to the user's own server, so the value must be reviewed before sync
  ships.
- **Self-hosted updates.** Optional.
  `browser_specific_settings.gecko.update_url` points to an `updates.json` that
  must be served over HTTPS. It is keyed by the extension ID and lists each
  version with its `update_link` (MDN, "Updates"; Extension Workshop, "Updating
  your extension"). **Verify** the field names.
- `strict_min_version` is `121.0`, which the PRD requires (Section 14.1).

## Source code

AMO reviewers must be able to read the code. Bundled, transpiled or minified
code is allowed only with a copy of the original source and instructions to
reproduce the build; obfuscated code is not allowed at all (Extension Workshop,
"Source code submission"; "Add-on Policies"). The build bundles TypeScript with
esbuild (`scripts/build-firefox.mjs`), so a submission needs:

- the source tree without `node_modules` and `dist`;
- build instructions: the Node.js version (22, per the README), `npm ci`, then
  `npm run build:firefox`.

The build is already deterministic (`README.md`), which makes a reviewer's
rebuild match the submitted file.

## Policy notes

- Add-ons must be self-contained and must not load remote code (Extension
  Workshop, "Add-on Policies"). JoyFox bundles all its code and has no network
  client (`docs/permissions.md`).
- Personal data may be collected only after explicit consent. No Mozilla policy
  text found in this pass addresses an extension that clicks a site's own
  controls for the user (M9). That risk stays the one the PRD names: JoyClub's
  terms (PRD Sections 18.3 and 18.4), not Mozilla policy. The owner chose no ToS
  review; the release carries a disclaimer instead (D4, ADR 0016).

## Owner decisions

- **Channel:** decided (owner, 2026-09-26, ADR 0016): an unlisted signed build,
  published on the GitHub release (PRD Section 20, V1). An AMO listing stays
  "Later".
- **Extension ID:** decided: `joyfox@drclaw` (ADR 0016).
- **Updates:** decided (owner, 2026-09-26, ADR 0016): automatic, through
  `update_url` and an `updates.json` served over HTTPS from GitHub. V1-9 sets
  the exact address.

## Verification checklist

Do this with network access to the Mozilla hosts, or by hand:

1. Extension Workshop, "Signing and distribution overview" and "Distributing an
   add-on yourself": the unlisted flow, review and timing.
2. Mozilla Add-ons Blog, 2025-10-23, and Extension Workshop, "Firefox built-in
   consent for data collection and transmission": the exact
   `data_collection_permissions` format and whether it is now required of all
   extensions.
3. `web-ext sign --help` and the `web-ext` changelog: the version to pin, its
   current flags, how it uploads source code, and that `--channel=unlisted`
   creates no public listing.
4. MDN, `browser_specific_settings`: the ID rules for Manifest V3.
5. Extension Workshop, "Source code submission": what to upload.
6. MDN, "Updates": the `updates.json` field names.
