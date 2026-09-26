// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  formatDate,
  formatDateTime,
  setLocale,
} from "../../src/i18n/translator";
import {
  DATE_PATHS,
  MAX_SHOWN_CHARACTERS,
  MAX_SHOWN_VALUES,
  renderFields,
} from "../../src/options/record-fields";
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
    const leaves = [...DATE_PATHS].map((path) => path.split(".").pop());
    expect(leaves.sort()).toEqual([...named].sort());
  });

  it("shows dates only at their schema path, not in free-form values", () => {
    const stamp = "2026-09-25T20:03:00.000Z";
    const list = renderFields(document, {
      // SavedSearch.filters and ExtensionPreference.value are free-form JSON.
      filters: { at: stamp, createdAt: stamp, steps: [{ at: stamp }] },
      value: stamp,
      at: stamp,
    });
    expect(list.querySelector("time")).toBeNull();
    expect(list.textContent).not.toContain(formatDateTime(stamp));
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

  it("never builds a date path from a free-form field name", () => {
    const has = vi.spyOn(DATE_PATHS as Set<string>, "has");
    const huge = "k".repeat(1_000_000);
    renderFields(document, {
      filters: { [huge]: "2026-09-25T20:03:00.000Z" },
      [huge]: "2026-09-25T20:03:00.000Z",
    });
    const longest = Math.max(...[...DATE_PATHS].map((path) => path.length));
    for (const [path] of has.mock.calls)
      expect(path.length).toBeLessThanOrEqual(longest);
    has.mockRestore();
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

  it("draws at most a fixed number of values for one record", () => {
    const huge = Array.from({ length: 100_000 }, (_, index) => index);
    const list = renderFields(document, { id: "x", filters: { values: huge } });
    const items = list.querySelectorAll("li");
    // "id", "filters" and "values" use three values of the budget.
    expect(items).toHaveLength(MAX_SHOWN_VALUES - 3 + 1);
    const shown = MAX_SHOWN_VALUES - 3;
    expect(items[items.length - 1]!.textContent).toBe(
      `…and ${(100_000 - shown).toLocaleString("en-US")} more (see "Stored JSON")`,
    );
    expect(list.querySelectorAll("span, time").length).toBeLessThanOrEqual(
      MAX_SHOWN_VALUES + 1,
    );
  });

  it("limits many fields and nested lists the same way", () => {
    const wide = Object.fromEntries(
      Array.from({ length: 5_000 }, (_, index) => [`key${index}`, [index]]),
    );
    const list = renderFields(document, wide);
    const terms = list.querySelectorAll(":scope > dt");
    // Each field uses two values: its list and the number in it.
    expect(terms).toHaveLength(MAX_SHOWN_VALUES / 2 + 1);
    expect(terms[terms.length - 1]!.textContent).toBe("…");
    expect(terms[terms.length - 1]!.nextElementSibling?.textContent).toBe(
      `…and ${(5_000 - MAX_SHOWN_VALUES / 2).toLocaleString("en-US")} more (see "Stored JSON")`,
    );
  });

  it("cuts a long text, never inside a character, and says how much is left", () => {
    // An emoji is two UTF-16 units; one straddles the cut.
    const text = `${"a".repeat(MAX_SHOWN_CHARACTERS - 1)}🦊${"b".repeat(50_000)}`;
    const list = renderFields(document, { value: text });
    const shown = list.querySelector(".joyfox-data__value--text")!;
    const more = shown.querySelector(".joyfox-data__value--more")!;
    expect(more.textContent).toBe(
      // The emoji's two UTF-16 units and the 50,000 letters after it.
      `…and ${(50_002).toLocaleString("en-US")} more characters (see "Stored JSON")`,
    );
    const kept = shown.firstChild!.textContent!;
    expect(kept).toBe("a".repeat(MAX_SHOWN_CHARACTERS - 1));
    // A field name is cut the same way.
    const longKey = "k".repeat(MAX_SHOWN_CHARACTERS + 5_000);
    const named = renderFields(document, { [longKey]: 1 });
    const term = named.querySelector("dt")!;
    expect(term.querySelector("code")!.textContent).toBe(
      "k".repeat(MAX_SHOWN_CHARACTERS),
    );
    expect(term.querySelector(".joyfox-data__value--more")!.textContent).toBe(
      `…and ${(5_000).toLocaleString("en-US")} more characters (see "Stored JSON")`,
    );
    // A text at the limit is shown whole.
    const whole = "c".repeat(MAX_SHOWN_CHARACTERS);
    expect(pairs(renderFields(document, { value: whole }))).toEqual([
      ["value", whole],
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

describe("exact numbers on an older Intl (Firefox 121 minimum)", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.resetModules();
  });

  it("needs no fraction-digit option above 20 and no string input", async () => {
    const Original = Intl.NumberFormat;
    // An engine without Intl.NumberFormat v3: a fraction-digit limit of 20,
    // and format() takes numbers only.
    function Older(
      locale?: string | string[],
      options?: Intl.NumberFormatOptions,
    ) {
      if ((options?.maximumFractionDigits ?? 0) > 20)
        throw new RangeError("maximumFractionDigits value is out of range");
      const inner = new Original(locale, options);
      return {
        format(value: number | bigint) {
          if (typeof value === "string") throw new TypeError("number only");
          return inner.format(value);
        },
        formatToParts: (value: number) => inner.formatToParts(value),
      };
    }
    vi.stubGlobal("Intl", { ...Intl, NumberFormat: Older });
    vi.resetModules();
    const { formatExactNumber, setLocale: setFreshLocale } = await import(
      "../../src/i18n/translator"
    );
    expect(
      [50.123456, 0.1, 1234, 1e-200, 1e21, -123456.789].map(formatExactNumber),
    ).toEqual(["50.123456", "0.1", "1,234", "1E-200", "1E21", "-123,456.789"]);
    setFreshLocale("de");
    expect([50.123456, -123456.789].map(formatExactNumber)).toEqual([
      "50,123456",
      "-123.456,789",
    ]);
  });
});
