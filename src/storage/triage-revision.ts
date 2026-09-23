import { runtimeSettingsArea, type SettingsArea } from "./local-settings";

/**
 * A change marker in `storage.local`. Every write that can change a triage
 * placement (the rule, a manual placement, a trust outcome, a profile
 * snapshot) sets a new value, and content scripts listen for it through
 * `storage.onChanged` so an open inbox re-evaluates at once (PRD Section
 * 10.2). It holds a random token, never data.
 */
export const TRIAGE_REVISION_KEY = "joyfox.triageRevision";

export async function bumpTriageRevision(
  settings: SettingsArea = runtimeSettingsArea,
): Promise<void> {
  await settings.set({ [TRIAGE_REVISION_KEY]: crypto.randomUUID() });
}
