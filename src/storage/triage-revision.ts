import { runtimeSettingsArea, type SettingsArea } from "./local-settings";

/**
 * A change marker in `storage.local`. Every write that can change a triage
 * placement (the rule, a manual placement, a trust outcome, a profile
 * snapshot) sets a new value, and content scripts listen for it through
 * `storage.onChanged` so an open inbox re-evaluates at once (PRD Section
 * 10.2). It holds a random token, never data.
 */
export const TRIAGE_REVISION_KEY = "joyfox.triageRevision";

/**
 * Best effort, and called only after the data write committed. A failure
 * here must not report the committed write as failed: the caller would
 * then show "nothing was changed" and a retry would store it twice. The page
 * that made the write reloads on its own; other open pages catch up on
 * their next change or reload.
 */
export async function bumpTriageRevision(
  settings: SettingsArea = runtimeSettingsArea,
): Promise<void> {
  try {
    await settings.set({ [TRIAGE_REVISION_KEY]: crypto.randomUUID() });
  } catch {
    // Intentionally ignored; see above.
  }
}
