import type { EventMetadata } from "../domain/types";
import { isWallTime } from "../events/event-date";
import type { EventTrackerService } from "../events/event-service";
import {
  ATTENDANCE_VALUES,
  kindOf,
  notesProblem,
  type ListingFacts,
  type ListingKind,
} from "../events/listing";
import type { ListingSummary, MessageContract } from "../messaging/protocol";
import type { MessageRouter } from "../messaging/router";
import { bumpEventRevision } from "../storage/event-revision";
import type { SettingsArea } from "../storage/local-settings";
import {
  invalid,
  lockedWrite,
  type ActiveAccountSource,
} from "./handler-guards";

export interface ListingHandlerDeps extends ActiveAccountSource {
  listings: EventTrackerService;
  /** Where the event revision is set; `storage.local` by default. */
  settings?: SettingsArea;
}

type SaveAnswer = MessageContract["listing.save"]["response"];

const NUMBER = /^\d{1,12}$/u;
const PATH = /^\/(event|club)\/\d{1,12}\.[^/]+\.html$/u;

export function summarize(record: EventMetadata): ListingSummary {
  return {
    kind: kindOf(record),
    eventId: record.eventId,
    ...(record.title ? { title: record.title } : {}),
    ...(record.startLocal ? { startLocal: record.startLocal } : {}),
    ...(record.path ? { path: record.path } : {}),
    ...(record.venueId ? { venueId: record.venueId } : {}),
    ...(record.venueName ? { venueName: record.venueName } : {}),
    ...(record.note ? { note: record.note } : {}),
    tags: record.tags,
    attendance: record.attendance,
    updatedAt: record.updatedAt,
  };
}

function listingKind(value: unknown): ListingKind {
  if (value !== "event" && value !== "venue") throw invalid("listing kind");
  return value;
}

function listingId(value: unknown): string {
  if (typeof value !== "string" || !NUMBER.test(value))
    throw invalid("listing");
  return value;
}

function optionalText(value: unknown, pattern?: RegExp): string | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== "string" || (pattern && !pattern.test(value)))
    throw invalid("listing fact");
  return value;
}

/** The facts a page sent, each checked for shape; unknown fields dropped. */
function listingFacts(value: unknown): ListingFacts {
  if (typeof value !== "object" || value === null)
    throw invalid("listing facts");
  const facts = value as Record<string, unknown>;
  const title = optionalText(facts.title);
  const startLocal = optionalText(facts.startLocal);
  if (startLocal !== undefined && !isWallTime(startLocal))
    throw invalid("listing fact");
  const path = optionalText(facts.path, PATH);
  const venueId = optionalText(facts.venueId, NUMBER);
  const venueName = optionalText(facts.venueName);
  return {
    ...(title !== undefined ? { title } : {}),
    ...(startLocal !== undefined ? { startLocal } : {}),
    ...(path !== undefined ? { path } : {}),
    ...(venueId !== undefined ? { venueId } : {}),
    ...(venueName !== undefined ? { venueName } : {}),
  };
}

/**
 * Register the V1-5 handlers for event, venue and event-list pages. Reads
 * use the active account; a save names the account its page was drawn for
 * and runs under that account's lock, and is refused if it is no longer
 * active.
 */
export function registerListingHandlers(
  router: MessageRouter,
  deps: ListingHandlerDeps,
): void {
  router.register("listing.get", async (payload) => {
    const kind = listingKind(payload?.kind);
    const id = listingId(payload?.eventId);
    const accountId = await deps.activeAccountId();
    if (!accountId) return { status: "no-account" };
    const record = await deps.listings.get(accountId, kind, id);
    return {
      status: "ok",
      accountId,
      listing: record ? summarize(record) : null,
    };
  });
  router.register("listing.list", async () => {
    const accountId = await deps.activeAccountId();
    if (!accountId) return { listings: [] };
    const records = await deps.listings.list(accountId);
    return { accountId, listings: records.map(summarize) };
  });
  router.register("listing.save", async (payload) => {
    const kind = listingKind(payload?.kind);
    const id = listingId(payload?.eventId);
    const note = payload?.note;
    const tags = payload?.tags;
    const attendance = payload?.attendance;
    if (
      typeof note !== "string" ||
      !Array.isArray(tags) ||
      !tags.every((tag) => typeof tag === "string") ||
      !ATTENDANCE_VALUES.includes(attendance)
    )
      throw invalid("listing notes");
    const notes = { note, tags: tags as string[], attendance };
    if (notesProblem(notes)) throw invalid("listing notes");
    const facts = listingFacts(payload?.facts);
    const expected = payload?.expectedUpdatedAt;
    if (expected !== null && typeof expected !== "string")
      throw invalid("listing version");
    const answer = await lockedWrite<SaveAnswer>(
      deps,
      payload?.accountId,
      { status: "refused" },
      async (accountId) => {
        const result = await deps.listings.save(
          accountId,
          kind,
          id,
          notes,
          facts,
          expected,
        );
        if (result.status === "saved")
          return { status: "saved", listing: summarize(result.record) };
        if (result.status === "removed") return { status: "removed" };
        return {
          status: "conflict",
          listing: result.record ? summarize(result.record) : null,
        };
      },
    );
    if (answer.status === "saved" || answer.status === "removed")
      await bumpEventRevision(deps.settings);
    return answer;
  });
}
