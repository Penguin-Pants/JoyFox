# Navigation types

Captured 2026-09-26 with Claude in Chrome from the owner's account, using the
first version of `capture-prompt-e1-e4.md` (before its review fixes). Sanitized
again on review: nothing further needed.

Method: Before each move, ran `window.__jf = 1`; after the move, read
`window.__jf`. `1` = client-side (no full load); `undefined` = full page load.
For browser Back, `1` means the page was restored from the back-forward cache.
Links with `target="_blank"` had the attribute removed in the page before the
click so the move stayed in one tab.

| Move                                                             | URL changed?                           | `window.__jf` result         | Type                             |
| ---------------------------------------------------------------- | -------------------------------------- | ---------------------------- | -------------------------------- |
| Inbox `/clubmail/` → member search `/member/` (nav "Mitglieder") | Yes                                    | `undefined`                  | Full load                        |
| Search: apply filters ("Anwenden")                               | Yes (path + query + `#infiniteScroll`) | `1`                          | Client-side                      |
| Search results URL opened in new tab                             | –                                      | –                            | Full load; same results          |
| Search → result profile                                          | –                                      | Not tested                   | Not tested (rule 4)              |
| Profile → Back to results                                        | –                                      | Not tested                   | Not tested                       |
| Inbox → conversation (click entry)                               | Yes                                    | `1`                          | Client-side                      |
| Conversation → partner profile (header link)                     | Yes                                    | `undefined`                  | Full load                        |
| Other profile → own profile (header avatar)                      | Yes                                    | `undefined`                  | Full load                        |
| Inbox → events `/dates_partys/` (nav "Dates & Events")           | Yes                                    | `undefined`                  | Full load                        |
| Events: quick filter "Samstag"                                   | Yes (query)                            | `undefined`                  | Full load                        |
| Events list → one event (title link, `target` removed)           | Yes                                    | `undefined`                  | Full load (default is a new tab) |
| Event → venue (`a.event_club`)                                   | Yes                                    | `undefined`                  | Full load                        |
| Venue → Back to event                                            | Yes                                    | Unclear (marker overwritten) | Unclear                          |
| Event → Back to events list                                      | Yes                                    | `1` (48 items still loaded)  | Back-forward cache restore       |

## Notes for JoyFox

- Search and ClubMail are single-page apps: content scripts must watch URL
  changes (for example `popstate` plus a `MutationObserver`), not only page
  load.
- Profile, event and venue pages are server-rendered full loads.
- Back-forward cache restores need a `pageshow` handler (`event.persisted`).
