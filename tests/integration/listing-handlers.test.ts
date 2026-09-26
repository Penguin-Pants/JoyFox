import "../setup-indexeddb";
import { beforeEach, describe, expect, it } from "vitest";
import { registerListingHandlers } from "../../src/background/listing-handlers";
import { EventTrackerService } from "../../src/events/event-service";
import { MessageRouter } from "../../src/messaging/router";
import { EVENT_REVISION_KEY } from "../../src/storage/event-revision";
import { repositories } from "../../src/storage/repositories";
import { MemorySettingsArea } from "../memory-settings";
import { freshDatabase } from "../setup-indexeddb";

const now = "2026-09-26T10:00:00.000Z";
let active: string | undefined;
let router: MessageRouter;
let settings: MemorySettingsArea;
let clock = 0;

beforeEach(async () => {
  await freshDatabase();
  for (const id of ["account-a", "account-b"])
    await repositories.extensionAccounts.put(id, {
      id,
      accountId: id,
      joyClubAccountId: `synthetic-${id}`,
      createdAt: now,
      updatedAt: now,
    });
  active = "account-a";
  settings = new MemorySettingsArea();
  router = new MessageRouter();
  clock = 0;
  registerListingHandlers(router, {
    listings: new EventTrackerService(
      undefined,
      () => `2026-09-26T10:00:0${(clock += 1)}.000Z`,
    ),
    activeAccountId: () => Promise.resolve(active),
    settings,
  });
});

let sequence = 0;
async function send(type: string, payload: unknown) {
  const response = await router.route({
    type,
    requestId: `r${(sequence += 1)}`,
    payload,
  } as never);
  if (!response.ok) throw new Error(response.error.code);
  return response.payload as never as Record<string, unknown>;
}

const facts = {
  title: "Synthetic party",
  startLocal: "2026-09-27T21:00",
  path: "/event/1234567.synthetic-party.html",
  venueId: "123",
  venueName: "Synthetic club",
};

const save = (overrides: Record<string, unknown> = {}) =>
  send("listing.save", {
    accountId: "account-a",
    kind: "event",
    eventId: "1234567",
    note: "Bring a mask",
    tags: ["Dresscode", " dresscode "],
    attendance: "attending",
    facts,
    expectedUpdatedAt: null,
    ...overrides,
  });

describe("V1-5 listing handlers", () => {
  it("saves notes with the page's facts and lists them for the active account", async () => {
    expect(await save()).toEqual({
      status: "saved",
      listing: {
        kind: "event",
        eventId: "1234567",
        ...facts,
        note: "Bring a mask",
        tags: ["Dresscode"],
        attendance: "attending",
        updatedAt: "2026-09-26T10:00:01.000Z",
      },
    });
    expect(settings.items.get(EVENT_REVISION_KEY)).toBeDefined();
    expect(
      await send("listing.get", { kind: "event", eventId: "1234567" }),
    ).toMatchObject({
      status: "ok",
      accountId: "account-a",
      listing: { note: "Bring a mask" },
    });
    expect(await send("listing.list", {})).toMatchObject({
      accountId: "account-a",
      listings: [{ eventId: "1234567" }],
    });
    active = "account-b";
    expect(
      await send("listing.get", { kind: "event", eventId: "1234567" }),
    ).toEqual({ status: "ok", accountId: "account-b", listing: null });
    active = undefined;
    expect(
      await send("listing.get", { kind: "event", eventId: "1234567" }),
    ).toEqual({ status: "no-account" });
  });

  it("keeps the stored facts when a later save cannot read them", async () => {
    await save();
    const answer = await save({
      facts: {},
      note: "Changed",
      expectedUpdatedAt: "2026-09-26T10:00:01.000Z",
    });
    expect(answer).toMatchObject({
      status: "saved",
      listing: { ...facts, note: "Changed" },
    });
  });

  it("finds a record from before V1-5 and moves it to the new key on save", async () => {
    await repositories.eventMetadata.put("account-a", {
      id: "1234567",
      accountId: "account-a",
      eventId: "1234567",
      note: "Imported note",
      tags: [],
      attendance: "interested",
      createdAt: now,
      updatedAt: now,
    });
    expect(
      await send("listing.get", { kind: "event", eventId: "1234567" }),
    ).toMatchObject({ listing: { note: "Imported note", updatedAt: now } });
    await expect(save({ expectedUpdatedAt: null })).resolves.toMatchObject({
      status: "conflict",
    });
    await save({ expectedUpdatedAt: now });
    const records = await repositories.eventMetadata.list("account-a");
    expect(records.map((record) => record.id)).toEqual(["event:1234567"]);
    expect(records[0]).toMatchObject({ note: "Bring a mask", createdAt: now });
  });

  it("gives each save its own version, even in one clock tick", async () => {
    const service = new EventTrackerService(undefined, () => now);
    const notes = { note: "One", tags: [], attendance: "attending" as const };
    const first = await service.save(
      "account-a",
      "event",
      "1",
      notes,
      {},
      null,
    );
    if (first.status !== "saved") throw new Error(first.status);
    const second = await service.save(
      "account-a",
      "event",
      "1",
      { ...notes, note: "Two" },
      {},
      first.record.updatedAt,
    );
    if (second.status !== "saved") throw new Error(second.status);
    expect(second.record.updatedAt > first.record.updatedAt).toBe(true);
    // An editor still drawn from the first version cannot overwrite "Two".
    expect(
      await service.save(
        "account-a",
        "event",
        "1",
        { ...notes, note: "Stale" },
        {},
        first.record.updatedAt,
      ),
    ).toMatchObject({ status: "conflict", record: { note: "Two" } });
  });

  it("refuses to overwrite a change made in another tab", async () => {
    await save();
    const answer = await save({ note: "Stale", expectedUpdatedAt: null });
    expect(answer).toMatchObject({
      status: "conflict",
      listing: { note: "Bring a mask" },
    });
  });

  it("stops tracking when everything is cleared", async () => {
    await save();
    settings.items.clear();
    expect(
      await save({
        note: " ",
        tags: [],
        attendance: "unknown",
        expectedUpdatedAt: "2026-09-26T10:00:01.000Z",
      }),
    ).toEqual({ status: "removed" });
    expect(await repositories.eventMetadata.list("account-a")).toEqual([]);
    expect(settings.items.get(EVENT_REVISION_KEY)).toBeDefined();
  });

  it("stores no attendance on a venue", async () => {
    const answer = await save({
      kind: "venue",
      eventId: "123",
      facts: { title: "Synthetic club", path: "/club/123.synthetic-club.html" },
    });
    expect(answer).toMatchObject({
      status: "saved",
      listing: { kind: "venue", attendance: "unknown" },
    });
    const [record] = await repositories.eventMetadata.list("account-a");
    expect(record?.id).toBe("venue:123");
  });

  it("refuses a save for an account that is no longer active", async () => {
    active = "account-b";
    expect(await save()).toEqual({ status: "refused" });
    expect(await repositories.eventMetadata.list("account-a")).toEqual([]);
  });

  it("rejects malformed input", async () => {
    for (const overrides of [
      { kind: "party" },
      { eventId: "12a" },
      { attendance: "maybe" },
      { tags: "one" },
      { note: 7 },
      { facts: { startLocal: "tomorrow" } },
      { facts: { path: "/profile/1.x.html" } },
      { facts: { venueId: "x" } },
      { facts: null },
      { expectedUpdatedAt: 5 },
      { accountId: "" },
    ])
      await expect(save(overrides), JSON.stringify(overrides)).rejects.toThrow(
        "HANDLER_FAILED",
      );
  });
});
