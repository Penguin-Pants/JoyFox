# Navigation behavior

Method: before each move, `window.__jf = 1` was set via read-only JS. After the
move, `window.__jf` was checked again — if it still exists, the page did NOT
fully reload (in-page/client-side transition); if it's `undefined`, a full page
load occurred and reset the JS environment.

Only the moves actually made this session were tested. Sanitized URLs use `0`
for digits and `NAME` for the word following a number, per the file 01
convention.

| Move                                                                                                                                           | URL changed? | Result                        | Type                  |
| ---------------------------------------------------------------------------------------------------------------------------------------------- | ------------ | ----------------------------- | --------------------- |
| Inbox (`/clubmail/`) → open conversation (`/clubmail/conversation/conversation-wrapper-personal-0000000-0000000/`)                             | Yes          | `window.__jf` survived (`1`)  | In-page (client-side) |
| Open conversation → a different open conversation (`/clubmail/conversation/conversation-wrapper-personal-0000000-0000000/`, different ID pair) | Yes          | `window.__jf` survived (`1`)  | In-page (client-side) |
| Open conversation → sender profile (`/profile/0000000.NAME.html`)                                                                              | Yes          | `window.__jf` was `undefined` | Full page load        |

## Observation

Tab title and URL didn't always update in the same snapshot — one intermediate
state showed a profile-style title ("Name ♥ Gender - City") while the URL still
pointed at a `/clubmail/conversation/...` path, and the next state showed a
conversation-style title ("Unterhaltung mit Name") while the URL had already
moved to `/profile/...`. This is consistent with title and URL updating via
separate client-side calls that aren't perfectly synchronized, rather than a
report of two more manual navigations occurring in between.

## Confirmation (2026-09-23)

The project owner observed during the Milestone C live check that the
conversation list stays on screen beside an open conversation: opening a
conversation from the inbox is a split view, not a separate page.

## Skipped or unclear

- Profile → back (browser Back button): not exercised this session.
- Inbox → search: not exercised this session.
- Inbox → events, events → one event: not exercised this session.
- These can be tested the same way (`window.__jf = 1`, navigate, re-check)
  whenever those pages are opened.
