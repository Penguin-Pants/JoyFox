# Chrome Web Store listing

The answers for every tab in the Chrome Web Store Developer Dashboard, in the
dashboard's order. Visibility is **Public** (owner, 2026-10-13). This replaces
the "unlisted" decision in `chrome.md`. The Firefox counterpart is
`amo-listing.md`; the description below is the same text, so keep both in step.

Sources (read 2026-10-13): Chrome for Developers, "Supplying images", "Complete
your listing information", "Fill out the privacy fields", "Set up distribution",
"Updated Privacy Policy & Secure Handling Requirements" (user data FAQ),
"Content ratings guidelines" and "browser namespace".

## Before you submit

1. Load `dist/chrome` in current stable Chrome (148 or later) from
   `chrome://extensions` ("Load unpacked"). Check the inbox, a conversation and
   a profile on www.joyclub.de, then stop and restart the service worker. This
   is still open in `chrome.md`; the build has only run in Chromium 141 with a
   shim.
2. If an unlisted 1.0.0 is already in the dashboard, upload 1.0.1 to that item
   and change its visibility. Do not make a second item.

## Files to upload

| Dashboard field           | File                                                      |
| ------------------------- | --------------------------------------------------------- |
| Package (Package tab)     | `dist/joyfox-1.0.1-chrome.zip` (`npm run package:chrome`) |
| Store icon, 128×128       | `assets/brand/store/chrome/chrome-web-store-icon-128.png` |
| Screenshots 1–5, 1280×800 | `assets/store/screenshots/joyfox-screenshot-0*.png`       |
| Small promo tile, 440×280 | `assets/brand/store/chrome/small-promo-440x280.jpg`       |
| Marquee tile, 1400×560    | `assets/brand/store/chrome/marquee-1400x560.jpg`          |
| Promo video               | None                                                      |

- The screenshots are 24-bit PNG with no alpha, full bleed, and show the real
  JoyFox UI with invented data and no JoyClub logo (`branding.md`). Upload them
  in file order.
- The manifest icons are inside the ZIP (`icons/icon-*.png`).

## Store listing tab

### Name and summary

Read from the manifest: "JoyFox" and "Local-first enhancements for pages you
open on JoyClub." To change them, change `manifests/chrome.json` and upload a
new version.

### Description

The same text as `amo-listing.md`, "Description (English)", with "Mozilla"
replaced by "Google":

```text
JoyFox is a local-first helper for the JoyClub pages you open (www.joyclub.de). It adds tools to your inbox, profiles, member search and events. It has no server: everything it stores stays in your browser.

JoyFox is an independent browser extension for JoyClub users. It is not made, sponsored or supported by JOYclub or Google.

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

### Category

Social & Communication, or "Communication" if the dropdown names it so. The
current category names are not on any Google page; read them in the dropdown.

### Language

English. The UI is also German (ADR 0014); the dashboard can take a German
description later (see `amo-listing.md`, section 6, for the summary).

### Homepage URL

<https://github.com/Penguin-Pants/JoyFox>

Do not use joyclub.de: JoyFox is not JoyClub's product.

### Support URL

<https://github.com/Penguin-Pants/JoyFox/issues>

### Official URL

None. It needs a site verified in Google Search Console.

### Mature content

**On.** JoyClub is an adult community, and the profile panel shows which
"Vorlieben" (sexual preference tags) the user shares with a member. Google's
ratings guidelines put "focus on sexual or sexually suggestive content" under
Mature and a dating tool "not focused on sexual relations" under not mature.
JoyFox sits between them, so "On" is the safer answer. The cost: logged-out
users and accounts not verified as adult do not see it in search. The listing
text and images stay non-sexual either way.

## Privacy tab

### Single purpose

```text
JoyFox helps a JoyClub member organize their own use of www.joyclub.de: it sorts their inbox by their own contact rule and keeps their private notes, tags, saved searches and event list, stored only in their browser.
```

### Permission justification

- **storage:**

  ```text
  Stores the user's settings, contact rule, notes, tags, templates, tracked events and member records in the extension's own storage (storage.local, storage.session and IndexedDB). Nothing leaves the browser.
  ```

- **Host permission (`*://*.joyclub.de/*`, `*://*.joyce.app/*`):**

  ```text
  The content script adds JoyFox's panels to JoyClub pages the user opens (inbox, conversations, profiles, member search, events). It reads what the page shows and, only when the user clicks "Delete", "Mark as junk" or "Ignore and Delete", clicks JoyClub's own buttons. joyce.app is JoyClub's second site; JoyFox loads there but stays inactive until its pages are verified.
  ```

  Risk: Google may ask why joyce.app is requested while unused. Removing it from
  both manifests and `config/permissions.json` avoids the question.

### Remote code

"No, I am not using remote code." The bundles contain no `eval`, `new Function`
or `importScripts` and no remote address (checked 2026-10-13 on `dist/chrome`),
and `tests/integration/network-isolation.test.ts` checks that the code makes no
network request.

### Data usage

Google counts data stored only on the device as handled data (user data FAQ,
questions 3 and 14). Tick what `PRIVACY.md` lists:

| Category                            | Tick | What JoyFox stores (`PRIVACY.md`)                                                                   |
| ----------------------------------- | ---- | --------------------------------------------------------------------------------------------------- |
| Personally identifiable information | Yes  | Other members' member IDs and nicknames; the JoyClub account names the user enters                  |
| Health information                  | No   |                                                                                                     |
| Financial and payment information   | No   |                                                                                                     |
| Authentication information          | No   | No passwords, cookies or tokens                                                                     |
| Personal communications             | Yes  | Text of the ClubMail messages the user opens (on by default, can be turned off)                     |
| Location                            | No   |                                                                                                     |
| Web history                         | No   | No browsing history; it records only JoyClub pages as member and event records                      |
| User activity                       | No   | No clicks, keystrokes or scrolling are recorded; the action log holds IDs and times of user actions |
| Website content                     | Yes  | Profile snapshots: photo and word counts, badges, join dates, preference tags; event guest lists    |

Then tick all three certifications: no sale to third parties, no use unrelated
to the single purpose, no use for credit decisions.

### Privacy policy URL

<https://github.com/Penguin-Pants/JoyFox/blob/main/PRIVACY.md>

## Distribution tab

- **Payments:** Free.
- **Visibility:** Public.
- **Regions:** All regions.

## Account (once, outside the item)

- **Developer registration fee:** paid once per account.
- **Trader or non-trader:** the EU Digital Services Act requires the declaration
  in the account settings. A free hobby project is usually "non-trader"; it is
  the owner's legal call.
- **Contact email:** must be verified before publishing.

## Test instructions (Privacy tab or "Test instructions" field)

```text
Every in-page feature runs on www.joyclub.de and needs a signed-in JoyClub account. No test account is provided. Without an account, the options page works fully (toolbar button, or chrome://extensions > JoyFox > Details > Extension options): accounts, the contact rule editor and presets, templates, events, messages, and "Your data" with export, import and delete.

Build from source: https://github.com/Penguin-Pants/JoyFox (npm ci, then npm run build:chrome; output in dist/chrome). esbuild bundles the TypeScript; nothing is minified or obfuscated.
```

Risk: a reviewer who cannot sign in may reject the item as "not testable". A
JoyClub account made for reviewers, with its credentials in this field, removes
that risk.

## After approval

1. Open the listing in a private window and compare it with this file.
2. In `chrome.md`, mark the store listing images done.
