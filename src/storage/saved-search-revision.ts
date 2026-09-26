import type { SettingsArea } from "./local-settings";
import { bumpRevision } from "./revision";

/**
 * A change marker for saved searches, like the notes revision. Every save or
 * delete sets a new value, so another open search page lists the change at
 * once.
 */
export const SAVED_SEARCH_REVISION_KEY = "joyfox.savedSearchRevision";

export const bumpSavedSearchRevision = (settings?: SettingsArea) =>
  bumpRevision(SAVED_SEARCH_REVISION_KEY, settings);
