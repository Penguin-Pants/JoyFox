# Feature specification: profile type filter on "My JOY" lists

Status: draft for owner confirmation (2026-09-29). Task ID: V1-14 (proposed).

## Problem

JoyClub Premium shows who visited the user's profile ("Profilbesuche") as a card
grid on `/my_joy/visitors/`. Four sibling lists (matches, liked you, you like,
you visited) use their own pages. Each card shows the member's profile type
(man, woman or couple), but JoyClub has no filter for it. A user who wants to
see, for example, only the women and couples who visited must scan every card.

## Goals

- G1. On the five "My JOY" list pages, the user can show only the loaded cards
  of one or more profile types: Man, Woman, Couple, Unknown.
- G2. The choice lasts for the browser tab across the five pages and across
  reloads.
- G3. The user always sees how many loaded cards the filter shows, so no card
  disappears silently.
- G4. JoyFox adds no request to JoyClub and stores no data about the members on
  these pages.

## Non-goals

- JoyFox does not load more cards, scroll, click JoyClub controls or call any
  JoyClub address.
- No split of couple types (two women, two men). JoyFox knows only code `3`.
- No JoyFox card signals (completeness badge, trust score, tags, shared
  preferences) on these cards. Deferred.
- No storage of visitors, visit times or nicknames from these pages.
- No options-page setting or on/off switch.
- No change to the contact rule. ADR 0016's decision (no profile-type rule
  condition) stays.
- No other "My JOY" or JoyClub pages (friends lists and so on).

## Users and use cases

The user is the owner of a JoyClub Premium account who uses JoyFox.

- UC1. Open "Profilbesuche", tick Woman and Couple, and see only the women and
  couples among the loaded visitors.
- UC2. With Woman ticked, click JoyClub's "Matches" tab. The Matches list opens
  with Woman still ticked.
- UC3. Scroll down. The cards JoyClub adds are filtered as they appear, and the
  count updates.
- UC4. Untick all boxes. Every card shows again.
- UC5. Tick Unknown to also see cards whose type JoyFox cannot read.

## Current behavior

- JoyFox runs its content script on every `joyclub.de` page but detects only
  verified pages (`src/selectors/registry.ts`). The five "My JOY" pages have no
  evidence, so JoyFox does nothing there.
- JoyClub's cards show a profile type icon. On verified pages this icon is
  `j-gender-icon[universal-gender]` with codes `1` man, `2` woman, `3` couple
  (owner, 2026-09-23). `profileTypeFromCode` in `src/extraction/joyclub.ts` maps
  these codes and has no caller.
- Two JoyFox features already filter JoyClub's loaded cards in place: "JoyFox:
  hide incomplete profiles" on member search and the event list filter on "Dates
  & Events". Both set attributes that JoyFox's CSS uses to hide items. Neither
  loads more items.

## Required behavior

### Pages

| Page (path)             | JoyClub list         |
| ----------------------- | -------------------- |
| `/my_joy/visitors/`     | Who visited you      |
| `/my_joy/voting/match/` | Mutual matches       |
| `/my_joy/voting/top/`   | Who liked you        |
| `/my_joy/voting/fav/`   | Profiles you like    |
| `/my_joy/visits/`       | Profiles you visited |

### Workflow

1. The user opens one of the five pages.
2. When the card grid has rendered, JoyFox places the "Profile type" bar
   directly before the grid.
3. The bar shows four unticked checkboxes: Man, Woman, Couple, Unknown. No card
   is hidden or marked, and no count or hint shows.
4. The user ticks one or more boxes. At once:
   - Each loaded card whose type is ticked stays visible. "Unknown" is a type
     like the others.
   - Each loaded card whose type is not ticked is hidden.
   - Each visible card of unknown type gets a "Type unknown" mark.
   - The bar shows "Showing X of Y loaded". When Unknown is not ticked and N
     unknown cards are hidden (N more than 0), it adds "N with unknown type
     hidden".
   - The bar shows the hint "Scroll down to load more."
5. The user scrolls. JoyClub adds cards. JoyFox applies the filter to each new
   card and updates the count.
6. The user unticks all boxes. All cards show, the marks go and the count goes.
7. The user moves to another of the five pages, or reloads, in the same tab. The
   bar starts with the same boxes ticked.

## UX requirements

- **Placement:** one bar, directly before the card grid, in the style of the
  other JoyFox bars (`joyfox-panel`), in JoyClub's light and dark theme.
- **Controls:** a group labeled "Profile type" ("Profiltyp") with four native
  checkboxes: "Man" ("Mann"), "Woman" ("Frau"), "Couple" ("Paar"), "Unknown"
  ("Unbekannt"), in that order.
- **Default:** all unticked. Unticked all means no filter.
- **Feedback:** the count line changes at once on each tick and each added card.
- **Scroll hint:** "Scroll down to load more." ("Nach unten scrollen, um mehr zu
  laden.") in the bar, next to the count, whenever at least one box is ticked.
  It is not placed in JoyClub's grid.
- **Loading:** the bar appears only after the grid root has rendered. Before
  that, nothing shows.
- **Empty grid:** when the list has no cards and a box is ticked, the count
  reads "Showing 0 of 0 loaded". JoyFox adds no other empty-state text.
- **All loaded cards hidden:** the count reads "Showing 0 of Y loaded", with the
  scroll hint.
- **Unknown mark:** a short text label "Type unknown" ("Typ unbekannt") on the
  card, shown only while at least one box is ticked.
- **Accessibility:** a `fieldset` with a `legend`, native checkboxes with
  labels, the count in a polite live region, and keyboard focus kept on the same
  checkbox after the bar redraws.
- **Language:** German and English, following JoyFox's language setting; a
  language switch updates an open bar at once.
- **Narrow windows:** the bar wraps and never makes the page scroll sideways.

## Functional requirements

- **FR-01 Evidence gate.** A new evidence file,
  `docs/live-evidence/17-my-joy-lists.md`, records for each of the five pages:
  the path, a root element, the card element, the profile type icon on a card
  and its code, how more cards load, and whether moving between the pages is a
  full page load or client-side. A page is detected only when its registry entry
  is verified from that file.
- **FR-02 Detection.** JoyFox detects the five paths in the table above on
  `www.joyclub.de` only, as one page type, when the evidence-verified root is
  present.
- **FR-03 Bar.** On a detected page, exactly one JoyFox "Profile type" bar, with
  the four checkboxes Man, Woman, Couple and Unknown, is placed directly before
  the grid root. It is removed when the user leaves the five pages.
- **FR-04 Type reading.** A card's type comes only from its evidence-verified
  profile type code, mapped with `PROFILE_TYPE_CODE_MEANING`: `1` man, `2`
  woman, `3` couple. A missing icon, a missing or non-numeric code, or any other
  code reads as unknown. If the evidence shows that a card draws a couple in
  another form (for example two icons), the evidence file defines the rule, and
  JoyFox never infers it.
- **FR-05 No selection.** With no box ticked, JoyFox hides no card, marks no
  card and shows no count and no hint.
- **FR-06 Selection.** With one or more boxes ticked, a card shows only when its
  type (man, woman, couple or unknown) is ticked. Each visible card of unknown
  type carries the "Type unknown" mark.
- **FR-07 Count.** With one or more boxes ticked, the bar shows "Showing X of Y
  loaded", where Y is the number of cards in the grid and X the number not
  hidden. When Unknown is not ticked and N cards of unknown type are hidden, N
  more than 0, it adds "N with unknown type hidden".
- **FR-16 Scroll hint.** With one or more boxes ticked, the bar shows "Scroll
  down to load more." With no box ticked, it does not.
- **FR-08 Added cards.** Cards that JoyClub adds or changes in place are
  filtered and counted within one navigation-coordinator cycle of the change.
- **FR-09 Tab persistence.** The ticked types are kept in the tab's session
  storage under one key shared by the five pages, as a list of type names only.
  A missing, blocked or invalid value means no box is ticked. Unticking all
  boxes removes the key.
- **FR-10 In-place hiding.** JoyFox hides a card only by setting its own
  `data-joyfox-*` attributes that JoyFox's CSS uses. It never removes, moves or
  reorders JoyClub's elements. The hidden unit is the card's grid slot, so the
  grid has no empty gaps (exact element from the evidence).
- **FR-11 No requests.** The feature sends no message to JoyFox's background, no
  network request, and never scrolls or clicks.
- **FR-12 No storage.** The feature writes nothing to IndexedDB or extension
  storage. It never logs a nickname, member ID, age or place from a card.
- **FR-13 Clean exit.** On leaving the five pages, JoyFox removes the bar, its
  attributes and its marks from the page.
- **FR-14 Language.** All bar and mark text comes from the `de` and `en`
  catalogs. A language change redraws an open bar without losing the ticked
  boxes.
- **FR-15 Documentation.** `docs/selector-map.md`, the README "Features"
  section, `docs/manual-acceptance.md`, `Task Backlog.md` (new V1-14 row) and
  `docs/i18n-strings.md` describe the feature. The statement "No feature filters
  by profile type" in `selector-map.md` is corrected to say that the contact
  rule does not, and this display filter does.

## Edge cases and failure modes

| Case                                                        | Required behavior                                                                            |
| ----------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| Evidence shows no profile type code on cards (text only)    | Stop. Owner decides whether JoyFox may read the type from text. No code is built on a guess. |
| One page's cards differ from the others                     | That page stays unverified and undetected. The other pages work.                             |
| Couple code other than `3` (for example two women)          | Reads as unknown: shown, and marked, only when Unknown is ticked.                            |
| Non-Premium account (blurred or locked cards)               | Cards without a readable code read as unknown.                                               |
| Session storage blocked                                     | The choice lasts only for the current page. No error shown.                                  |
| Stored value holds an unknown type name                     | That name is ignored. If none is valid, no box is ticked.                                    |
| JoyClub re-renders the grid (new root element)              | JoyFox drops its marks from the old root and applies the filter to the new one.              |
| JoyClub's scroll code loads more because the grid got short | JoyFox does not prevent or cause it. New cards are filtered.                                 |
| Grid root never renders                                     | No bar. Nothing else changes.                                                                |
| JoyFox account switch                                       | No effect: the filter holds no account data.                                                 |

## Technical constraints

Confirmed from the repository:

- Selectors must come from sanitized live evidence; `data-v-*` attributes are
  forbidden (`docs/selector-map.md`, a test enforces it).
- Only `www.joyclub.de` is a verified host (`VERIFIED_HOSTS`).
- Page detection is path first, then root (`src/content/page-detector.ts`).
- The navigation coordinator already watches `universal-gender` attribute
  changes and child-list mutations (`src/content/navigation-coordinator.ts`).
- `ProfileType`, `PROFILE_TYPE_CODE_MEANING` and `profileTypeFromCode` exist
  (`src/extraction/joyclub.ts`).
- The event list filter keeps its choice in the page's session storage, which
  JoyClub's scripts can read (`src/content/event-list-filter.ts`). The same
  applies here; the stored value holds only type names.
- The content script is already injected on all `joyclub.de` pages. No manifest
  or permission change is needed.
- UI text is in `src/i18n/catalog/de.ts` and `en.ts`.

## Acceptance criteria

- **AC-01** On each of the five pages, after the grid renders, exactly one
  "Profile type" bar with unticked Man, Woman, Couple and Unknown checkboxes is
  directly before the grid.
- **AC-02** With no box ticked, every card is visible, no card has a JoyFox mark
  and the bar shows no count and no scroll hint.
- **AC-03** With a grid of 2 man, 2 woman, 2 couple and 1 unknown-code card,
  ticking Woman shows only the 2 woman cards, marks no card and shows "Showing 2
  of 7 loaded", "1 with unknown type hidden" and "Scroll down to load more."
- **AC-04** Ticking Woman and Couple in the same grid shows 4 cards and shows
  "Showing 4 of 7 loaded" and "1 with unknown type hidden".
- **AC-05** Ticking Woman and Unknown in the same grid shows 3 cards, marks only
  the unknown card "Type unknown" and shows "Showing 3 of 7 loaded" without an
  unknown-hidden text.
- **AC-06** Unticking all boxes shows all 7 cards and removes all marks, the
  count and the hint.
- **AC-07** With Woman ticked, appending 2 woman cards and 1 man card to the
  grid shows the 2 new woman cards, hides the new man card and shows "Showing 4
  of 10 loaded".
- **AC-08** A card whose code changes in place from `1` to `2` while Woman is
  ticked becomes visible and the count updates.
- **AC-09** With Woman and Couple ticked, loading another of the five pages in
  the same tab shows the bar with Woman and Couple ticked and the filter
  applied.
- **AC-10** A new tab on any of the five pages starts with no box ticked.
- **AC-11** With session storage throwing on access, ticking a box still filters
  the page and no error shows.
- **AC-12** A stored value of `["woman","robot"]` starts with only Woman ticked;
  a stored value that is not valid JSON starts with no box ticked.
- **AC-13** Leaving the five pages for another JoyClub page removes the bar and
  every `data-joyfox-*` attribute the feature set.
- **AC-14** During the whole feature flow, JoyFox makes no network request,
  sends no runtime message and writes nothing to IndexedDB or extension storage.
- **AC-15** Switching the JoyFox language between German and English while the
  bar is open changes the bar text and keeps the ticked boxes.
- **AC-16** With the keyboard only, the user can reach and toggle each checkbox;
  after a toggle, focus stays on that checkbox; the count is in an
  `aria-live="polite"` region.
- **AC-17** On a page outside the five paths, and on a host other than
  `www.joyclub.de`, no bar appears.
- **AC-18** Live check: on the owner's Premium account, ticking a type on each
  of the five pages hides only cards of other known types, the grid shows no
  empty gaps, and scrolling filters new cards.
- **AC-19** `npm test`, `npm run lint`, `npm run typecheck`,
  `npm run format:check`, `npm run build:firefox` and `npm run build:chrome`
  pass.

## Testing requirements

- **Unit:** type reading from a card (codes 1, 2, 3, other, missing, two icons);
  match decision; session value encode and decode with invalid input.
- **Integration (jsdom):** a synthetic fixture per page built from the evidence;
  AC-01 to AC-17.
- **Regression:** existing page-detection tests still pass; the network
  isolation test covers the new module; the `data-v-*` test covers the new
  selectors.
- **Manual:** new `manual-acceptance.md` items for AC-18, the dark theme, a
  narrow window and German text.

## Documentation requirements

- New `docs/live-evidence/17-my-joy-lists.md` and a capture prompt for it.
- Update `docs/live-evidence/README.md`, `docs/selector-map.md`, README
  "Features", `docs/manual-acceptance.md`, `Task Backlog.md`,
  `docs/i18n-strings.md`.
- No privacy-model change: nothing new is stored.

## Deferred items

- D-1. JoyFox card signals (completeness, trust, tags, shared preferences) on
  "My JOY" cards.
- D-3. Split couple types (two women, two men), if JoyClub exposes them.
- D-5. The same filter on other JoyClub member lists (friends and so on).
- D-6. Filter by other card facts (age, place).

## Review notes (2026-09-29)

Confirmed issue, fixed: FR-04 first read "more than one icon = unknown". A
couple can be drawn as two icons, so that rule could hide nothing but mark every
couple unknown. The evidence now defines the couple form.

Possible risks, not proven:

- R-1. The "Type unknown" mark and the gap-free hiding depend on the card
  structure (for example a web component with a shadow root). The evidence
  decides where the mark goes; it may have to sit next to the card, not in it.
- R-2. The tab's session storage is readable by JoyClub's scripts, so JoyClub
  could see which types the user filters for. The event list filter accepted the
  same exposure. The value holds only type names.
- R-3. With a narrow selection, the grid can be short and JoyClub's own scroll
  code may load pages quickly. JoyFox does not cause it and does not stop it.

Scope confirmed by the owner on 2026-09-29: the spec plus D-2 (an Unknown
choice) and D-4 (a scroll hint), both now in the spec. D-1, D-3, D-5 and D-6
stay deferred.

## Open questions

None.

## Implementation plan

Status: waits for evidence E5 (`docs/live-evidence/capture-prompt-e5.md`).
Selectors below in angle brackets come from that evidence.

### Steps (in order)

1. **Evidence (owner).** Run the E5 prompt. Add
   `docs/live-evidence/17-my-joy-lists.md` and a row in
   `docs/live-evidence/README.md`. If a page's cards carry no profile type code,
   stop and ask the owner (edge case table, first row).
2. **Registry** (`src/selectors/registry.ts`). Add the page type `my-joy-list`:
   `status: "verified"`, `evidence: "17-my-joy-lists.md"`,
   `path: "^/my_joy/(?:visitors|visits|voting/(?:match|top|fav))/?$"`,
   `root: <grid root>`, fields `grid`, `slot`, `card`, `genderCode`,
   `markPlace`. Add it to `DETECTION_ORDER` in `src/content/page-detector.ts`. A
   page that differs in the evidence leaves its path out of the pattern.
3. **Type reading** (`src/extraction/joyclub.ts`). Add
   `readCardProfileType(card)` that reads the code with the existing
   `codeAttribute` helper (in the card's open shadow root if the evidence says
   so) and maps it with `profileTypeFromCode`. It returns `"unknown"` for any
   other state.
4. **Filter module** (new `src/content/profile-type-filter.ts`), modeled on
   `EventListFilter`, with no background client:
   - `update()`, `leave()`, `localeChanged()`; an injectable session store.
   - Session key `joyfox.profileTypeFilter`, a JSON array of `man`, `woman`,
     `couple`, `unknown`. Read with try/catch; invalid entries dropped.
     `leave()` never clears the key, so the choice survives moves between the
     pages.
   - Bar: `fieldset` + `legend`, four native checkboxes with `FOCUS_KEY`,
     `rememberFocus`/`restoreFocus`, a count `span` with `role="status"` and
     `aria-live="polite"`, and the hint.
   - Apply: for each slot set `data-joyfox-type-match` to `yes` or `no`, and
     `data-joyfox-type-filter="on"` on the grid while filtering. Add or remove
     the `joyfox-type-unknown` mark. Write attributes, marks and count text only
     when they change, so JoyFox's own writes do not start endless passes.
   - A new grid root: unmark the old one first.
5. **CSS** (`src/content/content.css`).
   `[data-joyfox-type-filter="on"] [data-joyfox-type-match="no"] { display: none !important; }`,
   bar styles on `joyfox-panel` with `flex-wrap: wrap`, and a mark style that
   uses the existing theme variables.
6. **Wiring** (`src/content/index.ts`). Construct the filter; in the coordinator
   subscriber call `update()` for `my-joy-list` and `leave()` otherwise; call
   `localeChanged()` in `onLocaleChange`.
7. **Text** (`src/i18n/catalog/en.ts`, `de.ts`). Keys `typeFilter.legend`,
   `.man`, `.woman`, `.couple`, `.unknown`, `.count`, `.unknownHidden`,
   `.scrollHint`, `.unknownMark`. Regenerate `docs/i18n-strings.md` with
   `UPDATE_I18N_TABLE=1 npx vitest run tests/unit/i18n-table.test.ts`. The owner
   reviews the new German strings (`docs/i18n-spec.md`).
8. **Tests.**
   - `tests/unit/profile-type-filter.test.ts`: type reading, session value
     decode, match decision.
   - `tests/fixtures/joyclub/my-joy-list.html`: a sanitized fixture from the
     evidence (2 man, 2 woman, 2 couple, 1 unknown).
   - `tests/integration/profile-type-filter.test.ts`: AC-01 to AC-17.
   - Page detection tests for the five paths and for a near-miss path.
   - The existing network-isolation, `data-v-*` and i18n table tests cover the
     new code without changes.
9. **Docs.** `docs/selector-map.md` (surface row, page signal, fields, the
   corrected profile-type sentence), README "Features",
   `docs/manual-acceptance.md` (new items from 167: AC-18, dark theme, narrow
   window, German), `Task Backlog.md` (V1-14 row), and this file's status.
10. **Checks.** `npm test`, `npm run lint`, `npm run typecheck`,
    `npm run format:check`, `npm run build:firefox`, `npm run build:chrome`.

No data model, schema, migration, manifest, permission or background change.

### Plan review (2026-09-29)

Confirmed points, built into the steps above:

- JoyFox's own marks are child-list changes, which wake the navigation
  coordinator. Step 4 writes only on change, as the event filter does.
- A client-side move between the five pages can pass through a state with no
  grid root, which calls `leave()`. Step 4 keeps the session key on `leave()`,
  so AC-09 holds.
- JoyClub can replace the grid root on a tab change. Step 4 unmarks the old
  root.
- New German text needs the owner's review (`docs/i18n-spec.md`). Step 7 names
  it.

Removed as unsupported: a performance concern for large grids. The pass is one
`querySelectorAll` per debounced mutation, the same cost as the event filter.
