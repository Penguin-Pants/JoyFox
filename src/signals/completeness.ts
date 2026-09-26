import type { ProfileFacts } from "../qualification/facts";
import { COMPLETE_PROFILE } from "../rules/presets";

/**
 * The completeness badge (PRD 6.2, 8.1; D8, ADR 0016): a profile with fewer
 * than 3 photos or fewer than 50 words of profile text is incomplete. JoyFox
 * never guesses: a value it does not know leaves the state unknown, unless
 * the other value already makes the profile incomplete.
 */
export type CompletenessState = "complete" | "incomplete" | "unknown";

export interface Completeness {
  state: CompletenessState;
  photoCount: ProfileFacts["photoCount"];
  profileWordCount: ProfileFacts["profileWordCount"];
  verification: ProfileFacts["verification"];
}

export function completeness(
  facts: Pick<ProfileFacts, "photoCount" | "profileWordCount" | "verification">,
): Completeness {
  const { photoCount, profileWordCount, verification } = facts;
  const below =
    (photoCount !== "unknown" && photoCount < COMPLETE_PROFILE.photos) ||
    (profileWordCount !== "unknown" &&
      profileWordCount < COMPLETE_PROFILE.words);
  const known = photoCount !== "unknown" && profileWordCount !== "unknown";
  return {
    state: below ? "incomplete" : known ? "complete" : "unknown",
    photoCount,
    profileWordCount,
    verification,
  };
}
