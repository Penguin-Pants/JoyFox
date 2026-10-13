# Chrome build

## Status

The Chrome build uses the same source as the Firefox build. Only the manifest
(`manifests/chrome.json`) and the esbuild target differ. The owner uploads it to
the Chrome Web Store by hand as a public item. There is no automated Chrome
release.

## Owner decisions (2026-09-28)

- **Minimum version: Chrome 148.** Chrome 148 is the first release with the
  `browser` namespace and with `runtime.onMessage` listeners that answer by
  returning a Promise. The background uses both, so the build has no polyfill
  and no `chrome.*` calls. Older Chrome versions refuse to install the build
  (`minimum_chrome_version`).
- **Distribution: Chrome Web Store, public** (owner, 2026-10-13; was unlisted).
  `chrome-web-store-listing.md` answers every dashboard field. The Store signs
  and updates the extension, so the manifest has no `update_url`. The Firefox
  manifest has none either: AMO updates it (ADR 0016, "AMO listing").

## Differences from the Firefox manifest

| Key                         | Firefox                    | Chrome           |
| --------------------------- | -------------------------- | ---------------- |
| `background`                | `scripts` (event page)     | `service_worker` |
| `browser_specific_settings` | Gecko ID, update URL, data | Not present      |
| `minimum_chrome_version`    | Not present                | `148`            |
| `icons`, `action` icons     | Firefox set, theme icons   | Chrome set       |

Permissions, host permissions and content script matches are the same.
`npm run lint` checks both manifests against `config/permissions.json`, and
checks that both carry the `package.json` version.

## Why the code needs no change

- The background uses no DOM API, so it runs as a service worker.
- It registers every listener when it starts and keeps no state in memory, so
  Chrome can stop the service worker when it is idle.
- `openOrClosedShadowRoot` is Firefox-only. The `j-tag` and `j-message-bubble`
  shadow roots are open, so the `shadowRoot` fallback reads them in Chrome.
- Chrome grants host permissions at install, so "Get started" shows no
  site-access step.

## Build and upload

1. `npm ci`
2. `npm run package:chrome` writes `dist/joyfox-<version>-chrome.zip`.
3. Upload the ZIP and the listing images in the Chrome Web Store Developer
   Dashboard (`chrome-web-store-listing.md`, "Files to upload").

For development, run `npm run build:chrome` and load `dist/chrome` from
`chrome://extensions` ("Developer mode" > "Load unpacked").

## Verified

On 2026-09-28, the build was loaded in Playwright's Chromium 141, with the
version floor removed and a test-only shim for the two Chrome 148 features. The
service worker started, the options page drew with no error, and a
`diagnostic.ping` message came back from the background. Without the shim,
Chromium 141 fails with `browser is not defined`, as expected.

## Open

- **Check in Chrome 148 or later:** the inbox, conversation and profile pages on
  www.joyclub.de; the dropdown colors in `content.css` (a fix for Firefox); and
  a restart of the service worker from `chrome://extensions`.
