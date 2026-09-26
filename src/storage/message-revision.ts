import type { SettingsArea } from "./local-settings";
import { bumpRevision } from "./revision";

/**
 * A change marker for stored messages (V1-4). Every store sets a new value,
 * so an open options page searches again. JoyClub pages do not listen to it.
 */
export const MESSAGE_REVISION_KEY = "joyfox.messageRevision";

export const bumpMessageRevision = (settings?: SettingsArea) =>
  bumpRevision(MESSAGE_REVISION_KEY, settings);
