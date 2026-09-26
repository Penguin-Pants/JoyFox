# Prompt: capture evidence E1 to E4 with Claude in Chrome

Paste everything below the line into a fresh Claude in Chrome session, with
JoyClub open and logged in.

---

You are helping build JoyFox, a local-first Firefox extension for JoyClub
(www.joyclub.de). JoyFox reads pages the user already sees and adds features on
top. Before JoyFox can support a page, we need **sanitized structural evidence**
of that page: which elements hold which information, which CSS selectors find
them and what shape their values have. You will collect four evidence sets (E1
to E4) from the logged-in owner's own browser and write them up as Markdown
files. The owner then copies your files into the repository.

## Hard rules (read first)

1. **Read only.** Never send a message, like, compliment, friend request, event
   sign-up or "interested" click. Never save a form, change a setting, delete,
   ignore or block anything. Do not click any control whose effect you are not
   sure of. Opening pages, scrolling and reading the page are allowed.
2. **No hidden requests.** Inspect only the DOM of pages that are open. You may
   run read-only JavaScript in the page (`document.querySelector`,
   `querySelectorAll`, reading attributes and class names). Never call `fetch`,
   `XMLHttpRequest` or any JoyClub API from JavaScript.
3. **Human pace.** Wait a few seconds between page loads. Open at most about 20
   pages in total. Scroll a list at most twice. JoyClub runs anti-scraping and
   anti-fake checks. Behave like a person browsing normally.
4. **Ask before anything another member could notice.** Opening another member's
   profile can show the owner as a visitor. Before you open any other member's
   profile, ask the owner which profile to use, or use one the owner names.
   Prefer a profile the owner has already visited.
5. **Stop and report** if you see a CAPTCHA, a warning, a login prompt, a
   rate-limit message, an error page or anything unexpected. Do not try to work
   around it.
6. **Sanitize everything you write down:**
   - Replace every person's name or nickname with `NAME`, free text (profile
     text, messages, event descriptions) with `TEXT`, images with `IMG`, and
     place names and venue names with `PLACE`.
   - In identifiers and URLs, replace every digit with `0` (for example
     `/profile/0000000.NAME.html`).
   - Record the **shape** of a value, not the value: for example "integer + the
     word Fotos", "date like 00.00.0000", "two digit groups and a word".
   - Site vocabulary is not personal data and may be copied as is: button
     labels, headings, section names, filter names, CSS classes, `data-e2e`
     hooks and attribute names.
   - Never record which preferences anyone selected (the owner included), who
     attends an event, or the content of any message.
7. **Report absence as a result.** If a field does not exist, write "Absent" and
   say what you searched for. If you cannot tell, write "Unclear" and why. Do
   not guess. Mark every inference as an inference.

## Method

For each page:

1. Record the URL pattern (sanitized) and a unique page signal: a path pattern
   and, if present, a stable root element or `data-e2e` hook.
2. Find the stable identifiers (member ID, conversation ID, event ID, venue ID,
   message ID). Check the URL, `href` values, `id` attributes and every `data-*`
   attribute. Say where each one is, or that it is absent. If a URL holds more
   than one number, say which number is which and how you know (for example, it
   matches the member ID in a profile link). If you cannot tell, write
   "Unresolved" for that segment.
3. For each field listed below, record (the project's evidence contract,
   `docs/Engineering-Build-Plan.md`, F1):
   - **Primary selector:** prefer `data-e2e` hooks and custom elements (`j-...`)
     over layout classes.
   - **Fallback selector:** a second selector that does not depend on the
     primary one (another hook, attribute or structure). Write "None found" if
     there is none.
   - **Expected cardinality:** how many matches are normal, for example "exactly
     1 per page", "0 or 1", "1 per result card".
   - **Matches:** test both selectors with `querySelectorAll` and give the
     counts you saw.
   - **Validation rule:** how code can check that a match is the right thing,
     for example "`href` matches `/profile/<digits>.`" or "text matches
     `<digits> Fotos`".
   - **Missing state:** what the page shows when the field has no value or the
     member hides it (element absent, empty, a placeholder text, a different
     class). Write "Not observed" if you did not see it.
   - **Notes:** anything else, for example a value that only appears after
     scrolling.
4. Record how the page loads more content: scroll once or twice and note whether
   new items appear, whether the URL changes and whether a "more" button exists.
5. Record navigation type for each move between pages.
   - **On every page, as soon as it opens,** run once:
     `addEventListener("pageshow", (e) => { if (e.persisted) window.__jfRestored = (window.__jfRestored || 0) + 1; });`
   - **Before each move,** set a new value that no earlier move used, for
     example `window.__jf = "move-3"`.
   - **After the move,** read `window.__jf` and `window.__jfRestored`:
     - `window.__jf` equals the new value: client-side (the same document
       stayed; no page load).
     - `window.__jf` is `undefined`: full page load.
     - `window.__jf` holds an older value, or `window.__jfRestored` went up: the
       browser restored an earlier page from its back-forward cache (common
       after Back). Record this as "restored from cache", not as client-side.
   - If you are not sure, also record
     `performance.getEntriesByType("navigation")[0].type`.

## E1: search (for saved searches, badges on result cards and sorting)

Open JoyClub's member search. Set one or two ordinary filters (for example an
age range), run the search, and inspect the page and **one** result card.

Capture:

- URL pattern of the search page and of a results page. **Key question:** does
  the URL change when you change a filter? List the query parameter names and
  the shape of each value. Then copy the results URL, open it in a new tab and
  report whether the same filters and results come back. (JoyFox's saved
  searches will replay this URL.)
- Result list root and the repeated result card root, with match counts.
- On one card: the member ID (link `href` pattern or attribute), name element,
  verification icon (`j-veri-icon` and its `verification-status` attribute, if
  present), gender icon (`j-gender-icon` / `universal-gender`, if present),
  photo count if shown, age and place line (shape only), online status and any
  other badge.
- **Profile text on a card:** does a card show any profile text (a teaser or
  motto) or a word count? Write "Present" (selector, whether the text is cut,
  and its shape as `TEXT`) or "Absent". JoyFox's incomplete-profile filter needs
  at least 50 words of profile text, so it must know whether a card can show
  this.
- Where on a card a small badge could go (the card's header or name row
  element).
- The filter panel root, the "search" button and any sort control, with their
  labels.
- **If the copied URL did not bring the same filters back,** capture every
  filter you set: its control (primary and fallback selector), the control type
  (select, checkbox, range slider, text field, custom element), how its current
  value is stored (the `value` property, an attribute, a class or a hidden
  input) with the value's shape, and which events the control listens to, if
  visible (for example an `onchange` attribute). Also record where the page
  keeps the filter state, if you can see it (the URL hash, a hidden form, local
  storage key names only). **Only read the state the filters already have.**
  Never set a value or dispatch an event from JavaScript: JoyClub may run a
  search or send a request at once.
- Pagination or infinite scroll: how more results load.
- Navigation type: inbox → search, and search → one result's profile (ask the
  owner first, see rule 4), then browser Back to the results.

## E2: messages in a conversation (for message search and message features)

Open one existing conversation the owner chooses. Do not read or copy any
message text.

Capture:

- **Conversation ID.** Earlier evidence found the URL
  `/clubmail/conversation/conversation-wrapper-personal-0000000-0000000/` with
  two numbers and did not say which is which. Compare each number with the
  owner's own member ID (from the link to the owner's own profile) and with the
  other member's ID (from the conversation header's profile link). Report which
  segment is the owner, which is the other member and whether either or neither
  is a separate conversation ID. Also check the page for any other conversation
  identifier (a `data-*` attribute or an `id`). If you cannot tell, write
  "Unresolved". Write every ID with its digits as `0`, and describe the result
  by position ("first segment matches the owner's member ID").

- Per-message root, and the element that holds a message's text (the text itself
  is `TEXT`). Earlier evidence found
  `li.cm-message-list-item.cm-message-list__item` and `div.cm-message-bubble`
  with `--left` and `--right` modifiers. Confirm these or correct them.
- **Key question:** which modifier marks the owner's own (sent) messages and
  which marks the other member's (received) messages? The side on screen is not
  proof. Look for structure that names the sender: an avatar or profile link
  inside or next to the bubble (compare its member ID with the owner's own
  profile link and the other member's), an `aria-label`, a `data-*` attribute or
  a class. If the structure does not settle it, ask the owner to look at the
  screen and say which side shows the messages they wrote. Record the answer and
  how it was found. Record no message content. If neither works, write
  "Unresolved".
- **Key question:** does each message have a stable identifier? Check the `id`
  attribute and every `data-*` attribute on the message root and its children.
  Report present (where, and its shape) or absent.
- **If an identifier is present, test that it is stable.** Note the identifier
  of the newest message in the conversation (keep the real value only in your
  working memory; write it with digits as `0`). Then:
  1. Scroll up once to load older messages, and check that the newest message
     still has the same identifier.
  2. Reload the conversation page, and check the newest message again. Report
     "stable" if both checks match, "changes" (and after which step) if not, or
     "present, stability not verified" if you could not run the checks.
- Timestamp per message or per group: element and shape.
- Date separators, if any.
- How emoji, links and line breaks appear inside the text element (for example
  `img` with an `alt`, or plain characters).
- Older messages: scroll up once. Do more messages load? Is there a "load older"
  control? Can the conversation's first message be reached?
- System messages (for example "conversation started"), if any: their root and
  how they differ from normal messages.

## E3: preference checklist (for the compatibility overlay)

Inspect the preference section ("Vorlieben" or similar) in two places: the
owner's **own** profile, and **one other member's** profile that the owner names
(rule 4).

Capture:

- The section's root element on each page, and whether both pages use the same
  structure.
- The section heading element. On a profile page, write each heading as
  `SECTION` and give only the number of sections: a profile may show only the
  sections its owner filled in, so the headings alone can reveal preferences.
  Copy the real headings only from a full list (see "Tag vocabulary" below).
- The element for one preference entry (tag). Write its label as `TAG`.
- **Never record which tags anyone selected, the owner included.** Preferences
  are sensitive data, and the repository must never hold real preference data
  (`codex.md`, "Never commit"). A profile that shows only selected tags reveals
  its owner's preferences through the labels alone, so from a profile page
  record only the structure, the number of entries per section and `TAG` in
  place of each label.
- How an entry shows its state. Are only selected tags shown, or all tags with a
  state? Are there levels (for example "like", "maybe", "no"), and how is each
  level marked (class, icon, attribute)? Give the shapes only, never which tag
  has which state.
- Whether each tag has a stable key (attribute or class) or only its visible
  German label. From a profile page, give the key's name and shape only (for
  example `data-id`, digits), never its value, since a value can name the tag.
- Whether any section is hidden or collapsed, and what reveals it.
- **Tag vocabulary, only from a full list.** If a page lists **every** available
  tag (for example the owner's profile edit page), you may copy the section
  names and all tag labels from it, in page order, because that list is the
  site's vocabulary and says nothing about anyone. Copy the labels only, never
  which are ticked or at which level. Do not tick, untick or save anything. If
  no page lists every tag, write "Vocabulary not captured" and do not copy
  labels from any profile.
- On both profiles, record **structure only**.

## E4: events, calendar and venues (for the personal event tracker)

Open the event calendar or event list, then one event page, then that event's
venue or location page if it links to one.

Capture:

- **Calendar or list:** URL pattern and filter parameters (names and value
  shapes); list root; repeated event item root; the event ID on an item; date
  and title elements (shapes); how more events load.
- **Event page:** URL pattern and page signal; the event ID and where it sits;
  title, date and time, location or venue link, organizer link (shapes).
- JoyClub's own attendance controls (for example "Teilnehmen" or "Interesse"):
  their labels and selectors. **Do not click them.**
- Attendee list: is one shown to the owner? Its root, the repeated entry root,
  and whether each entry links to a member profile (the `href` pattern only).
  Give the entry count only. Record no attendee names or IDs.
- Where on an attendee entry a small badge could go.
- **Venue page:** URL pattern, venue ID, name element (`PLACE`), and whether it
  lists that venue's events.
- Optional: if the event page has its own message form ("ClubMail" to the
  organizer or attendees), record its editable control and send button
  selectors. Do not type anything.
- Navigation type: inbox → events, events → one event, event → venue, and
  browser Back from the event.

## Output

Write one Markdown file per area, each in its own fenced code block with the
file name as a heading, so the owner can copy them into `docs/live-evidence/`:

- `11-search.md` (E1)
- `12-messages.md` (E2)
- `13-preferences.md` (E3)
- `14-events.md` (E4: calendar, event page, attendees)
- `15-venues.md` (E4: venue page)
- `16-navigation.md` (every navigation move you tested, as a table: move, URL
  changed?, `window.__jf` and `window.__jfRestored` results, type: client-side,
  full page load or restored from cache)

Use this structure in each file (the same as the existing evidence files):

```markdown
# <Page name>

Method: <what you did, which checks you ran, and a statement that only structure
and value shapes were recorded>.

## Page signal

- URL pattern: `...`
- Unique root/signal: ...

## Identity

- <ID>: <where it is, its shape, or Absent and what was searched>

## Fields

| Field | Present? | Primary selector | Fallback selector | Expected cardinality | Matches | Validation rule | Missing state | Value shape | Notes |
| ----- | -------- | ---------------- | ----------------- | -------------------- | ------- | --------------- | ------------- | ----------- | ----- |

## Loading and navigation

- ...

## Skipped or unclear

- ...
```

End your reply with a short summary table:

| Evidence | Status (Complete, Partial or Not captured) | Open questions |
| -------- | ------------------------------------------ | -------------- |

Before you finish, check every file once more for names, free text, places and
digits that sanitizing missed.
