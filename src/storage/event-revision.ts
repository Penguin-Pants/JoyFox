import type { SettingsArea } from "./local-settings";
import { bumpRevision } from "./revision";

/**
 * A change marker for event notes, like the notes revision. Every save or
 * removal sets a new value, so another open event, venue or list page shows
 * the change at once.
 */
export const EVENT_REVISION_KEY = "joyfox.eventRevision";

export const bumpEventRevision = (settings?: SettingsArea) =>
  bumpRevision(EVENT_REVISION_KEY, settings);
