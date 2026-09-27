/**
 * The `storage.local` key for the experimental M9 button. Off unless set to
 * `true` (build plan Section 27: keep M9 behind an experimental flag). When
 * on, the button appears on conversation pages, and a click runs the live
 * driver, which clicks JoyClub's Delete and Ignore (ADR 0011). The options
 * page's "Contact rule" tab turns it on and off (owner request, 2026-09-27).
 * An import never sets it.
 */
export const QUICK_ACTION_KEY = "joyfox.quickIgnoreDelete";
