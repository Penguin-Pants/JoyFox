import type {
  ConversationExtraction,
  InboxRowExtraction,
  ProfileExtraction,
} from "../extraction/joyclub";
import {
  personallyKnownFromCode,
  verificationFromCode,
} from "../extraction/joyclub";
import type { ProfileFacts } from "../qualification/facts";

/**
 * The profile facts each verified page shows (08-attribute-matrix.md). A
 * field a page does not show is left out, so the merge treats it as not
 * observed and may fill it from a cached snapshot.
 */
function shieldFacts(
  code: InboxRowExtraction["verificationCode"],
): Partial<ProfileFacts> {
  const facts: Partial<ProfileFacts> = {};
  const verification = verificationFromCode(code);
  const personallyKnown = personallyKnownFromCode(code);
  if (verification !== "unknown") facts.verification = verification;
  if (personallyKnown !== "unknown") facts.personallyKnown = personallyKnown;
  return facts;
}

export const observedFromInboxRow = (row: InboxRowExtraction) =>
  shieldFacts(row.verificationCode);

export const observedFromConversation = (page: ConversationExtraction) =>
  shieldFacts(page.verificationCode);

export function observedFromProfile(
  page: ProfileExtraction,
): Partial<ProfileFacts> {
  const facts = shieldFacts(page.verificationCode);
  if (page.photoCount.status === "found")
    facts.photoCount = page.photoCount.value;
  if (page.profileWordCount.status === "found")
    facts.profileWordCount = page.profileWordCount.value;
  if (page.joinedAt.status === "found") facts.joinedAt = page.joinedAt.value;
  if (page.joinedWindow.status === "found")
    facts.joinedWindow = page.joinedWindow.value;
  return facts;
}

/**
 * A stable key for a set of observed facts. The join window is computed from
 * "now" on every extraction, so it is keyed by day, not by millisecond; any
 * finer key would change on every page mutation.
 */
export function factsKey(facts: Partial<ProfileFacts>): string {
  const window =
    facts.joinedWindow && facts.joinedWindow !== "unknown"
      ? `${facts.joinedWindow.earliest.slice(0, 10)}/${facts.joinedWindow.latest.slice(0, 10)}`
      : "";
  return JSON.stringify([
    facts.verification,
    facts.personallyKnown,
    facts.photoCount,
    facts.profileWordCount,
    facts.joinedAt,
    window,
  ]);
}
