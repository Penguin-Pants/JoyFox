# Venue (club) page

Captured 2026-09-26 with Claude in Chrome from the owner's account, using the
first version of `capture-prompt-e1-e4.md` (before its review fixes). Sanitized
again on review: nothing further needed.

Method: From an event page, clicked the venue link
`.event_location_detail a.event_club` (same tab). Inspected the page with
read-only `querySelectorAll` and attribute reads. The club's separate events
page was not opened. Only structure and value shapes were recorded.

## Page signal

- URL pattern: `/club/000.SLUG.html` (digit count varies; 3 seen here;
  `000-000000` shapes also appear in `/club/homepage/` links).
- Unique root/signal: `body.body_profile.body_profile_main` and
  `h1.profile_name`. Inference: venues use the member profile template
  (`body_profile`).
- Sub-pages (site vocabulary → path): Profil `/club/0.SLUG.html` · Fotos
  `/club/fotos/0.SLUG.html` · Aktuelles `/club/aktuelles/0.SLUG.html` and
  `/club/fotoalbum/0.SLUG.html` · Events `/club/veranstaltungen/0.SLUG.html`

## Identity

- Venue ID: URL number. Also `body[data-my-user-id]` equals the venue ID on this
  page (verified; it does not equal the owner's ID).
  `li.navigation_link_item[data-user_id]`, `[data-fav-user-id]`,
  `[data-complain-target]` and
  `j-context-menu-item.profile_video_chat_invitation[data-user_id]` also hold
  it. Inference: a venue is a member account, and its ID is a member ID.

## Fields

| Field                       | Present? | Selector                                                                  | Matches | Value shape                         |
| --------------------------- | -------- | ------------------------------------------------------------------------- | ------- | ----------------------------------- |
| Name                        | Yes      | `h1.profile_name`                                                         | 1       | `PLACE`                             |
| Venue events (menu)         | Yes      | `.navbar_menu li.navigation_link_item.event_list_item a[href*="/event/"]` | 11      | `/event/0000000.SLUG.html`          |
| Venue events (main content) | Absent   | `a[href*="/event/"]` outside `.navbar_menu`                               | 0       | –                                   |
| Events page link            | Yes      | sub-nav "Events"                                                          | 1       | `/club/veranstaltungen/0.SLUG.html` |

## Loading and navigation

- Event → venue (link click): full page load (`window.__jf` became `undefined`).
- Back from venue to event: Unclear (the marker was overwritten before the
  read).

## Skipped or unclear

- The venue's events list page `/club/veranstaltungen/...`: not opened. The
  profile page lists the venue's events only in a nav submenu.
- Address, rating and opening-hours elements on the venue page: not captured
  (the event page has `.event_address`, `.club_rating`, `.club_opening_times`).
