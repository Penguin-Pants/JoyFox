import type { SettingsArea } from "./local-settings";
import { bumpRevision } from "./revision";

/**
 * A change marker for notes and tags, like the triage revision. Every note or
 * tag write sets a new value, so another open tab shows the change at once
 * instead of a stale note. It is separate from the triage revision so a note
 * does not make every open inbox re-evaluate.
 */
export const NOTES_REVISION_KEY = "joyfox.notesRevision";

export const bumpNotesRevision = (settings?: SettingsArea) =>
  bumpRevision(NOTES_REVISION_KEY, settings);
