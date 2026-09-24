/**
 * The JoyClub controls M9 clicks (ADR 0011). Every selector comes from the
 * owner's live evidence; none is guessed:
 *
 * - `02-conversation.md`: the conversation page's Delete control.
 * - `10-ignore.md`: the profile menu, its Ignore item, the confirmation
 *   dialog and the item that replaces Ignore once the member is ignored.
 *
 * The Ignore items and the dialog buttons have no `data-e2e` hook. They are
 * found by their German `title` or `aria-label`, always inside an element
 * that has one (the profile menu) or inside the dialog's own content.
 */
export const QUICK_ACTION_SELECTORS = {
  /** Also on each inbox row; the conversation's own one is outside them. */
  deleteControl: 'j-control-button[data-e2e="button-delete-conversation"]',
  profileMenu: 'j-context-menu[data-e2e="profile-context-menu"]',
  /** A direct child of the profile menu (label "Profiloptionen"). */
  menuActivator: 'j-control-button[slot="activator"]',
  ignoreItem: 'j-context-menu-item[title="Profil ignorieren"]',
  /** Shown in the menu once the member is ignored: the lasting signal. */
  ignoredItem: 'j-context-menu-item[title="Profil nicht mehr ignorieren"]',
  /** Slotted into the dialog's `j-modal` host, in the light DOM. */
  ignoreDialogContent: ".profile-ignore-modal__content",
  dialogHost: "j-modal",
  ignoreConfirm: 'j-button[aria-label="Ignorieren"]',
} as const;
