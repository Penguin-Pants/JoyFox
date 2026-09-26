// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import {
  formatDate,
  formatDateTime,
  setLocale,
} from "../../src/i18n/translator";
import { DATE_FIELDS, renderFields } from "../../src/options/record-fields";
import schema from "../../src/domain/types.ts?raw";

afterEach(() => setLocale("en"));

/** The field list as [name, shown value] pairs, top level only. */
function pairs(list: HTMLDListElement): [string, string][] {
  const result: [string, string][] = [];
  for (const term of Array.from(list.querySelectorAll(":scope > dt"))) {
    const value = term.nextElementSibling as HTMLElement;
    result.push([term.textContent ?? "", value.textContent ?? ""]);
  }
  return result;
}

describe("record fields (V1-7)", () => {
  it("shows every stored field by its stored name, in stored order", () => {
    const list = renderFields(document, {
      id: "note-1",
      accountId: "acc-1",
      text: "Met at the party",
      pinned: true,
      archived: false,
      count: 1234,
      tags: [],
      comment: "",
      extra: null,
    });
    expect(pairs(list)).toEqual([
      ["id", "note-1"],
      ["accountId", "acc-1"],
      ["text", "Met at the party"],
      ["pinned", "yes"],
      ["archived", "no"],
      ["count", "1,234"],
      ["tags", "(empty)"],
      ["comment", "(empty)"],
      ["extra", "(empty)"],
    ]);
    // Field names are stored keys, never translated.
    expect(list.querySelector("dt > code")?.textContent).toBe("id");
  });

  it("skips undefined fields, as the JSON export does", () => {
    const list = renderFields(document, { id: "x", label: undefined });
    expect(pairs(list)).toEqual([["id", "x"]]);
  });

  it("shows dates in date fields only, with the stored value kept", () => {
    const stamp = "2026-09-25T20:03:00.000Z";
    const list = renderFields(document, {
      capturedAt: stamp,
      joinedAt: "unknown",
      text: stamp,
    });
    const time = list.querySelector("time")!;
    expect(time.dateTime).toBe(stamp);
    expect(time.title).toBe(stamp);
    expect(time.textContent).toBe(formatDateTime(stamp));
    expect(time.textContent).toContain("UTC");
    expect(pairs(list)).toEqual([
      ["capturedAt", formatDateTime(stamp)],
      ["joinedAt", "unknown"],
      // A text field that looks like a date stays text.
      ["text", stamp],
    ]);
    expect(list.querySelectorAll("time")).toHaveLength(1);
  });

  it("knows every date field of the stored schema", () => {
    const named = new Set(
      Array.from(
        schema.matchAll(/\b(\w+)\??: string\b/gu),
        (match) => match[1]!,
      ).filter((name) => /^at$|At$|^joined/u.test(name)),
    );
    expect([...named].sort()).toEqual([...DATE_FIELDS].sort());
  });

  it("shows nested and differently named dates, such as ActionLog steps", () => {
    const stamp = "2026-09-25T20:03:00.000Z";
    const list = renderFields(document, {
      steps: [{ name: "Delete", ok: true, at: stamp }],
      joinedEarliest: "2024-01-01",
      joinedLatest: "2024-06-30T00:00:00.000Z",
    });
    const times = Array.from(list.querySelectorAll("time"));
    expect(times.map((time) => time.dateTime)).toEqual([
      stamp,
      "2024-01-01",
      "2024-06-30T00:00:00.000Z",
    ]);
    expect(times[0]!.textContent).toBe(formatDateTime(stamp));
    // A date without a time is shown without one.
    expect(times[1]!.textContent).toBe(formatDate("2024-01-01"));
  });

  it("never shows a repaired date: an impossible date stays as stored", () => {
    const list = renderFields(document, {
      createdAt: "2026-02-30T00:00:00.000Z",
      updatedAt: "2026-09-25T20:03:00.000Z trailing",
    });
    expect(list.querySelector("time")).toBeNull();
    expect(pairs(list)).toEqual([
      ["createdAt", "2026-02-30T00:00:00.000Z"],
      ["updatedAt", "2026-09-25T20:03:00.000Z trailing"],
    ]);
  });

  it("shows lists as lists and objects as nested fields", () => {
    const list = renderFields(document, {
      tags: ["friendly", "local"],
      criteria: { minimumPhotoCount: 3, requireVerification: true },
      groups: [{ kind: "all" }],
    });
    const tags = list.querySelector(":scope > dd > ul")!;
    expect(
      Array.from(tags.querySelectorAll("li"), (item) => item.textContent),
    ).toEqual(["friendly", "local"]);
    const nested = list.querySelector<HTMLDListElement>(":scope > dd > dl")!;
    expect(pairs(nested)).toEqual([
      ["minimumPhotoCount", "3"],
      ["requireVerification", "yes"],
    ]);
    const inList = list.querySelector<HTMLDListElement>(
      ":scope > dd > ul > li > dl",
    )!;
    expect(pairs(inList)).toEqual([["kind", "all"]]);
  });

  it("formats values in the UI language", () => {
    setLocale("de");
    const stamp = "2026-09-25T20:03:00.000Z";
    const list = renderFields(document, {
      count: 1234,
      pinned: true,
      tags: [],
      updatedAt: stamp,
    });
    expect(pairs(list)).toEqual([
      ["count", "1.234"],
      ["pinned", "ja"],
      ["tags", "(leer)"],
      ["updatedAt", formatDateTime(stamp)],
    ]);
    expect(formatDateTime(stamp)).toContain("20:03");
  });

  it("shows stored numbers with every digit, in the UI language", () => {
    const values = {
      precise: 50.123456,
      tenth: 0.1,
      tiny: 1.23e-25,
      tiniest: 1e-200,
      largest: 1.7976931348623157e308,
      large: 1e21,
      negative: -123456.789,
    };
    expect(pairs(renderFields(document, values))).toEqual([
      ["precise", "50.123456"],
      ["tenth", "0.1"],
      // JavaScript writes these with an exponent; so does the inspector.
      ["tiny", "1.23E-25"],
      ["tiniest", "1E-200"],
      ["largest", "1.7976931348623157E308"],
      ["large", "1E21"],
      ["negative", "-123,456.789"],
    ]);
    setLocale("de");
    expect(pairs(renderFields(document, values))).toEqual([
      ["precise", "50,123456"],
      ["tenth", "0,1"],
      ["tiny", "1,23E-25"],
      ["tiniest", "1E-200"],
      ["largest", "1,7976931348623157E308"],
      ["large", "1E21"],
      ["negative", "-123.456,789"],
    ]);
  });

  it("sets stored text as text, never as markup", () => {
    const list = renderFields(document, {
      text: '<img src=x onerror="alert(1)">',
    });
    expect(list.querySelector("img")).toBeNull();
    expect(pairs(list)).toEqual([["text", '<img src=x onerror="alert(1)">']]);
  });
});
