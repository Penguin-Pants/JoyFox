# Member search

Captured 2026-09-26 with Claude in Chrome from the owner's account, using the
first version of `capture-prompt-e1-e4.md` (before its review fixes). Sanitized
again on review: the owner's own search settings (sought genders, age range,
radius) were replaced with shapes.

Method: Opened the member search from the ClubMail inbox via the main nav link
"Mitglieder". Opened the filter panel, changed two ordinary filters (Umkreis and
Alter upper bound) and pressed "Anwenden". Inspected the page DOM, the result
list and one result card (light DOM and the `j-member-card` shadow root) with
read-only `querySelectorAll` and attribute reads. Scrolled the result list once.
Replayed the results URL in a second tab and compared the first 12 result links.
No profile was opened from the results. Only structure and value shapes were
recorded.

## Page signal

- URL pattern (entry): `/member/`
- URL pattern (after applying filters):
  `/member/PLACE-as-r/is-GENDER_GENDER/?user_geo_distance=00&user_age=00_00&user_match_opposite_search_criteria=0&user_ff=000000#infiniteScroll`
  - Path segment 2: location slug + `-as-r` (meaning of `as-r` unclear).
  - Path segment 3: `is-` + sought genders as German words joined with `_` (the
    owner's value is not recorded). Inference: follows the "Ich suche" filter.
- Unique root/signal: `[data-e2e="search-filter-button"]` +
  `div.member_search_list` (1 each).

## Identity

- Member ID: in the card link `href`, `/profile/0000000.NAME.html` (7 or 8
  digits seen, then a lowercase nickname slug). Selector
  `a[data-e2e="result-item"]`. No `data-*` member ID attribute on the card.
- Photo ID: `div.image-ui[data-img_id]` inside the card (8 digits),
  `data-img_module="gallery"`. This is an image ID, not a member ID.

## Query parameters

| Parameter                             | Value shape                 | Filter it follows                            |
| ------------------------------------- | --------------------------- | -------------------------------------------- |
| `user_geo_distance`                   | integer, km (2 digits seen) | Umkreis                                      |
| `user_age`                            | `00_00` (lower_upper)       | Alter                                        |
| `user_match_opposite_search_criteria` | `0` or `1`                  | "Nur Mitglieder, deren Suche ich entspreche" |
| `user_ff`                             | integer, 6 digits           | Inference: location/geo ID for "Ort"         |
| hash `#infiniteScroll`                | literal                     | Always present after search                  |

- **Key answer: yes, the URL changes when a filter changes.** The change was
  client-side (`window.__jf` stayed `1`).
- **Replay:** the results URL opened in a fresh tab (full load) returned the
  same results: 12 of 12 top links identical, same order. The filter panel
  showed the same values (distance slider `value="0"`, age
  `lower="00" upper="00"`).
- Caveat: filter values may also persist on the account server-side. The replay
  did not isolate URL-only replay from stored state.
- Note: the distance slider stores a step index (`value="0"`), while the URL
  stores kilometers.

## Fields

| Field            | Present?  | Selector                                                                                                        | Matches      | Value shape                         |
| ---------------- | --------- | --------------------------------------------------------------------------------------------------------------- | ------------ | ----------------------------------- |
| Result list root | Yes       | `div.member_search_list`                                                                                        | 1            | container                           |
| Result card link | Yes       | `a[data-e2e="result-item"]` (class `member_search_result_link`)                                                 | 60 per batch | `href` `/profile/0000000.NAME.html` |
| Card component   | Yes       | `j-member-card.member_search_result_card`                                                                       | 60           | web component, shadow DOM           |
| Name             | Yes       | `j-member-card[user-name]` attribute; shadow: `.j-member-card__user-name`                                       | 60           | `NAME`                              |
| Age              | Yes       | `j-member-card[age]`, `[age2]` (second partner, couples only)                                                   | 60           | integer, 2 digits                   |
| Gender           | Yes       | `j-member-card[universal-gender]`; shadow: `j-gender-icon.j-member-card__user-info__gender[universal-gender]`   | 60           | single-digit code (seen 2, 3, 7)    |
| Verification     | Yes       | `j-member-card[verification-status]`; shadow: `j-veri-icon.j-member-card__user-info__veri[verification-status]` | 60           | single-digit code (seen 0, 1, 3)    |
| Online           | Yes       | `j-member-card[is-online]`                                                                                      | 60           | `true` / `false`                    |
| New member       | Yes       | `j-member-card[is-new]`                                                                                         | 60           | `true` / `false`                    |
| Voting badge     | Sometimes | `j-member-card[voting]`                                                                                         | subset       | present or absent                   |
| Age line text    | Yes       | shadow: `.j-member-card__user-info > div`                                                                       | 60           | "00 Jahre" or "00+00 Jahre"         |
| Place            | Yes       | shadow: `.j-member-card__location-info__city`                                                                   | 60           | `PLACE`                             |
| Distance         | Yes       | shadow: `.j-member-card__location_info__distance` (note underscore)                                             | 60           | "< 00 km"                           |
| Photo            | Yes       | `j-member-card > div.image-ui[slot="image"]`                                                                    | 60           | `IMG`                               |
| Photo count      | Absent    | searched card light DOM and shadow root for a count                                                             | 0            | –                                   |

### Badge slots (where a JoyFox badge could go)

Shadow root of `j-member-card` exposes named slots. A light-DOM child with the
matching `slot` attribute renders there:

- `slot[name="badge-top-right"]` inside `.badge-container-right` (top-right over
  the photo). Best candidate.
- `slot[name="badge-corner"]` inside `.badge-corner`.
- `slot[name="media-overlay"]` inside `.media-overlay`.
- Name row: shadow `.j-member-card__title` (no slot; would need an append into
  the shadow root).

### Filter panel

- Open button: `[data-e2e="search-filter-button"]` (div, icon only). Name
  search: `j-control-button[data-e2e="search-name-button"]` label "Namenssuche
  öffnen", input `j-active-search[data-e2e="name-search-input"]`.
- Panel root: `[data-e2e="filter-overlay"]` (heading "Filter").
- Apply: `j-button[data-e2e="apply-filter-button"]` "Anwenden". Also
  `j-button[data-e2e="search-button"]` "Suchen" (name search).

| Control                    | Element                  | `data-e2e`            | Label                                                                                                                                   |
| -------------------------- | ------------------------ | --------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| Gender sought              | `j-setting-multi-select` | `filter-gender`       | Ich suche (items: Frauen `f`, Männer `m`, Paare `p`, Non-binary `nb`)                                                                   |
| Interest                   | `j-setting-select`       | `filter-interest`     | Mit Interesse an (Männern `m`, Frauen `w`, Paaren `p`, egal `e`)                                                                        |
| Location                   | `j-setting-autocomplete` | `filter-location`     | Ort                                                                                                                                     |
| Radius                     | `j-setting-slider`       | `filter-distance`     | Umkreis (attrs `min max step value unit`)                                                                                               |
| Age                        | `j-setting-range-slider` | `filter-age`          | Alter (attrs `min max step lower upper`)                                                                                                |
| New                        | `j-setting-checkbox`     | `filter-new`          | Neu angemeldet                                                                                                                          |
| Relationship               | `j-setting-select`       | `filter-relationship` | Beziehungsstatus                                                                                                                        |
| Checkboxes without hook    | `j-setting-checkbox`     | –                     | Nur Mitglieder, deren Suche ich entspreche; Nur Mitglieder mit Bild; Jetzt online; Nur geprüfte Mitglieder; Interesse an Foto-Shootings |
| Other selects without hook | `j-setting-select`       | –                     | Figur; Trans\* Menschen; Angemeldet als (more below the fold)                                                                           |

- Sort control: Absent. Searched `[class*=sort]`, `[data-e2e*=sort]` and visible
  controls.

## Loading and navigation

- Infinite scroll: 60 cards on load; one scroll to the bottom loaded 60 more
  (120). URL did not change. No pagination and no "more" button. A `j-spinner`
  is in the page.
- Inbox → search (nav link): full page load.
- Filter apply: client-side, URL path and query updated in place.
- Search → one result's profile: **not tested** (no already-visited profile was
  in the results; rule 4). Card link is a plain `<a href>` with no `target`.
  Inference: full page load, because profile pages are server-rendered
  (`body.body_profile`).
- Back from profile to results: not tested.

## Skipped or unclear

- Meaning of path token `as-r` and of `user_ff`: Unclear (inference: location
  ID).
- Whether stored filter state or the URL drives the replayed results: Unclear
  (see caveat).
- Full list of select filters below "Angemeldet als": not recorded.
- Side effect: the owner's saved search filters changed (Umkreis and the Alter
  upper bound). The owner was told the old values.
