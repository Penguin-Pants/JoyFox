# Events: calendar list, event page, attendees

Captured 2026-09-26 with Claude in Chrome from the owner's account, using the
first version of `capture-prompt-e1-e4.md` (before its review fixes). Sanitized
again on review: the gender parameters that showed the owner's own event filter
were generalized.

Method: Opened "Dates & Events" from the ClubMail inbox via the main nav.
Clicked the "Samstag" quick filter, scrolled the list once, then opened the
first event card (link `target` removed so it opened in the same tab, to test
navigation type). Inspected DOM with read-only `querySelectorAll`, class and
attribute reads. No attendance, bookmark or ClubMail control was clicked. No
attendee names or IDs were recorded. Only structure and value shapes were
recorded.

## Page signal

- Calendar/list URL: `/dates_partys/` (default), with a long query string after
  a filter change (42 parameters).
- Sub-tabs (site vocabulary → path): Dates & Events `/dates_partys/` · Dates
  `/dates_partys/dates/` · Events `/dates_partys/events/` · Meine Events
  `/dates_partys/events/registrations/` · Wer ist wo?
  `/dates_partys/events/contacts/` · Clubs & Co. `/swingerclubs/`
- Event page URL: `/event/0000000.SLUG.html` (7 digits, slug from the title).
- Event page signal: `body.body_profile.body_profile_event`; `h1.event_name`.

## Identity

- Event ID on a list item: `div.card-list-ui-list-item[data-element-id]` (7
  digits). Verified equal to the number in the item's `/event/` link for all 7
  event cards.
- Card UUID: `div.card-list-ui-list-item[data-card-id]` (UUID). Inference: a
  card instance ID, not the event ID.
- Event ID on the event page: URL only; also as the `value` of hidden form
  inputs and in `ul.date_list[data-params]`. No `data-event-id` attribute found.
- Organizer / venue ID: in `/club/000.SLUG.html` links (digit count varies). See
  `15-venues.md`.

## List filter parameters (after "Samstag")

Full page load. The query holds the whole filter form. Names (prefix
`datespartys_` shortened to `dp.`):

| Parameter                                                                                                                                                           | Value shape                               |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------- |
| `dp.geo_option_id`                                                                                                                                                  | mixed                                     |
| `dp.lat`, `dp.lon`                                                                                                                                                  | coordinates                               |
| `dp.country`, `dp.province`, `dp.area`                                                                                                                              | word                                      |
| `dp.city`, `dp.zip`                                                                                                                                                 | empty                                     |
| `dp.value`, `dp.label`, `dp.param`                                                                                                                                  | word                                      |
| `dp.distance`                                                                                                                                                       | integer, 2 digits (km)                    |
| `dp.date_selection`                                                                                                                                                 | word                                      |
| `dp.defined_date`                                                                                                                                                   | integer, 8 digits (inference: `YYYYMMDD`) |
| `event_text_searchfield`                                                                                                                                            | empty (free text search)                  |
| `dp.event_category`, `dp.event_online_status`                                                                                                                       | empty                                     |
| `dp.event_rating`                                                                                                                                                   | integer, 1 digit                          |
| `dp.gender_<code>` (one parameter per gender; which ones appear follows the owner's filter and is not recorded)                                                     | word                                      |
| `dp.age`, `dp.size`                                                                                                                                                 | mixed (range)                             |
| `dp.match_opposite_search_criteria`, `dp.dating_with_normal`, `dp.dating_with_event`                                                                                | `0`/`1`                                   |
| `dp.bmi`, `dp.special_subtype`, `dp.single`, `dp.erotic_prefs`, `dp.bi`, `dp.swinger`, `dp.pt`, `dp.bdsm`, `dp.domdev`, `dp.sado_maso`, `dp.shootings`, `dp.smoker` | empty                                     |
| `hidden_dp.single`, `hidden_dp.bi`, `hidden_dp.bdsm`, `hidden_dp.domdev`, `hidden_dp.sado_maso`                                                                     | empty                                     |

Visible filter controls (site vocabulary): location field + radius ("bis 50
km"), quick date buttons "Heute", "Freitag", "Samstag", a date picker,
"Detailsuche".

## Fields: list

| Field            | Present? | Selector                                                                      | Matches         | Value shape                                                                   |
| ---------------- | -------- | ----------------------------------------------------------------------------- | --------------- | ----------------------------------------------------------------------------- |
| List root        | Yes      | `#cfull div.card-list-ui`                                                     | 1               | –                                                                             |
| Item root (all)  | Yes      | `div.card-list-ui-list-item`                                                  | 24 per batch    | –                                                                             |
| Event item       | Yes      | `div.card-list-ui-list-item.event-card-ui`                                    | 7 of 24         | modifiers: `premium`, `special_card_list_item`, `trusted_partner_detail_card` |
| Member date item | Yes      | `div.card-list-ui-list-item.date-card-ui`                                     | rest            | –                                                                             |
| Placeholder      | Yes      | `div.card-list-ui-list-item.empty_card`                                       | few             | no ID                                                                         |
| Title + link     | Yes      | `.card-ui-detail-right-headline a[href*="/event/"] > div.headline`            | 1 per event     | `TEXT`; link `target="_blank"`                                                |
| Date/time        | Yes      | `.card-ui-detail-right-time-range span.event-time` (+ `small.event_timezone`) | 1 per event     | "Wochentag, 00. Monat 0000 - ab 00:00 Ortszeit"                               |
| Type badge       | Yes      | `div.badge-ui.dates-partys-type`                                              | 1 per item      | e.g. "Event"                                                                  |
| Organizer link   | Yes      | `a.organizer_link`                                                            | 1 per event     | `/club/000.SLUG.html`                                                         |
| Place            | Yes      | `.card_ui_detail_location_details span.location`                              | 1               | `PLACE`                                                                       |
| Distance         | Yes      | `span.dates_partys_distance`                                                  | 1               | "00 km"                                                                       |
| Date count       | Yes      | `span.event_date_counter` (`.desktop_element` / `.mobile_element`)            | 2               | "00 Dates zum Event eingetragen."                                             |
| Attendee count   | Yes      | `span.mivi_attending_persons` (desktop/mobile)                                | 2               | "000 Personen angemeldet."                                                    |
| Guest avatars    | Yes      | `div.anmeldungen_guestlist div.guestlist_user`                                | 8 on first card | `IMG`                                                                         |
| Guest list link  | Yes      | `a.guest_list_link`                                                           | 1               | link to event guest list                                                      |
| Buttons          | Yes      | `j-button.desktop_element`                                                    | –               | "Anmelden", "Details ansehen" (mobile "Details")                              |
| Bookmark         | Yes      | `div.event_bookmark_btn.event_bookmark_button_ui`                             | 1               | "Event merken" / "Merken" (not clicked)                                       |

## Fields: event page

| Field            | Present? | Selector                                                                                     | Matches                     | Value shape                                                                                |
| ---------------- | -------- | -------------------------------------------------------------------------------------------- | --------------------------- | ------------------------------------------------------------------------------------------ |
| Title            | Yes      | `h1.event_name` (in `.event_name_and_type`)                                                  | 1                           | `TEXT`                                                                                     |
| Type badge       | Yes      | `.event_header_badge_container .event_type_badge`                                            | 1                           | e.g. "Swinger-Party"                                                                       |
| Info box         | Yes      | `.event_info_box`                                                                            | 1                           | –                                                                                          |
| Date/time        | Yes      | `.event_info_box .event-time`                                                                | 1                           | "Wochentag, 00. Monat 0000 - ab 00:00" + "Ortszeit"                                        |
| Organizer        | Yes      | `.event_info_detail a[href*="/club/"]`                                                       | 1                           | "Veranstalter: NAME" → `/club/000.SLUG.html`                                               |
| Venue link       | Yes      | `.event_location_detail a.event_club`                                                        | 1 (2 `.event_club` in page) | `PLACE` → `/club/000.SLUG.html`                                                            |
| Address          | Yes      | `.event_address`, `.event_city`                                                              | 1                           | `PLACE`                                                                                    |
| Distance / map   | Yes      | `.event_distance`, `.event_map_link`                                                         | 1                           | "00 km"                                                                                    |
| Registration box | Yes      | `.event_registration_box`                                                                    | 1                           | –                                                                                          |
| Counts           | Yes      | `.event_num_registered`, `.event_num_waitlist`, `.event_num_bookmarked`, `.event_num_visits` | 1 each (registered 2)       | "000 Personen angemeldet", "00 noch nicht bestätigt", "000 mal vorgemerkt", "0000 Aufrufe" |
| Tab bar          | Yes      | `a.link_to_tab` and `a[href^="#"]`                                                           | –                           | tabs below                                                                                 |
| Description      | Yes      | `.event_description` in `#information`                                                       | 1                           | `TEXT`                                                                                     |

Tab panes (`.tab-pane` ids): `information`, `guest_list`, `guest_alle`,
`guest_m`, `guest_w`, `guest_p`, `date_pane`, `comments`. Tab labels: "Anmeldung
& Information", "Gäste (000)", "Dates (00)", "Kommentare (00)"; guest sub-tabs
"Alle Gäste", "Männer", "Frauen", "Paare".

## Attendance controls (not clicked)

| Label        | Selector                                                       | Notes                                                                             |
| ------------ | -------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| Anmelden     | `.event_registration_buttons j-button.link_to_tab`             | has `href`; class suggests it switches to a tab (inference: the registration tab) |
| Event merken | `.event_registration_buttons j-button.js_submit_bookmark_form` | submits a bookmark form                                                           |
| ClubMail     | header `j-button` / `a` with text "ClubMail"                   | has `href` (to the organizer's ClubMail); not opened                              |

- Registration form: `.event_registration_form`. The page contains
  `j-form-radiogroup`, `j-form-radio`, `j-form-select` and `j-form-text-area`
  (inference: form fields; not mapped to a form). Not typed into.
- Text inputs: `j-form-text-area` and `textarea.bbox`, not inside a matched
  `form` class. Purpose Unclear (inference: comments). Not typed into.
- Own ClubMail form on the event page: Absent as an inline form. The "ClubMail"
  control is a link.

## Attendee list

- Shown to the owner: **Yes.**
- Root: `#guest_list` (overview) and sub-panes `#guest_alle`, `#guest_m`,
  `#guest_w`, `#guest_p`.
- Entry container: `div.ha_2`. Entry root: `a.card.normal` (the whole card is
  the profile link). Count in `#guest_alle` on load: 37 (the event reports a
  registered count in the hundreds).
- Entry `href` pattern: `/profile/0000000.NAME.html`.
- Entry structure: `div.date_avatar.rel` (image, `data-img_id`) →
  `div.date_info` → `div.date_moreinfo strong` (`NAME`) →
  `div.user_card_footer_line_one` (`j-gender-icon` +
  `span.verified.crowd_checked` check icon) → `div.more_info_city` (`PLACE`).
- More entries: `button.jc-infinite-scroll-more` "Mehr Ergebnisse".
- Badge position: `div.date_moreinfo` (name row) or `div.date_avatar.rel`
  (positioned, suits an overlay badge).

## Loading and navigation

- List: 24 items per batch; one scroll to the bottom loaded 24 more (48). URL
  unchanged. No pager.
- Inbox → events (nav): full page load.
- Quick filter "Samstag": full page load with query string.
- Events → one event: full page load. Note the title link has `target="_blank"`
  (new tab by default).
- Browser Back from the event to the list: restored from the back-forward cache
  (`window.__jf` still `1`, scroll state kept with 48 items).

## Skipped or unclear

- Exact value shapes for `dp.geo_option_id`, `dp.age`, `dp.size`,
  `dp.date_selection`: the capture tool blocked output of these values; recorded
  as "mixed" or "word".
- Whether the attendee list is visible to all members or only to certain account
  types: Unclear.
- "Wer ist wo?" and "Meine Events" pages: not opened.
