import type { TriagePlacement } from "../domain/types";
import { message, type Message } from "../i18n/message";

/**
 * The exact sentence versions 1 to 3 wrote for each manual placement, from
 * the English placement names of that time. Frozen: it describes history.
 */
const USER_MOVED: Readonly<Record<TriagePlacement, string>> = {
  qualified: "You moved this sender to Qualified.",
  "needs-review": "You moved this sender to Needs Review.",
  quarantined: "You moved this sender to Quarantined.",
};

/**
 * Schema version 4 stores `ConversationClassification.reasons` as catalog
 * messages instead of English text (docs/i18n-spec.md, Section 4.1). The
 * sentence an earlier version wrote for the record's own placement becomes
 * the message for that placement, so it is shown in the user's language.
 * Any other string, including a similar sentence JoyFox did not write, is
 * kept verbatim as `legacy.text`. An item that is not a string is left as
 * it is, for validation to judge.
 *
 * Used by the database upgrade and by the import of a version 1 to 3 file.
 */
export function migrateReasons(reasons: unknown, placement: unknown): unknown {
  if (!Array.isArray(reasons)) return reasons;
  const own =
    typeof placement === "string" && Object.hasOwn(USER_MOVED, placement)
      ? (placement as TriagePlacement)
      : undefined;
  return reasons.map((reason: unknown): unknown => {
    if (typeof reason !== "string") return reason;
    if (own && reason === USER_MOVED[own])
      return message("triage.reason.userMoved", {
        placement: { key: `placement.${own}` },
      });
    return { key: "legacy.text", params: { text: reason } } satisfies Message;
  });
}
