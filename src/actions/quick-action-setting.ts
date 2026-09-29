/**
 * The `storage.local` key for the experimental "Ignore and Delete" button.
 * On unless set to `false` (owner decision, 2026-09-29, ADR 0017; build plan
 * Section 27 keeps M9 behind this flag). When on, the button appears on
 * conversation pages beside "Delete", and a click runs the live driver,
 * which clicks JoyClub's Delete and Ignore (ADR 0011). It controls only
 * "Ignore and Delete": the "Delete" button and the trash step of "Mark as
 * junk" click JoyClub's trash also while it is off (D2). The options page's
 * "Contact rule" tab turns it on and off (owner request, 2026-09-27). An
 * import never sets it.
 */
export const QUICK_ACTION_KEY = "joyfox.quickIgnoreDelete";
