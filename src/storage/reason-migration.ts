import type { TriagePlacement } from "../domain/types";
import { message, type Message } from "../i18n/message";

const PLACEMENTS: readonly TriagePlacement[] = [
  "qualified",
  "needs-review",
  "quarantined",
];

/** The one sentence schema version 2 wrote for a manual placement. */
const USER_MOVED = /^You moved this sender to .+\.$/su;

/**
 * Schema version 4 stores `ConversationClassification.reasons` as catalog
 * messages instead of English text (docs/i18n-spec.md, Section 4.1). A
 * sentence from an earlier version, "You moved this sender to <placement>." becomes the
 * message for the record's own placement, so it is shown in the user's
 * language. Any other string is kept verbatim as `legacy.text`. An item that
 * is not a string is left as it is, for validation to judge.
 *
 * Used by the database upgrade and by the import of a version 1 to 3 file.
 */
export function migrateReasons(reasons: unknown, placement: unknown): unknown {
  if (!Array.isArray(reasons)) return reasons;
  return reasons.map((reason: unknown): unknown => {
    if (typeof reason !== "string") return reason;
    if (
      USER_MOVED.test(reason) &&
      PLACEMENTS.includes(placement as TriagePlacement)
    )
      return message("triage.reason.userMoved", {
        placement: { key: `placement.${placement as TriagePlacement}` },
      });
    return { key: "legacy.text", params: { text: reason } } satisfies Message;
  });
}
