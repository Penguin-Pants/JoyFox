import type { SettingsArea } from "./local-settings";
import { bumpRevision } from "./revision";

/**
 * A change marker for the member directory: set when a card's nickname is
 * stored or changed, so an open options page names the member at once.
 * JoyClub pages do not listen to it.
 */
export const MEMBER_REVISION_KEY = "joyfox.memberRevision";

export const bumpMemberRevision = (settings?: SettingsArea) =>
  bumpRevision(MEMBER_REVISION_KEY, settings);
