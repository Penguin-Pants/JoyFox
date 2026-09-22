# Inbox (conversation list)

## Page signal

- URL pattern: `https://www.joyclub.de/clubmail/`
- Unique root element or class: `div.cm-conversation-list` (list container; also
  carries `aria-label`, `aria-live`, `aria-relevant` — values not captured, only
  attribute names)

## Fields

| Field                           | Selector                                                        | Sanitized example                                                                                 | Present? | Notes                                                                                                                                                                                             |
| ------------------------------- | --------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Row container                   | `.cm-conversation-list-item` (custom element `<j-list-item>`)   | n/a (structural)                                                                                  | Present  | 25 instances on page; also carries base class `cm-conversation-list`                                                                                                                              |
| Sender name                     | `.cm-conversation-list-item__name`                              | `TEXT`                                                                                            | Present  | `data-e2e="conversation-list-item-name"`                                                                                                                                                          |
| Message preview                 | `.cm-conversation-list-item__text`                              | `TEXT`                                                                                            | Present  | inside the `__line--description` row                                                                                                                                                              |
| Sender profile link / member ID | `.cm-conversation-list-item__avatar[href]` (`<j-avatar-image>`) | `https://www.joyclub.de/profile/0000000.NAME.html`                                                | Present  | digits and username both replaced                                                                                                                                                                 |
| Avatar image ID                 | `[data-img_id]`                                                 | `data-img_id="00000000"`                                                                          | Present  | numeric, on an inner `div.image-ui`                                                                                                                                                               |
| Gender / profile type           | `j-gender-icon[universal-gender]`                               | `universal-gender="0"`                                                                            | Present  | numeric-coded value, no free text                                                                                                                                                                 |
| Verification badge              | `j-veri-icon[verification-status]`                              | `verification-status="0"`                                                                         | Present  | numeric-coded value                                                                                                                                                                               |
| Read/unread marker              | `.cm-conversation-list-item__read-status`                       | `class="cm-conversation-list-item__read-status cm-conversation-list-item__read-status--received"` | Present  | icon element; state carried in BEM modifier class (`--received`, `--read` seen elsewhere on the page)                                                                                             |
| Row-level delete control        | `j-control-button[data-e2e="button-delete-conversation"]`       | n/a                                                                                               | Present  | icon-only button inside `__meta`; **not clicked**                                                                                                                                                 |
| Conversation ID                 | —                                                               | —                                                                                                 | Unclear  | No `id`/`data-*` attribute containing a conversation identifier was found anywhere inside the row. Likely held only in the frontend framework's internal component state, not exposed in the DOM. |

## Dynamic behavior

- No pagination links, "load more" button, or infinite-scroll sentinel element
  was found among the 25 currently-rendered rows (searched by class name for
  `pagin`, `load-more`, `infinite`, `next-page`, `scroll-sentinel` patterns — no
  matches).
- The list container has `aria-live` and `aria-relevant` attributes, which
  suggests it's designed to update in place (framework-driven) rather than
  always requiring a full page reload, but this was not exercised (no
  scrolling/loading was triggered, per instructions).

## Sanitized HTML fragment

```html
<j-list-item data-v-174d86ec="" class="cm-conversation-list cm-conversation-list-item">
<j-avatar-image data-v-174d86ec="" slot="image" title="X" class="cm-conversation-list-item__avatar" href-target="_blank" href="X">
<div data-v-adbcfeb2="" data-v-174d86ec="" data-aspect-ratio="0" data-img_id="00000000" data-img_module="gallery" class="image-ui vue-variant small adaptive">
<div data-v-438742dc="" data-v-2b64a226="" data-v-adbcfeb2="" class="protected picture-ui">
<div data-v-3ffedcf6="" data-v-2b64a226="" class="simple-picture">
<picture data-v-3ffedcf6="">
<source data-v-3ffedcf6="" srcset="X" type="image/webp" sizes="000px">
<source data-v-3ffedcf6="" srcset="X" type="image/jpeg" sizes="000px">
<img data-v-3ffedcf6="" class="core-img cover" src="X" alt="X" loading="lazy">
</picture>
</div>
<!----> <!----> <!----> <!---->
<img data-v-438742dc="" class="img-pane" src="X" alt="X">
</div>
</div>
</j-avatar-image>
<div data-v-174d86ec="" class="cm-conversation-list-item__line">
<div data-v-174d86ec="" data-e2e="conversation-list-item-name" class="cm-conversation-list-item__name">TEXT</div>
<j-gender-icon data-v-174d86ec="" universal-gender="0" highlighted-gender="[]" a11y-label="" a11y-title="">
</j-gender-icon>
<!---->
<j-veri-icon data-v-174d86ec="" verification-status="0" a11y-label="" a11y-title="" style="X">
</j-veri-icon>
<div data-v-174d86ec="" class="cm-conversation-list-item__meta">TEXT
<j-control-button data-v-174d86ec="" data-e2e="button-delete-conversation" icon-only="true" aria-label="X" title="X" role="" a11y-label="" small="true" variant="transparent" href="X" target="">
<j-icon data-v-174d86ec="" type="j-ico-xmark" size="00" style="X">
</j-icon>
</j-control-button>
</div>
</div>
<div data-v-174d86ec="" slot="description" class="cm-conversation-list-item__line cm-conversation-list-item__line--description">
<div data-v-174d86ec="" class="cm-conversation-list-item__text">
<!----> <!----> <!---->TEXT</div>
<div data-v-174d86ec="" class="cm-conversation-list-item__meta">
<!----> <j-icon data-v-174d86ec="" class="cm-conversation-list-item__read-status cm-conversation-list-item__read-status--received" ...>
</div>
</div>
</j-list-item>
```

## Code values

Derived from the 25 rows currently rendered on this page
(`.cm-conversation-list-item`). No names, message text, or photos were read to
produce this section; icon meanings were confirmed only via tight pixel-region
zooms of the icon itself (a few px around the icon's own bounding box), never a
full-row or full-page capture.

**`verification-status` (on `j-veri-icon`)**

| Value | Rows | Visible badge? | Icon appearance             |
| ----- | ---- | -------------- | --------------------------- |
| `1`   | 6    | Yes            | Gray/dark shield-check icon |
| `3`   | 18   | Yes            | Green shield-check icon     |

One row (25 total, 24 accounted for) had no `j-veri-icon` match — Unclear, not
investigated further.

Both values render an icon (neither is "hidden"); the state is carried by icon
color/fill (green vs. gray), not presence/absence. Based on color convention `3`
= verified, `1` = unverified/pending, but this mapping is an inference from
appearance, not from any label text (none was read).

**`universal-gender` (on `j-gender-icon`)**

| Value | Rows | Icon meaning                                                                                                                                                                    |
| ----- | ---- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `1`   | 11   | Confirmed: man symbol (♂)                                                                                                                                                      |
| `2`   | 1    | Unclear — could not get a stable pixel-region capture (page layout shifted between locating coordinates and zooming; stopped rather than risk repeated wide-region screenshots) |
| `3`   | 13   | Unclear — same reason as above                                                                                                                                                  |

**Profile link ID length**

Digit counts observed in the numeric segment of
`.cm-conversation-list-item__avatar[href]` across rows: 6, 7, and 8 digits (not
uniform — different rows use different lengths). Actual digit values not
recorded, per instruction.

## Skipped or unclear

- Did not click the row-level delete control (`button-delete-conversation`) —
  forbidden action.
- Conversation ID not located as a DOM attribute; source unclear (likely
  internal framework state).
- Values of `aria-live` / `aria-relevant` on the list container were not read,
  only the attribute names — low relevance, skipped for scope.
- Did not scroll or otherwise trigger additional rows to load, so
  infinite-scroll behavior (if any) is unconfirmed beyond "no sentinel element
  present."
- `universal-gender` values `2` and `3` icon meanings not visually confirmed
  (see Code values above). One accidental full-viewport screenshot occurred
  while scrolling to locate a `2`-value row; it showed real usernames/message
  previews. That content was not read into or used for this file and was
  discarded — noted here for transparency only.
