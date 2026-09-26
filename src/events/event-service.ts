import type { EventMetadata } from "../domain/types";
import { EventMetadataRepository } from "../storage/repositories";
import {
  cleanTags,
  compareListings,
  cutListingText,
  listingRecordId,
  type Attendance,
  type ListingFacts,
  type ListingKind,
  type ListingNotes,
  type SaveListingResult,
} from "./listing";

/**
 * V1-5: the user's private notes, tags and attendance on event and venue
 * listings. Writes come from the page through the background, which holds
 * the account's lock and checks that the account is still active before it
 * calls `save`. So this service takes no lock itself (locks are not
 * reentrant, `account-lock.ts`).
 */
export class EventTrackerService {
  constructor(
    private readonly listings = new EventMetadataRepository(),
    private readonly now: () => string = () => new Date().toISOString(),
  ) {}

  get(
    accountId: string,
    kind: ListingKind,
    id: string,
  ): Promise<EventMetadata | undefined> {
    return this.listings.get(accountId, listingRecordId(kind, id));
  }

  async list(accountId: string): Promise<EventMetadata[]> {
    return (await this.listings.list(accountId)).sort(compareListings);
  }

  /**
   * Store the user's notes on one listing. `expectedUpdatedAt` is the
   * version the editor was drawn from (`null`: no record); a record changed
   * since is not overwritten. Notes left empty (no note, no tags, no
   * attendance) remove the record, so the listing is no longer tracked.
   */
  async save(
    accountId: string,
    kind: ListingKind,
    id: string,
    notes: ListingNotes,
    facts: ListingFacts,
    expectedUpdatedAt: string | null,
  ): Promise<SaveListingResult> {
    const recordId = listingRecordId(kind, id);
    const existing = await this.listings.get(accountId, recordId);
    if ((existing?.updatedAt ?? null) !== expectedUpdatedAt)
      return { status: "conflict", record: existing };
    const note = notes.note.trim();
    const tags = cleanTags(notes.tags);
    const attendance: Attendance =
      kind === "venue" ? "unknown" : notes.attendance;
    if (!note && tags.length === 0 && attendance === "unknown") {
      if (existing) await this.listings.delete(accountId, recordId);
      return { status: "removed" };
    }
    const timestamp = this.now();
    const title = cutListingText(facts.title) ?? existing?.title;
    const startLocal = facts.startLocal ?? existing?.startLocal;
    const path = facts.path ?? existing?.path;
    const venueId = facts.venueId ?? existing?.venueId;
    const venueName = cutListingText(facts.venueName) ?? existing?.venueName;
    const record: EventMetadata = {
      id: recordId,
      accountId,
      eventId: id,
      kind,
      ...(title ? { title } : {}),
      ...(startLocal ? { startLocal } : {}),
      ...(path ? { path } : {}),
      ...(venueId ? { venueId } : {}),
      ...(venueName ? { venueName } : {}),
      ...(note ? { note } : {}),
      tags,
      attendance,
      createdAt: existing?.createdAt ?? timestamp,
      updatedAt: timestamp,
    };
    await this.listings.put(accountId, record);
    return { status: "saved", record };
  }
}
