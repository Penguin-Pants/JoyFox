import { describe, expect, it } from "vitest";
import {
  MAX_SAVED_SEARCH_URL_LENGTH,
  normalizeSearchName,
  readSearchAddress,
  replayAddress,
} from "../../src/search/saved-search";

// Shapes from docs/live-evidence/11-search.md, with invented values.
const FILTERED =
  "https://www.joyclub.de/member/place-as-r/is-gender_gender/?user_geo_distance=25&user_age=30_40&user_match_opposite_search_criteria=0&user_ff=123456#infiniteScroll";

describe("V1-3 search address", () => {
  it("reads the filters from a filtered search address", () => {
    expect(readSearchAddress(FILTERED)).toEqual({
      status: "ok",
      url: FILTERED,
      filters: {
        path: ["place-as-r", "is-gender_gender"],
        query: [
          ["user_geo_distance", "25"],
          ["user_age", "30_40"],
          ["user_match_opposite_search_criteria", "0"],
          ["user_ff", "123456"],
        ],
      },
    });
  });

  it("accepts the unfiltered search page", () => {
    expect(readSearchAddress("https://www.joyclub.de/member/")).toMatchObject({
      status: "ok",
      filters: { path: [], query: [] },
    });
  });

  it("refuses every address that is not a verified search address", () => {
    for (const url of [
      "not a url",
      "http://www.joyclub.de/member/",
      "https://joyclub.de/member/",
      "https://www.joyce.app/member/",
      "https://evil.example/member/",
      "https://www.joyclub.de:8443/member/",
      "https://user:pass@www.joyclub.de/member/",
      "https://www.joyclub.de/member",
      "https://www.joyclub.de/member/x",
      "https://www.joyclub.de/profile/1234567.name.html",
      "https://www.joyclub.de/clubmail/",
      `https://www.joyclub.de/member/?q=${"a".repeat(MAX_SAVED_SEARCH_URL_LENGTH)}`,
    ])
      expect(readSearchAddress(url), url).toEqual({ status: "no-match" });
  });

  it("opens a saved search whose address still carries its filters", () => {
    const address = readSearchAddress(FILTERED);
    if (address.status !== "ok") throw new Error("setup");
    expect(replayAddress(address)).toBe(FILTERED);
  });

  it("opens nothing when the address or its filters no longer match", () => {
    const address = readSearchAddress(FILTERED);
    if (address.status !== "ok") throw new Error("setup");
    // JoyClub moved its search: the stored address fails the registry path.
    expect(
      replayAddress({
        url: "https://www.joyclub.de/search/members/",
        filters: { path: [], query: [] },
      }),
    ).toBeUndefined();
    // An edited or imported record whose filters differ from its address.
    expect(
      replayAddress({
        url: FILTERED,
        filters: { ...address.filters, query: [] },
      }),
    ).toBeUndefined();
    for (const filters of [undefined, null, "x", { path: [1], query: [] }])
      expect(replayAddress({ url: FILTERED, filters })).toBeUndefined();
  });

  it("collapses white space in a name", () => {
    expect(normalizeSearchName("  Weekend \n  nearby ")).toBe("Weekend nearby");
  });
});
