# Branding

JoyFox uses the Angular JF Monogram. The approved brand package is in
`assets/brand/`. It is the only source for the brand:

- **Rules** (logo, colors, wordmark, sizes, what not to do):
  `assets/brand/BRAND-GUIDE.md`.
- **Browser notes** (manifest icons, store assets, the independence sentence for
  store listings): `assets/brand/IMPLEMENTATION.md`.

Do not edit the files in `assets/brand/`. They stay byte for byte as approved,
so Prettier ignores the folder. A new version of the brand replaces the folder
as a whole.

## What goes into a build

`scripts/build.mjs` copies only these brand files into `dist/<browser>`:

| Build path | Source                           | Used by                          |
| ---------- | -------------------------------- | -------------------------------- |
| `icons/…`  | `assets/brand/icons/<browser>/…` | Each icon the manifest names     |
| `brand/…`  | `assets/brand/master/` (2 marks) | The options page header, by mode |

- **Firefox** (`manifests/firefox.json`): `icons`, `action.default_icon` and
  `action.theme_icons`. Firefox shows `toolbar-dark-on-light` on a theme with
  dark text (a light theme) and `toolbar-light-on-dark` on a theme with light
  text (a dark theme).
- **Chrome** (`manifests/chrome.json`): `icons` and `action.default_icon`.
  Chrome has no `theme_icons`.
- The options page loads `icons/icon-16.png` and `icons/icon-32.png` as its
  favicon. Both builds have them.

Everything else stays out of the builds: `store/`, `social/`, `preview/`,
`tokens/`, `manifest-snippets/`, `icons/universal/` and the other masters.

`npm run lint` checks (`scripts/check-icons.mjs`) that each manifest icon is in
the package and is a square PNG of the size its key names. The build fails if an
icon or a file the options page loads is missing.

## Where the brand appears

- **Options page:** the mark and the wordmark ("Joy" in the text color, "Fox" in
  JoyFox Red) in the header, the favicon, and the bar on the selected tab.
- **JoyClub pages:** only the "JoyFox" name at the start of the member bar, as a
  wordmark. JoyClub's page stays the main visual environment.

Nothing else uses the brand color. Focus rings, buttons, switches and form
fields keep their system look.

## Colors in the code

| Token             | Value                    | File                         | Use                           |
| ----------------- | ------------------------ | ---------------------------- | ----------------------------- |
| `--joyfox-brand`  | `#ea1c2c` (JoyFox Red)   | `options.css`, `content.css` | Wordmark "Fox", selected tab  |
| `--joyfox-danger` | `#a3282d` / `#ff8a80`    | `options.css`                | Errors, removals, "not"       |
| `--joyfox-accent` | `Highlight` (system)     | `options.css`                | Focus, active account, switch |
| `--joyfox-*`      | Placement colors, mixing | `content.css`                | Triage and status on JoyClub  |

- JoyFox Red is never a warning or an error color. Semantic colors (danger,
  placements) stay separate from it.
- On JoyClub pages, brand text is mixed half with the page's text color, so it
  reaches 4.5:1 on light and dark pages. A test
  (`tests/integration/card-line.test.ts`) checks this.
- On the options page, the red in the heading keeps its exact value: the heading
  is large text and a logotype.

## Rules for new UI

- Use the brand for JoyFox's own identity and selected JoyFox states only. Never
  style JoyClub's own controls with it.
- Do not put the mark on JoyClub pages. An extension image there needs
  `web_accessible_resources`, which lets a page detect JoyFox.
- Do not put SVG files under `src/`. Their `xmlns` address fails the network
  isolation test (`tests/integration/network-isolation.test.ts`).
- Never use the JOYclub logo or pixel-heart, or Firefox or Mozilla marks.

## Store assets

Store images are in `assets/brand/store/` and never go into a build.

- **Firefox Add-ons:** `store/firefox/` (icons, screenshot template). JoyFox is
  unlisted for now (`distribution.md`), so AMO shows none of them yet.
- **Chrome Web Store:** `store/chrome/` (the 128 px store icon, the small promo
  tile, the marquee, a screenshot template). See `chrome.md`.
- Replace a screenshot template with real JoyFox screens before you upload it.
- `assets/brand/social/` holds a GitHub avatar and a social preview. They are
  uploaded in GitHub's settings (the account's avatar, the repository's social
  preview), not read from the repository.
