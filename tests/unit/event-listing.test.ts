import { describe, expect, it } from "vitest";
import { isWallTime, parseEventStart } from "../../src/events/event-date";
import {
  cleanTags,
  compareListings,
  notesProblem,
  MAX_EVENT_TAGS,
} from "../../src/events/listing";
import type { EventMetadata } from "../../src/domain/types";

describe("V1-5 event start from the page", () => {
  it("reads JoyClub's date and time shapes (14-events.md)", () => {
    expect(parseEventStart("Samstag, 27. September 2026 - ab 21:00")).toBe(
      "2026-09-27T21:00",
    );
    expect(
      parseEventStart("  Freitag,\n 3. Oktober 2026 - ab 9:30  Ortszeit"),
    ).toBe("2026-10-03T09:30");
    expect(parseEventStart("Sonntag, 1. März 2026")).toBe("2026-03-01");
    expect(parseEventStart("27.09.2026 ab 21:00")).toBe("2026-09-27T21:00");
  });

  it("never guesses", () => {
    for (const text of [
      "",
      "Heute",
      "Samstag, 31. Februar 2026 - ab 21:00",
      "Samstag, 27. Septober 2026",
      "31.02.2026",
    ])
      expect(parseEventStart(text), text).toBeUndefined();
    // A time out of range keeps the date only.
    expect(parseEventStart("27. September 2026 - ab 25:00")).toBe("2026-09-27");
  });
});

describe("V1-5 stored start", () => {
  it("accepts only a real day and time", () => {
    for (const value of ["2026-09-27", "2026-09-27T21:00", "2028-02-29T00:00"])
      expect(isWallTime(value), value).toBe(true);
    for (const value of [
      "2026-99-99T25:00",
      "2026-02-29",
      "2026-09-27T24:00",
      "2026-09-27T21:60",
      "2026-9-27",
      "27.09.2026",
    ])
      expect(isWallTime(value), value).toBe(false);
  });
});

describe("V1-5 listing helpers", () => {
  it("cleans tags: trimmed, one space, no empty or repeated ones", () => {
    expect(
      cleanTags(["  Swinger  party ", "swinger party", "", "Dresscode"]),
    ).toEqual(["Swinger party", "Dresscode"]);
  });

  it("finds the first problem in the user's input", () => {
    const ok = { note: "Fun", tags: ["a"], attendance: "attending" as const };
    expect(notesProblem(ok)).toBeUndefined();
    expect(notesProblem({ ...ok, note: "x".repeat(4001) })).toBe("note");
    expect(notesProblem({ ...ok, tags: ["x".repeat(65)] })).toBe("tag");
    expect(
      notesProblem({
        ...ok,
        tags: Array.from({ length: MAX_EVENT_TAGS + 1 }, (_, i) => `t${i}`),
      }),
    ).toBe("tags");
    expect(notesProblem({ ...ok, attendance: "maybe" as "attending" })).toBe(
      "attendance",
    );
  });

  it("orders by start, undated last, then title and ID", () => {
    const record = (id: string, startLocal?: string, title?: string) =>
      ({ id, startLocal, title }) as EventMetadata;
    const sorted = [
      record("event:3"),
      record("event:2", "2026-10-01", "B"),
      record("event:1", "2026-09-27T21:00", "A"),
      record("event:4", "2026-10-01", "A"),
    ].sort(compareListings);
    expect(sorted.map((item) => item.id)).toEqual([
      "event:1",
      "event:4",
      "event:2",
      "event:3",
    ]);
  });
});
