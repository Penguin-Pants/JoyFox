import "../setup-indexeddb";
import { beforeEach, describe, expect, it } from "vitest";
import { registerSearchHandlers } from "../../src/background/search-handlers";
import { MessageRouter } from "../../src/messaging/router";
import {
  MAX_SAVED_SEARCH_NAME_LENGTH,
  MAX_SAVED_SEARCHES,
} from "../../src/search/saved-search";
import { SavedSearchService } from "../../src/search/saved-search-service";
import { repositories } from "../../src/storage/repositories";
import { SAVED_SEARCH_REVISION_KEY } from "../../src/storage/saved-search-revision";
import { MemorySettingsArea } from "../memory-settings";
import { freshDatabase } from "../setup-indexeddb";

const now = "2026-09-26T10:00:00.000Z";
const URL_A =
  "https://www.joyclub.de/member/place-as-r/?user_geo_distance=25&user_age=30_40#infiniteScroll";
let active: string | undefined;
let router: MessageRouter;
let settings: MemorySettingsArea;

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
  registerSearchHandlers(router, {
    searches: new SavedSearchService(undefined, () => now),
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

const save = (name: string, url = URL_A, accountId = "account-a") =>
  send("search.save", { accountId, name, url });
const list = () => send("search.list", {});

describe("V1-3 saved-search handlers", () => {
  it("saves the address with its filters and lists it for the active account only", async () => {
    expect(await save("  Weekend   nearby ")).toMatchObject({
      status: "saved",
    });
    const answer = await list();
    expect(answer).toEqual({
      accountId: "account-a",
      searches: [
        {
          id: expect.stringMatching(/^search:/),
          name: "Weekend nearby",
          url: URL_A,
          filters: {
            path: ["place-as-r"],
            query: [
              ["user_geo_distance", "25"],
              ["user_age", "30_40"],
            ],
          },
        },
      ],
    });
    expect(settings.items.get(SAVED_SEARCH_REVISION_KEY)).toBeDefined();
    active = "account-b";
    expect(await list()).toEqual({ accountId: "account-b", searches: [] });
    active = undefined;
    expect(await list()).toEqual({ searches: [] });
  });

  it("lists by name", async () => {
    await save("Zeta");
    await save("alpha");
    await save("Mid");
    const answer = (await list()) as { searches: Array<{ name: string }> };
    expect(answer.searches.map((search) => search.name)).toEqual([
      "alpha",
      "Mid",
      "Zeta",
    ]);
  });

  it("refuses a write for an account that is no longer active", async () => {
    active = "account-b";
    expect(await save("Late")).toEqual({ status: "refused" });
    expect(await repositories.savedSearches.list("account-a")).toEqual([]);
    expect(settings.items.get(SAVED_SEARCH_REVISION_KEY)).toBeUndefined();
  });

  it("refuses an address that is not a verified search address", async () => {
    expect(
      await save("Profile", "https://www.joyclub.de/profile/1234567.x.html"),
    ).toEqual({ status: "no-match" });
    expect(await repositories.savedSearches.list("account-a")).toEqual([]);
  });

  it("stops at the most saved searches allowed", async () => {
    for (let index = 0; index < MAX_SAVED_SEARCHES; index += 1)
      await repositories.savedSearches.put("account-a", {
        id: `search:${index}`,
        accountId: "account-a",
        name: `S${index}`,
        url: URL_A,
        filters: { path: [], query: [] },
        createdAt: now,
        updatedAt: now,
      });
    expect(await save("One more")).toEqual({ status: "full" });
  });

  it("rejects malformed input", async () => {
    for (const payload of [
      { accountId: "account-a", name: "", url: URL_A },
      {
        accountId: "account-a",
        name: "x".repeat(MAX_SAVED_SEARCH_NAME_LENGTH + 1),
        url: URL_A,
      },
      { accountId: "account-a", name: "A", url: 7 },
      { accountId: "", name: "A", url: URL_A },
    ])
      await expect(send("search.save", payload)).rejects.toThrow(
        "HANDLER_FAILED",
      );
    await expect(
      send("search.delete", { accountId: "account-a", id: "template:1" }),
    ).rejects.toThrow("HANDLER_FAILED");
  });

  it("deletes a saved search, and only for the active account", async () => {
    await save("Keep me");
    const [search] = await repositories.savedSearches.list("account-a");
    active = "account-b";
    expect(
      await send("search.delete", { accountId: "account-a", id: search!.id }),
    ).toEqual({ status: "refused" });
    expect(await repositories.savedSearches.list("account-a")).toHaveLength(1);
    active = "account-a";
    expect(
      await send("search.delete", { accountId: "account-a", id: search!.id }),
    ).toEqual({ status: "deleted" });
    expect(await repositories.savedSearches.list("account-a")).toEqual([]);
  });
});
