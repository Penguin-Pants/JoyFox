import type { EventMetadata } from "../domain/types";
import { MAX_NOTE_LENGTH, MAX_TAG_LENGTH } from "../notes/limits";

/**
 * The pure part of V1-5, shared by the content script, the background and
 * the options page. It holds no storage code, so the content script can use
 * it without bundling IndexedDB access.
 */

/** As `normalizeTagLabel` in `notes-service.ts`, without its storage code. */
const normalizeTag = (label: string) => label.trim().replace(/\s+/gu, " ");
/** Case-insensitive, locale-independent, as member tags are compared. */
const tagKey = (label: string) => normalizeTag(label).toLowerCase();

export type ListingKind = "event" | "venue";
export type Attendance = EventMetadata["attendance"];

export const ATTENDANCE_VALUES: readonly Attendance[] = [
  "unknown",
  "interested",
  "attending",
  "not-attending",
  "attended",
];

/** A storage guard chosen by this implementation, like the note limit. */
export const MAX_EVENT_TAGS = 20;
export const MAX_LISTING_TEXT_LENGTH = 300;

/** The listing facts read from the page when the user saves. */
export interface ListingFacts {
  title?: string;
  startLocal?: string;
  path?: string;
  venueId?: string;
  venueName?: string;
}

/** What the user edits: their own note, tags and attendance. */
export interface ListingNotes {
  note: string;
  tags: string[];
  attendance: Attendance;
}

export type SaveListingResult =
  | { status: "saved"; record: EventMetadata }
  | { status: "removed" }
  | { status: "conflict"; record: EventMetadata | undefined };

export const listingRecordId = (kind: ListingKind, id: string) =>
  `${kind}:${id}`;

export const kindOf = (record: Pick<EventMetadata, "kind">): ListingKind =>
  record.kind ?? "event";

/** Tags in the order given, trimmed, without empty or repeated ones. */
export function cleanTags(tags: readonly string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const raw of tags) {
    const label = normalizeTag(raw);
    const key = tagKey(label);
    if (label.length === 0 || seen.has(key)) continue;
    seen.add(key);
    result.push(label);
  }
  return result;
}

/** The first problem with the user's input, or `undefined`. */
export function notesProblem(
  notes: ListingNotes,
): "note" | "tag" | "tags" | "attendance" | undefined {
  if (notes.note.trim().length > MAX_NOTE_LENGTH) return "note";
  if (notes.tags.some((tag) => normalizeTag(tag).length > MAX_TAG_LENGTH))
    return "tag";
  if (cleanTags(notes.tags).length > MAX_EVENT_TAGS) return "tags";
  if (!ATTENDANCE_VALUES.includes(notes.attendance)) return "attendance";
  return undefined;
}

/** Listing text as stored: one line, at most MAX_LISTING_TEXT_LENGTH. */
export const cutListingText = (text: string | undefined) => {
  const clean = text?.replace(/\s+/gu, " ").trim();
  return clean ? clean.slice(0, MAX_LISTING_TEXT_LENGTH) : undefined;
};

/**
 * Chronological for the calendar: events by start, those without a start
 * after them; then by title and ID, so the order is stable.
 */
export function compareListings(a: EventMetadata, b: EventMetadata): number {
  const aStart = a.startLocal ?? "￿";
  const bStart = b.startLocal ?? "￿";
  return (
    aStart.localeCompare(bStart) ||
    (a.title ?? "").localeCompare(b.title ?? "") ||
    a.id.localeCompare(b.id)
  );
}
