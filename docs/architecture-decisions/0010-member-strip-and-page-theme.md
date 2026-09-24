# 0010: Member strip and colors from the page

## Status

Accepted (project owner, 2026-09-24: "Option A", on the conversation page, the
profile page and the inbox triage bar, colors following the page).

## Context

On a live ClubMail conversation, the JoyFox panel and the note editor appeared
as two narrow white columns inside JoyClub's header row. Each line wrapped, the
header grew tall, the space to the right stayed empty, and the white boxes
ignored JoyClub's dark theme. Both were inserted directly after JoyClub's header
element, which is an item of a horizontal flex row. The owner compared three
mockups: one slim bar, two wide cards, and a chip with a pop-over.

## Decision

1. **One member strip.** The member panel, the note editor and the Ignore and
   Delete panel share one full-width strip (`src/content/member-strip.ts`), in
   that order, whatever order they mount in.
2. **After the header row, found by layout.** When the header element's parent
   is a horizontal flex container, the strip goes after that parent. Otherwise
   it goes after the header itself. No JoyClub class name is used for the row,
   because none is verified (`docs/selector-map.md`).
3. **Details on demand.**
   - The member panel is one bar: the placement as a pill, with the word always
     written; the local trust score; the outcome buttons ("Log: Positive,
     Neutral, Negative, Undo", each with its full accessible name); and "Why and
     move".
   - "Why and move" opens a drawer with the reasons, the conditions, the move
     controls and the score breakdown. The drawer's open state survives redraws.
   - The note editor is closed by default. Its summary says whether a note or
     tags exist.
4. **Colors from the page.** Text, lines and surfaces are mixed from the page's
   own text color (`currentColor` with `color-mix`, available from Firefox 113;
   the floor is 121). So JoyFox follows JoyClub's dark theme, and would follow a
   light one. Only the placement colors are fixed, as mid-tones that read on
   both.
5. **Inbox bar.** The same tokens apply. The explanation of the views moved
   behind a "?" toggle, so the bar is one row.
6. **Inbox teardown removes only inbox UI** (`triage-bar`, `badge`). Before, it
   removed every JoyFox element except two, including the note editor, which
   then mounted again in a loop.

## Consequences

- The strip's position depends on JoyClub's layout, not on a class. If JoyClub's
  header parent stops being a horizontal flex row, the strip falls back to
  following the header, as before this change. If the row's own parent is also a
  horizontal row, the strip becomes an item of that row; it has
  `flex-basis: 100%` to take a full line where that row wraps.
  `manual-acceptance.md` items 63 to 67 check this live.
- At narrow widths the bar wraps onto a second line rather than into a column.
- The inbox "Why" panel keeps the full explanation, with the long outcome
  labels.
