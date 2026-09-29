# Prompt: capture evidence E5 ("My JOY" lists) with Claude in Chrome

Paste everything below the line into a fresh Claude in Chrome session, with
JoyClub open and logged in to the owner's Premium account. The result is
`17-my-joy-lists.md`, the evidence for the profile type filter
(`docs/visitor-type-filter-spec.md`, FR-01).

---

You are helping build JoyFox, a local-first browser extension for JoyClub
(www.joyclub.de). JoyFox reads pages the user already sees and adds features on
top. Before JoyFox can support a page, we need **sanitized structural evidence**
of that page: which elements hold which information, which CSS selectors find
them and what shape their values have. You will collect one evidence set (E5)
from the logged-in owner's own browser and write it up as one Markdown file. The
owner then copies your file into the repository.

## Hard rules (read first)

1. **Read only.** Never like, vote, send a message, compliment, friend request,
   save, delete, ignore or block anything. Do not click any control whose effect
   you are not sure of. Opening the five pages below, clicking JoyClub's own
   tabs between them, scrolling and reading the page are allowed.
2. **No other member's profile.** Do not open any member's profile or click any
   card. Opening a profile shows the owner as a visitor.
3. **No hidden requests.** Inspect only the DOM of pages that are open. You may
   run read-only JavaScript in the page (`document.querySelector`,
   `querySelectorAll`, `getComputedStyle`, reading attributes, class names and
   open shadow roots). Never call `fetch`, `XMLHttpRequest` or any JoyClub API
   from JavaScript. Never set a value or dispatch an event.
4. **Human pace.** Wait a few seconds between page loads. Open at most about 15
   pages in total. Scroll each list at most twice.
5. **Stop and report** if you see a CAPTCHA, a warning, a login prompt, a
   rate-limit message, an error page or anything unexpected. Do not try to work
   around it.
6. **Sanitize everything you write down:**
   - Replace every nickname with `NAME`, free text with `TEXT`, images with
     `IMG` and place names with `PLACE`. Write an age as its shape (`00`).
   - In identifiers and URLs, replace every digit with `0`.
   - Site vocabulary is not personal data and may be copied as is: headings, tab
     labels, button labels, CSS classes, `data-e2e` hooks, custom element names
     and attribute names.
   - Profile type codes (`universal-gender` values such as `1`, `2`, `3`) are
     site enumeration codes and may be copied. Say which codes you saw, never
     which member has which code, and never how many members have each code.
7. **Report absence as a result.** If a field does not exist, write "Absent" and
   say what you searched for. If you cannot tell, write "Unclear" and why. Do
   not guess. Mark every inference as an inference.

## Pages

| Key      | URL                                           | Expected list        |
| -------- | --------------------------------------------- | -------------------- |
| visitors | `https://www.joyclub.de/my_joy/visitors/`     | Who visited you      |
| match    | `https://www.joyclub.de/my_joy/voting/match/` | Mutual matches       |
| top      | `https://www.joyclub.de/my_joy/voting/top/`   | Who liked you        |
| fav      | `https://www.joyclub.de/my_joy/voting/fav/`   | Profiles you like    |
| visits   | `https://www.joyclub.de/my_joy/visits/`       | Profiles you visited |

Open `visitors` first by its URL. Reach the other four with JoyClub's own tabs
or filter controls if the page has them, so the navigation type can be recorded.
If a page has no tab to it, open it by URL.

## Method

For **each** of the five pages, record:

1. **Page signal.** The final URL path after any redirect (sanitized), the page
   heading text, and a unique page root: a stable element or `data-e2e` hook
   that exists once the list area has rendered, **whether the list has cards or
   not** (check on an empty list if one of the five pages is empty). Give its
   `querySelectorAll` count.
2. **Grid.** The lowest element that holds every card. Its selector, its
   `getComputedStyle(...).display` value (`grid`, `flex`, `block` or other) and
   whether it is the same element type on all five pages.
3. **Card slot.** The direct child of the grid that holds exactly one card
   (JoyFox hides this slot so the grid keeps no gaps). Its selector, and whether
   it wraps anything besides the card.
4. **Card.** The repeated card element (for example a `j-member-card` custom
   element or an `a` link). Primary and fallback selector, cardinality (1 per
   slot) and the count you saw. Whether it has an open shadow root, and which
   attributes it carries (names and value shapes only, for example `user-name`:
   `NAME`, `verification-status`: digit).
5. **Profile type.** Where the man, woman or couple information is on a card:
   - Is there a `j-gender-icon` element? Inside the card's light DOM or inside
     its shadow root? Its attribute `universal-gender` and the set of codes seen
     on the page.
   - Is the type also, or only, a card attribute (for example a `gender` or
     `universal-gender` attribute on the card element)? This matters: JoyFox
     cannot watch changes inside a shadow root as easily as on the card itself.
   - **Key question: how is a couple drawn?** One icon with one code (which
     code), or two icons? Report one couple card's structure, sanitized.
   - Is the type also shown as text (for example "Paar", "Mann", "Frau")? Where?
   - Any card that shows no type (for example a locked, blurred, deleted or
     anonymous member): its structure and its missing state.
   - Primary and fallback selector, cardinality (exactly 1 per card?), the count
     you saw and a validation rule (for example "integer attribute").
6. **Member link.** Whether the card links to a profile (`href` pattern,
   sanitized). JoyFox does not need it for this feature; record it for later.
7. **Mark place.** An element on the card where a short JoyFox text label could
   go (for example the name row or a slot like `badge-top-right`), or "None
   found" if the card is fully in a closed shadow root.
8. **Bar place.** The element directly before the grid, and whether JoyClub's
   own tabs or filter controls sit there. Their labels and selectors. **Do not
   click anything except the tabs to the other four pages.**
9. **Loading.** Scroll down once or twice. Do more cards appear in the same
   grid? Does the URL change? Is there a "more" button or page numbers? Do
   placeholder or skeleton cards appear first? If so, their selector, and
   whether they sit in the same kind of slot as a card. Does the grid root stay
   the same element or get replaced?
10. **Empty list.** If a page has no cards, what it shows instead (selector and
    label text), and whether the grid element is still in the page.

**Navigation type** for each move between the five pages. On every page, as soon
as it opens, run once:
`addEventListener("pageshow", (e) => { if (e.persisted) window.__jfRestored = (window.__jfRestored || 0) + 1; });`
Before each move set a new value, for example `window.__jf = "move-3"`. After
the move, read `window.__jf` and `window.__jfRestored`:

- `window.__jf` equals the new value: client-side (same document).
- `window.__jf` is `undefined`: full page load.
- an older value, or `window.__jfRestored` went up: restored from cache.

Also record `performance.getEntriesByType("navigation")[0].type`.

## Output

Write one file, `17-my-joy-lists.md`, in a fenced code block with the file name
as a heading. Use this structure:

```markdown
# "My JOY" lists (E5)

Method: <what you did, which checks you ran, and a statement that only structure
and value shapes were recorded>.

## Page signals

| Key | Final path | Heading | Root selector | Root count |
| --- | ---------- | ------- | ------------- | ---------- |

## Shared structure

<What is the same on all five pages. Name any page that differs and how.>

## Fields

| Page | Field | Present? | Primary selector | Fallback selector | Expected cardinality | Matches | Validation rule | Missing state | Value shape | Notes |
| ---- | ----- | -------- | ---------------- | ----------------- | -------------------- | ------- | --------------- | ------------- | ----------- | ----- |

Fields: grid, card slot, card, profile type, member link, mark place, bar place.

## Profile type codes

- Codes seen: ...
- Couple drawn as: ...
- Cards without a type: ...

## Loading

- ...

## Navigation

| Move | URL changed? | `__jf` | `__jfRestored` | Navigation entry type | Result |
| ---- | ------------ | ------ | -------------- | --------------------- | ------ |

## Skipped or unclear

- ...
```

End your reply with a short summary table:

| Page | Status (Complete, Partial or Not captured) | Open questions |
| ---- | ------------------------------------------ | -------------- |

Before you finish, check the file once more for names, free text, places, ages
and digits that sanitizing missed.
