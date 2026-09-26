import type { EventMetadata } from "../domain/types";
import { compareListings, kindOf } from "../events/listing";

/**
 * V1-13: the shared-event exception (PRD 7.4, 9.3; ADR 0016). Off unless
 * the user turns it on. With it on, a sender on the stored guest list of an
 * event the user marked Attending or Attended is placed Qualified, unless
 * the user moved that sender by hand or turned the exception off for them.
 */
export const SHARED_EVENT_EXCEPTION_KEY = "joyfox.sharedEventException";

/** The `ExtensionPreference` key of a per-sender opt-out. */
export const SHARED_EVENT_OPT_OUT_KEY = "sharedEventOptOut";
export const sharedEventOptOutId = (memberId: string) =>
  `shared-event-opt-out:${memberId}`;

/** The attendance values that count (owner, 2026-09-26). */
const COUNTED: ReadonlySet<EventMetadata["attendance"]> = new Set([
  "attending",
  "attended",
]);

export interface SharedEvent {
  eventId: string;
  title?: string;
  startLocal?: string;
  attendance: "attending" | "attended";
}

/** Dated events first, the latest start first; events with no date last. */
function latestFirst(a: EventMetadata, b: EventMetadata): number {
  if (a.startLocal && b.startLocal)
    return b.startLocal.localeCompare(a.startLocal) || compareListings(a, b);
  if (a.startLocal) return -1;
  if (b.startLocal) return 1;
  return compareListings(a, b);
}

/**
 * For each member on a counted event's guest list, the event the "Why"
 * panel names: the latest one by start, so an upcoming party comes before
 * one long past.
 */
export function sharedEventsByMember(
  records: readonly EventMetadata[],
): Map<string, SharedEvent> {
  const byMember = new Map<string, SharedEvent>();
  const counted = records
    .filter(
      (record) => kindOf(record) === "event" && COUNTED.has(record.attendance),
    )
    .sort(latestFirst);
  for (const record of counted)
    for (const memberId of record.attendees ?? [])
      if (!byMember.has(memberId))
        byMember.set(memberId, {
          eventId: record.eventId,
          ...(record.title ? { title: record.title } : {}),
          ...(record.startLocal ? { startLocal: record.startLocal } : {}),
          attendance: record.attendance as SharedEvent["attendance"],
        });
  return byMember;
}
