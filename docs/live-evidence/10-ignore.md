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
