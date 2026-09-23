import type { SettingsArea } from "./local-settings";
import { bumpRevision } from "./revision";

/**
 * A change marker for the M9 ActionLog. Every stored transition sets a new
 * value, so another tab showing the same member sees a run start, move and
 * end, instead of a "running" state that never changes.
 */
export const ACTION_REVISION_KEY = "joyfox.actionRevision";

export const bumpActionRevision = (settings?: SettingsArea) =>
  bumpRevision(ACTION_REVISION_KEY, settings);
