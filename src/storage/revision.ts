import { runtimeSettingsArea, type SettingsArea } from "./local-settings";

/**
 * Set a change marker in `storage.local` to a new random token. Content
 * scripts listen for it through `storage.onChanged` and reload what they
 * show. It holds a token, never data. Best effort, and called only after
 * the data write committed: a failure must not report that write as failed.
 */
export async function bumpRevision(
  key: string,
  settings: SettingsArea = runtimeSettingsArea,
): Promise<void> {
  try {
    await settings.set({ [key]: crypto.randomUUID() });
  } catch {
    // Intentionally ignored: other pages catch up on their next reload.
  }
}
