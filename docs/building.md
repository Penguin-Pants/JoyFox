# Building JoyFox

Short steps to build JoyFox for Firefox and Chrome. For the full release
procedure, see `release.md` (Firefox) and `chrome.md` (Chrome).

## Before you start

1. Install Node.js 22 (it includes npm).
2. In the project folder, run `npm ci`.

## Firefox

### Build and test

1. Run `npm run build:firefox`. The build goes to `dist/firefox`.
2. In Firefox, open `about:debugging` > "This Firefox" > "Load Temporary
   Add-on".
3. Select `dist/firefox/manifest.json`.

Firefox removes a temporary add-on when it closes.

### Make a signed `.xpi` (to install and share)

Release Firefox installs only files that Mozilla signed.

1. In GitHub, open **Actions** > **Release** > **Run workflow** on `main`.
2. When the workflow ends, open the draft release `v<version>` and download
   `joyfox-<version>.xpi`.
3. To install it, open `about:addons` > gear menu > "Install Add-on From File".

The workflow needs the AMO keys in the repository's secrets. `release.md`
describes that one-time setup and the steps after a release.

### Make an unsigned `.xpi` (for testing only)

```sh
npm run build:firefox
npx web-ext build --source-dir dist/firefox --artifacts-dir dist --filename joyfox-<version>.xpi --overwrite-dest
```

Release and Beta Firefox refuse this file. Developer Edition, Nightly and ESR
accept it after you set `xpinstall.signatures.required` to `false` in
`about:config`.

## Chrome

JoyFox needs Chrome 148 or later.

### Build and test

1. Run `npm run build:chrome`. The build goes to `dist/chrome`.
2. In Chrome, open `chrome://extensions` and turn on "Developer mode".
3. Click "Load unpacked" and select the `dist/chrome` folder.

### Make the Chrome Web Store package

1. Run `npm run package:chrome`. The package is
   `dist/joyfox-<version>-chrome.zip`.
2. Upload the ZIP in the Chrome Web Store Developer Dashboard. Google signs it
   and sends updates to installed copies.

Chrome does not install a `.crx` file from outside the store for normal users.
Use the store (unlisted) to share JoyFox.

## A new version

1. Set the same new version in `package.json` (with
   `npm version <x.y.z> --no-git-tag-version`), `manifests/firefox.json` and
   `manifests/chrome.json`.
2. Add `docs/release-notes/<x.y.z>.md`.
3. Run `npm run lint`. It checks that the versions match.

A version can be released only once. Every release needs a higher version.
