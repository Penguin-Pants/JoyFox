# Ignore location (F7, partial)

Reported by the project owner on 2026-09-24 from their own logged-in account. No
control was clicked except to open the menus. Nothing was ignored, blocked or
deleted.

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

- Confirm: `j-button[aria-label="Ignorieren"]`, near
  `.profile-ignore-modal__content`. No `data-e2e` hook was reported.
- The dialog names the member by display name only. It shows no member ID, so
  the identity check must rely on the profile URL, which stays the same while
  the dialog is open (to be confirmed).

## Consequence

F7's answer is **Path B**: Quick Ignore and Delete must go from the conversation
to the sender's profile to ignore, which is the same-tab navigation case in
build plan Section 16 and ADR 0008.

## Still missing for the M9 driver

- The profile's three-dot menu trigger: its element, a selector and its label.
- Whether the `j-context-menu-item` shadow root is open or closed.
- What "Profil ignorieren" does: a confirmation dialog (its root, confirm and
  cancel controls) or an immediate action; the success signal; whether the page
  stays on the profile or routes elsewhere.
- For Delete (`button-delete-conversation`): its confirmation and success
  signal.
