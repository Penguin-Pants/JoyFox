# "My JOY" lists (E5)

Method: Opened `visitors` by URL (one full page load). Reached `match`, `top`,
`fav` and `visits` by clicking JoyClub's own pill tabs (`j-pill`) in order. On
each page ran read-only DOM queries only (`querySelector(All)`,
`getComputedStyle`, attribute reads, open shadow roots). No `fetch`, XHR or
JoyClub API call, no value set, no event dispatched, no card or profile opened.
Navigation type measured with the `window.__jf` marker, a `pageshow` listener
(`window.__jfRestored`) and
`performance.getEntriesByType("navigation")[0].type`. Scrolled to page end twice
on `visitors`, `top` and `visits`, once on `match` and `fav` (lists already
complete). Tested viewport width: 1296 px (5 grid columns). Only structure,
class names, site vocabulary and value shapes were recorded. No CAPTCHA,
warning, login prompt or error appeared.

## Page signals

| Key      | Final path              | Heading (visible h1 / screen-reader h2)      | Root selector                                     | Root count |
| -------- | ----------------------- | -------------------------------------------- | ------------------------------------------------- | ---------- |
| visitors | `/my_joy/visitors/`     | "Profilbesuche & Likes" / "Profilbesucher"   | `section.my-joy-visits-view .card-grid-container` | 1          |
| match    | `/my_joy/voting/match/` | "Profilbesuche & Likes" / "Matches"          | `section.my-joy-visits-view .card-grid-container` | 1          |
| top      | `/my_joy/voting/top/`   | "Profilbesuche & Likes" / "Mögen mich"       | `section.my-joy-visits-view .card-grid-container` | 1          |
| fav      | `/my_joy/voting/fav/`   | "Profilbesuche & Likes" / "Mag ich"          | `section.my-joy-visits-view .card-grid-container` | 1          |
| visits   | `/my_joy/visits/`       | "Profilbesuche & Likes" / "Besuchte Profile" | `section.my-joy-visits-view .card-grid-container` | 1          |

Notes:

- The visible h1 is inside the open shadow root of `j-page-header`. It is the
  same on all five pages, so it does not identify the page.
- The page-specific heading is
  `section.my-joy-visits-view h2.screen-reader-only`. On `match`, `top`, `fav`
  and `visits` it has `id="profile-visiting-member-rating-heading"`. On
  `visitors` the id was not recorded (Unclear).
- Best page key: `location.pathname`, or `j-pill-navigation` attribute
  `active-index` (`0` visitors, `1` match, `2` top, `3` fav, `4` visits).
- No `data-e2e` hooks exist on these pages (`[data-e2e]` count: 0).
- Section class is `my-joy-visits-view my_joy_view` on all five pages, including
  the voting pages.

## Shared structure

All five pages use one identical component tree:

```
main.my_joy.my_joy-wide                         (display: grid)
├─ div.my_joy_header.page-header
│  └─ j-page-header                             (open shadow, h1 inside)
│     └─ j-pill-navigation#my-joy-visits-and-voting-navigation [active-index, slot]
│        └─ j-pill × 5                          (open shadow: a.j-pill[href])
└─ section.my-joy-visits-view.my_joy_view
   ├─ h2.screen-reader-only                     (page heading)
   └─ div                                       (no class)
      ├─ div.card-grid-container                (display: grid)  ← GRID
      │  ├─ aside > j-card                      (summary/CTA card, not a member)
      │  └─ ul.card-grid-container-list         (display: contents)
      │     ├─ li > j-member-card               ← SLOT > CARD
      │     └─ li.card-grid-placeholder-card > j-card[is-placeholder][aria-hidden]
      └─ div.load_more_container                (empty in all observations)
```

Differences:

- `visits` has no `aside` card. The other four pages have one `aside > j-card`
  as the first grid item (sanitized texts: visitors "00000 Mitglieder haben dein
  Profil besucht"; match "Du hast 00 Matches … Jetzt voten!"; top "0000
  Mitglieder finden dich gut … Jetzt voten!"; fav "Du willst mehr? … Jetzt
  voten!").
- Card attribute `voting` (integer) occurs on some cards on `visitors`, `fav`
  and `visits`. Not seen on `match` or `top`.
- Card badge content differs by page: relative day on `visitors`, `top`,
  `visits` ("Heute", "Gestern", weekday name); date `00.00.` on `match`, `fav`.
- Cards without a profile type were seen only on `visits` (see Profile type).

Card internals (open shadow root of `j-member-card`, sanitized):

```
j-member-card [universal-gender=int, verification-status=int, user-name=NAME,
               is-online=bool, is-new=bool, is-interactive=bool, age=00,
               age2=00 (couples only), voting=int (some pages)]
├─ (light DOM) div.image-ui.vue-variant.adaptive[slot="image"] > … picture (IMG)
└─ #shadow-root (open)
   └─ a.j-card.j-card--square.j-card--interactive[href="/profile/0.NAME.html"][target]
      ├─ div.media
      │  ├─ slot[name="image"]
      │  ├─ div.media-content
      │  │  ├─ div.badge-container > div.badge-container-left > j-badge-new
      │  │  │                      > div.badge-container-right > slot[name="badge-top-right"]
      │  │  ├─ div.media-overlay > slot[name="media-overlay"]
      │  │  └─ div.badge-container > div.badge-container-right > j-badge[is-on-image][content=TEXT]
      │  └─ div.badge-corner > slot[name="badge-corner"]
      └─ div.content
         ├─ div.j-member-card__title
         │  ├─ div.j-member-card__user-name[title=NAME]  NAME
         │  └─ div.j-member-card__online-icon
         ├─ div.j-member-card__user-info
         │  ├─ div  "00 Jahre" | "00+00 Jahre"
         │  ├─ j-gender-icon.j-member-card__user-info__gender[size="12", universal-gender=int,
         │  │     highlighted-gender="[]", a11y-label="", a11y-title=""]
         │  └─ j-veri-icon.j-member-card__user-info__veri[size="12", verification-status=int]
         └─ div.j-member-card__location-info
            ├─ div.j-member-card__location-info__city[title=PLACE]  PLACE
            └─ div.j-member-card__location_info__distance  "< 00 km" | "000 km"
```

Note the class name mix: `__location-info__city` (hyphen) but
`__location_info__distance` (underscore). Copied as seen.

## Fields

| Page | Field        | Present?                            | Primary selector                                                    | Fallback selector                                                                                      | Expected cardinality | Matches                                                          | Validation rule                                                               | Missing state                                     | Value shape                                                        | Notes                                                                                                                                                                                                                                                                                                                                                                                                   |
| ---- | ------------ | ----------------------------------- | ------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ | -------------------- | ---------------------------------------------------------------- | ----------------------------------------------------------------------------- | ------------------------------------------------- | ------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| all  | grid         | Yes                                 | `section.my-joy-visits-view div.card-grid-container`                | `.card-grid-container`                                                                                 | 1 per page           | 1 on each page                                                   | `display` = `grid`                                                            | n/a                                               | element                                                            | Same `div` on all five. Holds `aside` + `ul`. Lowest element that holds every card is `ul.card-grid-container-list` (`display: contents`), so its `li` children are the effective grid items.                                                                                                                                                                                                           |
| all  | card slot    | Yes                                 | `ul.card-grid-container-list > li:not(.card-grid-placeholder-card)` | `li:has(> j-member-card)`                                                                              | 1 per card           | 00 per page on first load, at most 40 (owner's counts sanitized) | `li` whose only child is `j-member-card`                                      | n/a                                               | element                                                            | Slot wraps only the card. Siblings `li.card-grid-placeholder-card` hold `j-card[is-placeholder="true"][aria-hidden="true"]`; they fill the last row and use responsive `hidden-xl/lg/md/sm/xs` classes. Always 4 at list end. Do not count or hide them.                                                                                                                                                |
| all  | card         | Yes                                 | `j-member-card`                                                     | `ul.card-grid-container-list > li > j-member-card`                                                     | 1 per slot           | same as slot count                                               | custom element with open `shadowRoot`                                         | n/a                                               | element                                                            | Open shadow root: yes. Attributes: `universal-gender` int, `verification-status` int, `user-name` NAME, `is-online` bool, `is-new` bool, `is-interactive` bool, `age` 00, `age2` 00 (couples), `voting` int (some pages), plus Vue `data-v-*`.                                                                                                                                                          |
| all  | profile type | Yes (Absent on some `visits` cards) | `j-member-card[universal-gender]` → attribute value                 | `card.shadowRoot.querySelector("j-gender-icon.j-member-card__user-info__gender")` → `universal-gender` | 0 or 1 per card      | every card on visitors, match, top, fav; all but a few on visits | integer attribute in {1,2,3}; card and icon value always equal (0 mismatches) | attribute absent AND no `j-gender-icon` in shadow | `1` \| `2` \| `3`                                                  | Also readable as text: icon shadow `div.j-gender-icon[title]` / `[aria-label]` = "Mann" / "Frau" / "Paar". Not visible text. Codes seen per page: visitors 1,3; match 1,2,3; top 1,3; fav 1,2,3; visits 1,2,3.                                                                                                                                                                                          |
| all  | member link  | Yes                                 | `card.shadowRoot.querySelector("a.j-card[href]")`                   | `card.shadowRoot.querySelector("a[href*='/profile/']")`                                                | 1 per card           | every card                                                       | href matches `^https://www.joyclub.de/profile/\d+(\.[^/]+)?\.html$`           | not seen                                          | `https://www.joyclub.de/profile/0.NAME.html` or `…/profile/0.html` | Whole card is the link (`a.j-card` wraps media and content). Recorded for later only.                                                                                                                                                                                                                                                                                                                   |
| all  | mark place   | Yes                                 | light-DOM child of `j-member-card` with `slot="badge-top-right"`    | shadow `div.j-member-card__title` (append after `.j-member-card__online-icon`)                         | 1 per card           | slot exists on every card                                        | `slot[name="badge-top-right"]` exists in shadow                               | n/a                                               | slot                                                               | Other free named slots: `badge-corner`, `media-overlay`. Using a slot keeps JoyFox nodes in light DOM, outside Vue's shadow render (inference: safer against re-render).                                                                                                                                                                                                                                |
| all  | bar place    | Partly                              | `j-pill-navigation#my-joy-visits-and-voting-navigation`             | `div.my_joy_header.page-header`                                                                        | 1 per page           | 1                                                                | `active-index` int 0–4                                                        | n/a                                               | element                                                            | Element directly before the grid's parent `div` is `h2.screen-reader-only` (hidden). Tabs are NOT next to the grid; they are in the page header inside `j-page-header`. Tab labels: "Profilbesuche", "Matches", "Mögen mich", "Mag ich", "Besuchte Profile". Each `j-pill` has an open shadow `a.j-pill[href]`; active one has `j-pill[active]` and `a[aria-current="true"]`. No filter controls found. |

## Profile type codes

| Code | Icon title / aria-label | Icon shadow structure                                                      | Card extras                              |
| ---- | ----------------------- | -------------------------------------------------------------------------- | ---------------------------------------- |
| `1`  | "Mann"                  | `div.j-gender-icon > svg#ic-gender-1`                                      | `age` only; age text "00 Jahre"          |
| `2`  | "Frau"                  | `div.j-gender-icon > svg#ic-gender-2`                                      | `age` only; age text "00 Jahre"          |
| `3`  | "Paar"                  | `div.j-gender-icon > svg#ic-gender-2 + svg#ic-gender-1` (two sibling SVGs) | `age` and `age2`; age text "00+00 Jahre" |

**Couple answer:** a couple is ONE `j-gender-icon` with ONE code, `3`. The
icon's shadow root draws two SVGs side by side (female glyph `ic-gender-2`, then
male glyph `ic-gender-1`). Couple card, sanitized:

```
j-member-card[universal-gender="3"][age="00"][age2="00"][user-name=NAME]…
  #shadow > … div.j-member-card__user-info
    div "00+00 Jahre"
    j-gender-icon[universal-gender="3"][highlighted-gender="[]"]
      #shadow > div.j-gender-icon[title="Paar"][aria-label="Paar"]
                  svg#ic-gender-2
                  svg#ic-gender-1
```

- `highlighted-gender` was `"[]"` on every icon seen. Meaning Unclear.
- Every card had exactly 0 or 1 `j-gender-icon`. Never 2.
- Other codes (for example trans or other types): not seen. Absent from this
  sample, not proven absent from the site.

**Cards with no type (seen on `visits` only):**

```
j-member-card[verification-status=int][user-name=NAME][is-online="false"]
             [is-new="false"][is-interactive="true"]
  (no universal-gender, no age, no age2)
  #shadow > a.j-card[href="/profile/0.NAME.html"]
    div.content
      div.j-member-card__title > div.j-member-card__user-name  NAME
                                 (no .j-member-card__online-icon)
      div.j-member-card__user-info
          (empty, or only j-veri-icon)          ← no age text, no j-gender-icon
      div.j-member-card__location-info  PLACE / "000 km"
```

- Image is still shown; card is not blurred or locked.
- `verification-status` values on these cards: `0`, `3`, `6`. Typed cards showed
  only `1` and `3`.
- Inference (not verified): these may be non-person profiles (for example clubs,
  locations or deleted/reduced accounts). JoyFox should treat them as "type
  unknown", not as an error.

## Navigation

| Move | From → To          | How                         | `window.__jf` after | `__jfRestored` | `navigation.type`        | Result                      |
| ---- | ------------------ | --------------------------- | ------------------- | -------------- | ------------------------ | --------------------------- |
| 0    | (start) → visitors | URL                         | n/a                 | 0              | `navigate`               | Full page load              |
| 1    | visitors → match   | `j-pill` "Matches"          | `move-1`            | 0              | `navigate` (from move 0) | Client-side (same document) |
| 2    | match → top        | `j-pill` "Mögen mich"       | `move-2`            | 0              | `navigate` (from move 0) | Client-side                 |
| 3    | top → fav          | `j-pill` "Mag ich"          | `move-3`            | 0              | `navigate` (from move 0) | Client-side                 |
| 4    | fav → visits       | `j-pill` "Besuchte Profile" | `move-4`            | 0              | `navigate` (from move 0) | Client-side                 |

- Tab moves are SPA route changes (pathname changes, document stays). JoyFox
  must re-detect the page on URL change, not only on load.
- Whether the grid element is kept or replaced across a tab move: not tested
  (Unclear).
- First click on the Matches pill via an element ref did nothing because the
  page was scrolled to the end. The pill was clicked again at its screen
  position after scrolling to top. No other click was made.

## Loading

| Page     | Cards at load       | After scroll 1 | After scroll 2 | URL change | More button / pages | Grid kept                 |
| -------- | ------------------- | -------------- | -------------- | ---------- | ------------------- | ------------------------- |
| visitors | one full batch      | +40            | +40            | No         | None                | Yes (same `div` and `ul`) |
| match    | 00, under one batch | no change      | not needed     | No         | None                | Yes                       |
| top      | one full batch      | +40            | +40            | No         | None                | Yes                       |
| fav      | 00, under one batch | no change      | not needed     | No         | None                | Yes                       |
| visits   | one full batch      | +40            | +40            | No         | None                | Yes                       |

Card counts are sanitized (owner, 2026-09-29): the repository is public, and a
list's size is the owner's own activity data. A list shorter than one batch of
40 was complete; it grew by 40 per scroll otherwise.

- Infinite scroll. New `li > j-member-card` items are appended to the same
  `ul.card-grid-container-list`, in batches of 40.
- `div.load_more_container` stayed empty. No pagination element found
  (`.pagination`, `[class*=pager]`, `[class*=paging]`: 0).
- Placeholders: always 4 `li.card-grid-placeholder-card` at the end of the list
  (indexes n…n+3), before and after loading. Their visibility depends on
  breakpoint classes (on `fav` at 1296 px, 2 were visible). No separate skeleton
  cards seen during loading (Unclear whether they flash briefly).
- JoyFox should use a `MutationObserver` on `ul.card-grid-container-list`
  (inference).

## Empty list

Not observed. All five lists had cards. Empty-state selector and label: Unclear.
Needs an account with an empty list (for example a new account's `match` page).

## Open questions

1. `h2` id on `visitors` after a full load (seen only after client-side moves).
2. Grid identity across tab moves (kept or re-rendered).
3. Empty-state markup.
4. Meaning of `highlighted-gender` and of `verification-status` values `0`, `6`.
5. Placeholder behavior when JoyFox hides slots (placeholders may no longer fill
   the last row exactly).
6. Other profile type codes beyond 1, 2, 3.
