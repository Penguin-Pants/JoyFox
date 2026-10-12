# AMO listing

The answers for every question in the addons.mozilla.org (AMO) submission form,
in the form's order. The procedure is `release.md`, "First listed version
(1.0.1): by hand". The decision is ADR 0016, "AMO listing".

Sources for the form and its limits (read 2026-10-12): Extension Workshop,
"Submitting an add-on" and "Create an appealing listing"; AMO API docs,
"Add-ons" and "Categories".

## Files to upload

| Form field      | File                                                      |
| --------------- | --------------------------------------------------------- |
| Add-on file     | `dist/joyfox-1.0.1.zip` (`release.md`, step 1)            |
| Source code     | `dist/joyfox-1.0.1-source.zip` (`npm run package:source`) |
| Icon            | `assets/brand/icons/universal/joyfox-128.png`             |
| Screenshots 1–5 | `assets/store/screenshots/joyfox-screenshot-0*.png`       |

- **Icon:** AMO wants a square PNG or JPEG and recommends 128×128. It makes the
  32, 64 and 128 px sizes itself.
- **Screenshots:** 1280×800 PNG, the size AMO recommends (1.6:1). They show the
  real JoyFox UI with invented data and no JoyClub logo (`branding.md`).

## 1. Upload Version

- **Channel:** "On this site" (listed).
- **Compatible platforms:** Firefox only. Leave Firefox for Android unticked:
  JoyFox is not tested on Android.
- **Validation:** expect no errors (`npm run lint:amo`). The two warnings about
  `data_collection_permissions` and Firefox 121 are known (`distribution.md`,
  "Manifest gaps") and need no change.

## 2. Source code

- **Do you need to submit source code?** Yes. The code is bundled by esbuild
  from TypeScript (not minified, not obfuscated).
- **Upload:** `dist/joyfox-1.0.1-source.zip`.

## 3. Describe Add-on

### Name

JoyFox

### Add-on URL

`https://addons.mozilla.org/firefox/addon/joyfox/` (slug `joyfox`, already held
by this add-on on AMO).

### Summary (English, 250 characters at most)

Sort your JoyClub inbox with your own contact rule, keep private notes and tags
on members and events, and save searches. Local-first: no server, no tracking,
everything stays in your browser. Independent project, not made by JOYclub.

### Description (English)

```text
JoyFox is a local-first helper for the JoyClub pages you open (www.joyclub.de). It adds tools to your inbox, profiles, member search and events. It has no server: everything it stores stays in your browser.

JoyFox is an independent browser extension for JoyClub users. It is not made, sponsored or supported by JOYclub or Mozilla.

WHAT IT DOES

- Inbox triage: sort ClubMail into Qualified, Needs Review and Junk by your own contact rule (verified, photos, profile words, account age and more). Each row says why. Start from a preset or build the rule in plain language.
- "Mark qualified" and "Mark as junk": place a sender yourself in one click.
- Delete and Ignore: one-click buttons that use JoyClub's own controls to move a conversation to JoyClub's trash and, if you want, ignore the member. They act only when you click them.
- Private notes and tags for members and events, on profiles, conversations, search results and guest lists.
- Shared preferences: see which "Vorlieben" you share with a member. No match percentage.
- Saved member searches, a personal event calendar with your attendance, and a "Profile type" filter on the My JOY lists.
- Search the ClubMail messages you opened (on by default, deleted after 12 months, can be turned off).
- Message templates you insert yourself. JoyFox never sends a message.
- German and English.

YOUR DATA

- JoyFox sends no data to its author, to JoyClub or to anyone else. No analytics, no tracking, no ads.
- It reads only the JoyClub pages you open. It never crawls JoyClub.
- The options page ("Your data") shows every stored record. Export it as JSON or delete it, per record, type, account or all at once.

READ BEFORE YOU INSTALL

- Nobody has checked whether JoyClub's terms of use allow extensions like JoyFox. Many platforms forbid automated access. If JoyClub finds that you use JoyFox, it can restrict or close your account. "Delete", "Mark as junk" and "Ignore and Delete" click JoyClub's own buttons for you and carry the highest risk.
- JoyFox stores information about other members (profile facts, your notes and tags) in your browser. You are responsible for how you use and keep it.
- You use JoyFox at your own risk. It comes with no warranty (GPL 3.0 or later).

Open source: https://github.com/Penguin-Pants/JoyFox
```

### Experimental

No (leave unticked).

### Requires payment

No (leave unticked).

### Categories (Firefox, up to 2)

- Social & Communication (`social-communication`)

One category fits. No other AMO category describes JoyFox, and a wrong one
misleads users.

### Support email

Optional. Leave it empty, or enter an address you are willing to publish. The
support website below is enough.

### Support website

<https://github.com/Penguin-Pants/JoyFox/issues>

### License

JoyFox is `GPL-3.0-or-later` (`LICENSE`, ADR 0016). AMO's list offers "GNU
General Public License v3.0 only", which does not say "or later". Choose "Custom
License" instead:

- **Name:** GNU General Public License v3.0 or later
- **Text:** the full text of `LICENSE`.

### Privacy policy

- **Does this add-on have a privacy policy?** Yes (tick the box). AMO requires
  one only when data leaves the device, which JoyFox never does, but the policy
  shows users what JoyFox stores.
- **Text:** the text of `PRIVACY.md`, from "JoyFox is a browser extension" to
  the end.

### Notes to reviewer

```text
Build from source (also in README.md, "Build from source (for Mozilla's reviewers)"):
- Node.js 22 or 24 with its npm. Tested with Node.js 24.14.0 and npm 11.9.0 (your default environment) and with Node.js 22.22.2 and npm 10.9.7: both give byte-identical files.
- In the unpacked source folder: npm ci, then npm run build:firefox. The output is dist/firefox.
- The build is deterministic. Compare with: diff -r --exclude=META-INF <unpacked xpi> dist/firefox
- esbuild bundles the TypeScript in src/. Nothing is minified or obfuscated. No remote code.

Permissions:
- storage: settings. Records are in the extension's IndexedDB.
- Host access to *.joyclub.de and *.joyce.app: the content script runs only on these pages. JOYCE is not supported yet; JoyFox stays inactive there.

Network: JoyFox's code makes no network request (tests/integration/network-isolation.test.ts). data_collection_permissions is "none".

Site actions: "Delete", "Mark as junk" and "Ignore and Delete" click JoyClub's own buttons in the page, and only when the user clicks them. A saved search opens its saved JoyClub address. JoyFox never sends a message.

Testing: every feature runs on JoyClub pages and needs a signed-in JoyClub account. No test account is provided. Without an account, the options page works fully (about:addons > JoyFox > Preferences, or the toolbar button): accounts, the contact rule editor and presets, templates, events, messages, and "Your data" with export, import and delete.
```

## 4. Version release notes

```text
First version on addons.mozilla.org. Sort your ClubMail inbox with your own contact rule, keep private notes and tags on members and events, save searches, track events and search the messages you opened. Everything stays in your browser. German and English.
```

## 5. Screenshots and captions

Upload in this order, with these captions.

| File                                    | Caption                                                              |
| --------------------------------------- | -------------------------------------------------------------------- |
| `joyfox-screenshot-01-inbox.png`        | Sort your inbox with your own contact rule (invented data)           |
| `joyfox-screenshot-02-profile.png`      | Private notes, tags and shared interests (invented data)             |
| `joyfox-screenshot-03-contact-rule.png` | Your contact rule, in plain language (invented data)                 |
| `joyfox-screenshot-04-events.png`       | Your own calendar of tracked events (invented data)                  |
| `joyfox-screenshot-05-your-data.png`    | Stored only in your browser: inspect, export, delete (invented data) |

## 6. Optional: German listing

Most JoyClub members read German. AMO lets you add a German (`de`) listing on
the listing's edit page ("Edit Product Page" > language menu). The screenshots
stay the same.

- **Summary:** Sortiere dein JoyClub-Postfach nach deiner eigenen Kontaktregel,
  führe private Notizen und Tags zu Mitgliedern und Events, speichere Suchen.
  Lokal: kein Server, kein Tracking, alles bleibt in deinem Browser.
  Unabhängiges Projekt, nicht von JOYclub.
- **Description:** translate the English text above, or leave English only. A
  translation needs a German reader's check before it goes live.

## After approval

1. Open the listing in a private window and compare it with this file
   (`manual-acceptance.md`, item 138).
2. On "Edit Product Page", set **Homepage** to
   <https://github.com/Penguin-Pants/JoyFox>. The submission form does not ask
   for it.
