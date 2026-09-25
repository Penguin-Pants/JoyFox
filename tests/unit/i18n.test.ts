import { afterEach, describe, expect, it, vi } from "vitest";
import { de } from "../../src/i18n/catalog/de";
import { en, type MessageKey } from "../../src/i18n/catalog/en";
import {
  LOCALE_KEY,
  readLocale,
  resolveDefaultLocale,
} from "../../src/i18n/locale";
import {
  isMessage,
  message,
  paramsOf,
  type Message,
} from "../../src/i18n/message";
import {
  currentLocale,
  formatDate,
  formatNumber,
  onLocaleChange,
  setLocale,
  t,
} from "../../src/i18n/translator";
import { MemorySettingsArea } from "../memory-settings";

afterEach(() => setLocale("en"));

const KEYS = Object.keys(en) as MessageKey[];
const FUNCTION_KEYS = KEYS.filter((key) => paramsOf(key) !== null);

/**
 * Params for a key, from its runtime spec: `number` for every number, a
 * marked text for every string, and a message for every nested message.
 */
function paramsFor(key: MessageKey, number: number): Record<string, unknown> {
  const params: Record<string, unknown> = {};
  for (const [name, kind] of Object.entries(paramsOf(key) ?? {}))
    params[name] =
      kind === "number"
        ? number
        : kind === "string"
          ? `⟦${name}⟧`
          : { key: "legacy.text", params: { text: `⟦${name}⟧` } };
  return params;
}

const render = (key: MessageKey, number = 3) =>
  t({ key, params: paramsFor(key, number) } as Message);

describe("default language", () => {
  it("follows Firefox: German for every de tag, English for the rest", () => {
    for (const tag of ["de", "de-DE", "de-AT", "de-CH", "DE-de"])
      expect(resolveDefaultLocale(tag)).toBe("de");
    for (const tag of ["en-US", "fr", "", "dex", "nl-DE"])
      expect(resolveDefaultLocale(tag)).toBe("en");
  });

  it("reads a stored choice, and falls back to Firefox's language", async () => {
    const area = new MemorySettingsArea();
    expect(await readLocale(area, () => "de-AT")).toBe("de");
    expect(await readLocale(area, () => "en-GB")).toBe("en");
    await area.set({ [LOCALE_KEY]: "en" });
    expect(await readLocale(area, () => "de-DE")).toBe("en");
    await area.set({ [LOCALE_KEY]: "fr" });
    expect(await readLocale(area, () => "de-DE")).toBe("de");
    await area.set({ [LOCALE_KEY]: 7 });
    expect(await readLocale(area, () => "en-US")).toBe("en");
  });

  it("uses the default when the setting cannot be read", async () => {
    const area = new MemorySettingsArea();
    area.get = () => Promise.reject(new Error("unavailable"));
    expect(await readLocale(area, () => "de")).toBe("de");
  });
});

describe("catalogs", () => {
  it("have the same keys and no empty value in either language", () => {
    expect(Object.keys(de).sort()).toEqual([...KEYS].sort());
    for (const locale of ["en", "de"] as const) {
      setLocale(locale);
      for (const key of KEYS)
        if (key !== "legacy.text")
          expect(render(key).trim(), `${locale} ${key}`).not.toBe("");
    }
  });

  it("formats every number param for the language", () => {
    const numeric = FUNCTION_KEYS.filter((key) =>
      Object.values(paramsOf(key) ?? {}).includes("number"),
    );
    expect(numeric.length).toBeGreaterThan(20);
    for (const [locale, expected] of [
      ["en", "1,234.5"],
      ["de", "1.234,5"],
    ] as const) {
      setLocale(locale);
      for (const key of numeric) {
        const output = render(key, 1234.5);
        expect(output, `${locale} ${key}`).toContain(expected);
        expect(output, `${locale} ${key}`).not.toContain("1234.5");
      }
    }
  });

  it("uses the same placeholders and the same params in both languages", () => {
    const placeholders = (value: string) =>
      (value.match(/\$\{[^}]*\}|\{[^}]*\}/gu) ?? []).sort();
    for (const key of KEYS) {
      const english = en[key];
      const german = de[key];
      expect(typeof german, key).toBe(typeof english);
      if (typeof english === "string")
        expect(placeholders(german as string), key).toEqual(
          placeholders(english),
        );
    }
    // Every text param a key shows in English, it shows in German too.
    const shown = (output: string) =>
      (output.match(/⟦\w+⟧/gu) ?? []).sort().join();
    for (const key of FUNCTION_KEYS) {
      setLocale("en");
      const english = shown(render(key));
      setLocale("de");
      expect(shown(render(key)), key).toBe(english);
    }
  });

  it("keeps brand names and JoyClub's own German labels", () => {
    setLocale("de");
    expect(t("action.step.ignore")).toBe("Profil ignorieren");
    expect(t("action.step.delete")).toBe("In den Papierkorb schieben");
    expect(t("options.tabs.start")).toBe("Erste Schritte");
    expect(t("placement.needs-review")).toBe("Zu prüfen");
    expect(t("templates.folder.general")).toBe("Allgemein");
    expect(t("quick.scope")).toContain("JoyFox");
  });
});

describe("message types", () => {
  it("refuses a wrong message at compile time", () => {
    const field = message("field.accountAgeDays");
    // @ts-expect-error: the params are missing.
    message("triage.reason.belowMinimum");
    message("triage.reason.belowMinimum", {
      field,
      value: 3,
      // @ts-expect-error: a misspelled param name.
      minimun: 5,
    });
    message("triage.reason.belowMinimum", {
      // @ts-expect-error: a string where a nested Message is required.
      field: "Account age",
      value: 3,
      minimum: 5,
    });
    const invalid: Message = {
      key: "triage.reason.belowMinimum",
      // @ts-expect-error: a key with params needs all of them.
      params: {},
    };
    // @ts-expect-error: a plain key takes no params.
    t("options.tabs.start", {});
    expect(isMessage(invalid)).toBe(false);
  });
});

describe("isMessage", () => {
  const valid = {
    key: "triage.reason.belowMinimum",
    params: { field: { key: "field.accountAgeDays" }, value: 3, minimum: 5 },
  };

  it("accepts valid and nested messages", () => {
    expect(isMessage({ key: "options.tabs.start" })).toBe(true);
    expect(isMessage(valid)).toBe(true);
    expect(
      isMessage({
        key: "triage.reason.numbered",
        params: {
          number: 2,
          reason: {
            key: "triage.reason.unknownMet",
            params: { reason: valid },
          },
        },
      }),
    ).toBe(true);
    expect(
      isMessage({ key: "legacy.text", params: { text: "options.tabs.start" } }),
    ).toBe(true);
  });

  it("refuses an unknown key, a missing or extra param and a wrong kind", () => {
    const refused: unknown[] = [
      undefined,
      "options.tabs.start",
      [],
      { key: "options.tabs.nothing" },
      { key: "toString" },
      { key: "options.tabs.start", params: {} },
      { key: "options.tabs.start", extra: 1 },
      { key: valid.key },
      { key: valid.key, params: { field: valid.params.field, value: 3 } },
      { key: valid.key, params: { ...valid.params, extra: 1 } },
      { key: valid.key, params: { ...valid.params, value: "3" } },
      { key: valid.key, params: { ...valid.params, value: Number.NaN } },
      { key: valid.key, params: { ...valid.params, field: "Account age" } },
      { key: valid.key, params: { ...valid.params, field: { key: "nope" } } },
      { key: "legacy.text", params: { text: 5 } },
    ];
    for (const value of refused)
      expect(isMessage(value), JSON.stringify(value)).toBe(false);
  });

  it("refuses nesting deeper than any catalog message", () => {
    let deep: unknown = { key: "options.tabs.start" };
    for (let depth = 0; depth < 20; depth += 1)
      deep = { key: "triage.reason.unknownMet", params: { reason: deep } };
    expect(isMessage(deep)).toBe(false);
  });
});

describe("translator", () => {
  it("translates nested params first, in the current language", () => {
    const reason = message("triage.reason.belowMinimum", {
      field: message("field.photoCount"),
      value: 1,
      minimum: 3,
    });
    expect(t(reason)).toBe("Photo count is 1, below the required 3.");
    setLocale("de");
    expect(t(reason)).toBe(
      "Anzahl der Fotos: 1. Das liegt unter dem geforderten Mindestwert 3.",
    );
    expect(
      t("triage.reason.userMoved", {
        placement: message("placement.quarantined"),
      }),
    ).toBe("Du hast diese Person nach „Quarantäne“ verschoben.");
  });

  it("keeps a string param literal, even when it equals a key", () => {
    setLocale("de");
    expect(t("legacy.text", { text: "options.tabs.start" })).toBe(
      "options.tabs.start",
    );
    expect(t("inbox.whyNamed", { name: "placement.qualified" })).toBe(
      "Warum: placement.qualified",
    );
  });

  it("shows the key of an invalid value, logs once and never throws", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const bad = { key: "triage.reason.userMoved", params: {} } as never;
    expect(t(bad)).toBe("triage.reason.userMoved");
    expect(t(bad)).toBe("triage.reason.userMoved");
    expect(t("Unknown text" as never)).toBe("Unknown text");
    expect(t(null as never)).toBe("?");
    expect(t({ params: {} } as never)).toBe("?");
    // Once per key: "?" was logged for the first value without one.
    expect(warn).toHaveBeenCalledTimes(3);
    warn.mockRestore();
  });

  it("formats dates and numbers for the language", () => {
    expect(formatDate("2026-09-25T23:30:00.000Z")).toBe("Sep 25, 2026");
    expect(formatNumber(1234)).toBe("1,234");
    setLocale("de");
    expect(formatDate("2026-09-25T23:30:00.000Z")).toBe("25.09.2026");
    expect(formatDate("2026-09-25")).toBe("25.09.2026");
    expect(formatNumber(1234)).toBe("1.234");
    expect(formatDate("not a date")).toBe("not a date");
  });

  it("tells listeners about a change, once per change", () => {
    const heard: string[] = [];
    const stop = onLocaleChange((locale) => heard.push(locale));
    setLocale("de");
    setLocale("de");
    setLocale("en");
    stop();
    setLocale("de");
    expect(heard).toEqual(["de", "en"]);
    expect(currentLocale()).toBe("de");
  });
});
