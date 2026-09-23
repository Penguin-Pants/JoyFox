import { runtimeSettingsArea, type SettingsArea } from "./local-settings";

/**
 * A change marker in `storage.local` for notes and tags, like the triage
 * revision. Every note or tag write sets a new value, and content scripts
 * listen for it through `storage.onChanged`, so another open tab shows the
 * change at once instead of a stale note. It holds a random token, never
 * data. It is separate from the triage revision so a note does not make
 * every open inbox re-evaluate.
 */
export const NOTES_REVISION_KEY = "joyfox.notesRevision";

/** Best effort, and called only after the write committed. */
export async function bumpNotesRevision(
  settings: SettingsArea = runtimeSettingsArea,
): Promise<void> {
  try {
    await settings.set({ [NOTES_REVISION_KEY]: crypto.randomUUID() });
  } catch {
    // Intentionally ignored: the write is stored; other tabs catch up on
    // their next reload.
  }
}
