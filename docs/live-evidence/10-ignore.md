# Ignore location (F7, partial)

Reported by the project owner on 2026-09-24 from their own logged-in account.
The first four reports are read-only: no control was clicked except to open the
menus, and nothing was ignored, blocked or deleted. From the fifth report on,
the owner deliberately confirmed Ignore on a profile and deleted a conversation
from the inbox, to record the results; each section says which report it comes
from.

## Conversation page

The conversation header's "Optionen" menu
(`j-control-button[data-e2e="button-conversation-kebap"]`, `02-conversation.md`)
does **not** contain Ignore. Ignore is therefore not available in-page from a
conversation.

## Profile page

The profile page has a three-dot menu. It contains the item "Profil ignorieren"
("Ignore profile"). Its markup, as reported (Lit comment markers kept):

```html
<button tabindex="-1" class=" j-context-menu-item " role="menuitem" id="">
  <!--?lit$193709999$-->
  <div class="j-context-menu-item__content">
    <slot name="icon" data-component-tag="j-context-menu-item">
      <!--?lit$193709999$-->
    </slot>
    <span class="j-context-menu-item__text">
      <!--?lit$193709999$-->Profil ignorieren
    </span>
    <slot
      class="icon-append"
      name="icon-append"
      data-component-tag="j-context-menu-item"
    ></slot>
  </div>
  <!--?lit$193709999$-->
</button>
```

Observations:

- The item has **no `data-e2e` hook and an empty `id`**. It is identified only
  by its role, its class and its visible German text.
- The `<slot>` elements show that this button is rendered inside the shadow root
  of a `j-context-menu-item` web component (Lit). Whether that shadow root is
  open, which a content script needs to reach the button, is not recorded.
- The number in `lit$…$` is a Lit render marker, not an identifier.

## Profile menu trigger and items (2026-09-24, second report)

The menu is a `j-context-menu` with a stable test hook. Its items are
`j-context-menu-item` elements in the light DOM, each named by a `title`
attribute; the `<button>` shown above is inside each item's shadow root, which
is **open**. Sanitized (layout-only inline styles and `data-v-*` build hashes
removed):

```html
<div class="profile-container__context-menu-desktop">
  <j-context-menu
    data-e2e="profile-context-menu"
    role="button"
    aria-haspopup="true"
    open="true"
  >
    <j-control-button
      slot="activator"
      aria-label="Profiloptionen"
      icon-only="true"
      a11y-expanded="true"
    >
      <j-icon type="glyphicons-option-vertical"></j-icon>
    </j-control-button>
    <j-context-menu-item title="Kontakt bearbeiten"></j-context-menu-item>
    <j-context-menu-item title="Fotos freigeben"></j-context-menu-item>
    <j-context-menu-item title="In Gruppe einladen"></j-context-menu-item>
    <j-context-menu-item title="Zu Event einladen"></j-context-menu-item>
    <j-context-menu-item
      title="Zum Video-Chat einladen"
      data-e2e="menu-video-chat-invite"
    ></j-context-menu-item>
    <j-spacer></j-spacer>
    <j-context-menu-item title="Beschwerde über Profil"></j-context-menu-item>
    <j-context-menu-item title="Profil ignorieren"></j-context-menu-item>
  </j-context-menu>
</div>
```

Candidate selectors (observed, not yet exercised by code):

| Element     | Selector                                                                                                        |
| ----------- | --------------------------------------------------------------------------------------------------------------- |
| Menu        | `j-context-menu[data-e2e="profile-context-menu"]`                                                               |
| Menu button | `j-context-menu[data-e2e="profile-context-menu"] > j-control-button[slot="activator"]` (label "Profiloptionen") |
| Ignore item | `j-context-menu[data-e2e="profile-context-menu"] j-context-menu-item[title="Profil ignorieren"]`                |

The Ignore item still has no `data-e2e` hook; it is found by the German `title`
inside a menu that has one. The menu's `open` attribute reflects whether it is
open.

## Ignore confirmation dialog

Choosing "Profil ignorieren" opens a confirmation dialog. Its body (member name
replaced with `NAME`):

```html
<div class="profile-ignore-modal__content">
  <p>NAME kann dann Folgendes nicht mehr:</p>
  <ul>
    <li>Kontakt per ClubMail mit dir aufnehmen</li>
    <li>dein Profil ansehen</li>
    <li>deine Pinnwandeinträge sehen</li>
    <li>deinen Livestreams beitreten</li>
  </ul>
  <p>
    Das Mitglied erfährt erst, dass du es ignoriert hast, wenn es aktiv auf dein
    Profil zugreifen möchte.
  </p>
  <j-a>Weitere Infos</j-a>
</div>
```

The dialog offers two buttons. The confirm button is a `j-button` whose open
shadow root holds the native `<button>`:

```html
<j-button aria-label="Ignorieren" type="button" full-size="true">
  #shadow-root (open)
  <button
    class="j-button primary full-size"
    type="button"
    aria-label="Ignorieren"
  >
    <slot class="j-button__content"></slot>
  </button>
  Ignorieren
</j-button>
```

The cancel button (reported 2026-09-24) is the same component with the tertiary
style:

```html
<j-button aria-label="Abbrechen" type="button" full-size="true">
  #shadow-root (open)
  <button
    class="j-button tertiary full-size"
    type="button"
    aria-label="Abbrechen"
  >
    <slot class="j-button__content"></slot>
  </button>
  Abbrechen
</j-button>
```

- Cancel: `j-button[aria-label="Abbrechen"]`. No `data-e2e` hook was reported.
- Confirm: `j-button[aria-label="Ignorieren"]`, near
  `.profile-ignore-modal__content`. No `data-e2e` hook was reported.
- The dialog names the member by display name only. It shows no member ID, so
  the identity check must rely on the profile URL, which stays the same while
  the dialog is open (to be confirmed).

## Dialog structure (2026-09-24, fourth report)

The dialog is JoyClub's `j-modal` web component. Its open shadow root holds a
native `<dialog class="j-modal" open>` with a header, a content area and a
footer. Everything JoyClub puts into it arrives through slots: the
`.profile-ignore-modal__content` block through the default slot, and a
`j-button-group` holding the two `j-button`s through the `actions` slot. The
`data-component-tag="j-modal"` on the slots names the host element. Sanitized
outline of the shadow tree (Lit markers, the SVG path and inline styles
removed):

```html
<dialog class="j-modal" aria-labelledby="titleElement" open>
  <div class="j-modal__wrapper">
    <div class="j-modal__header">
      <div class="j-modal__title">
        <slot id="titleElement" name="title"></slot>
      </div>
      <j-control-button
        class="j-modal__close"
        icon-only="true"
        a11y-label="Modal schließen"
      >
        #shadow-root (open)
        <button aria-label="Modal schließen">…</button>
      </j-control-button>
    </div>
    <div class="j-modal__content"><slot></slot></div>
    <div class="j-modal__footer has-actions">
      <div class="j-modal__meta-text"><slot name="meta-text"></slot></div>
      <div class="j-modal__actions"><slot name="actions"></slot></div>
    </div>
  </div>
</dialog>
```

Consequences for the driver:

- Slotted children stay in the light DOM of the `j-modal` host. So the dialog
  can be scoped from the Ignore content itself: `.profile-ignore-modal__content`
  → `closest("j-modal")` → the `j-button[aria-label="Ignorieren"]` or
  `[aria-label="Abbrechen"]` inside that host. No other dialog's buttons can be
  picked up, and no shadow root has to be entered to find them.
- Whether the dialog is open shows as the `open` attribute of the shadow
  `<dialog>`. The `j-modal` host's own attributes were not captured.
- The close button (`Modal schließen`) sits inside the shadow root. Cancel
  (`Abbrechen`) is the one to use.
- The report wrote class names with single underscores (`j-modal_header`); the
  outline above assumes the BEM double underscore used by every other JoyClub
  class seen so far. The driver does not depend on these classes.

## After confirming Ignore (2026-09-24, fifth report)

After "Ignorieren" is confirmed, a small notice appears at the bottom of the
screen for a few seconds and then disappears. Its text, as reported, reads "Du
ignorirst NAME" (member name replaced; probably "Du ignorierst NAME", "You are
ignoring NAME", with the spelling as typed in the report).

- This is a success signal, but a short-lived one: its element and selector were
  not captured, and a driver would have to catch it within seconds.
- Not yet reported: whether the profile menu item changes afterwards (for
  example to a "no longer ignore" entry), which would be a lasting signal, and
  whether the page address changes.

## Lasting result and undo (2026-09-24, sixth report)

- **The page address stays the same** after "Ignorieren" is confirmed.
- **Lasting signal:** afterwards the same profile menu shows
  `j-context-menu-item[title="Profil nicht mehr ignorieren"]` ("Stop ignoring
  profile") in place of "Profil ignorieren". Its open shadow root holds the same
  `button.j-context-menu-item[role="menuitem"]` with the text "Profil nicht mehr
  ignorieren". A driver can verify Ignore by reading this `title`, with no need
  to catch the short notice.
- **Undo:** the owner chooses "Profil nicht mehr ignorieren" in the same menu.
  The owner did not report whether that item opens a confirmation dialog.

## Delete from the inbox row (2026-09-24, sixth report)

The owner clicked the row control
`j-control-button[data-e2e="button-delete-conversation"]` in the inbox:

- **No confirmation dialog.** The conversation is moved at once.
- **The row disappears** from the list. The page address stays the same.
- A notice appears at the bottom of the page for about 5 seconds, with a green
  bar that runs down as time passes: "Unterhaltung mit NAME in den Papierkorb
  verschoben" ("Conversation with NAME moved to the trash"). It has a
  "Rückgängig" ("Undo") button and a close button (✕). Its HTML was not captured
  before it disappeared.
- Not yet observed: the same control on the **conversation page**
  (`02-conversation.md` lists it there too), where the result may be different,
  for example a return to the inbox.

## Consequence

F7's answer is **Path B**: Quick Ignore and Delete must go from the conversation
to the sender's profile to ignore, which is the same-tab navigation case in
build plan Section 16 and ADR 0008.

## Still missing for the M9 driver

- What the conversation page does after its Delete control is clicked: does it
  stay on the conversation, go to the inbox, or show an empty state.
- The HTML of the trash notice, so its "Rückgängig" button can be offered. Not
  needed to verify Delete: the row, or the conversation, goes away.
- Whether "Profil nicht mehr ignorieren" asks for confirmation.
