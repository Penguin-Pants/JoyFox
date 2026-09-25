import type { SettingsArea } from "../storage/local-settings";

/** The UI languages JoyFox ships (docs/i18n-spec.md). */
export type Locale = "en" | "de";

export const LOCALES: readonly Locale[] = ["en", "de"];

/**
 * The `storage.local` key for the language the user picked. It is global,
 * not per account, and JoyFox writes it only when the user picks a language.
 * Until then the language follows Firefox.
 */
export const LOCALE_KEY = "joyfox.locale";

export const isLocale = (value: unknown): value is Locale =>
  value === "en" || value === "de";

/** "de", "de-DE", "de-AT", "de-CH" give "de". Everything else gives "en". */
export function resolveDefaultLocale(uiLanguage: string): Locale {
  return /^de(?:[-_]|$)/iu.test(uiLanguage.trim()) ? "de" : "en";
}

/**
 * Firefox's UI language, or "" where the `i18n` API is absent (tests). The
 * API needs no permission.
 */
export function firefoxLanguage(): string {
  try {
    const api = (
      globalThis as { browser?: { i18n?: { getUILanguage?: () => string } } }
    ).browser?.i18n;
    return api?.getUILanguage?.() ?? "";
  } catch {
    return "";
  }
}

/** The language for a stored value: the value if valid, else the default. */
export function localeFromSetting(
  value: unknown,
  uiLanguage: () => string = firefoxLanguage,
): Locale {
  return isLocale(value) ? value : resolveDefaultLocale(uiLanguage());
}

/** The stored value if valid, else resolveDefaultLocale(getUILanguage()). */
export async function readLocale(
  area: SettingsArea,
  uiLanguage: () => string = firefoxLanguage,
): Promise<Locale> {
  let stored: unknown;
  try {
    stored = (await area.get([LOCALE_KEY]))[LOCALE_KEY];
  } catch {
    // An unreadable setting must not keep the page from showing: the
    // default applies, as for a fresh install.
    stored = undefined;
  }
  return localeFromSetting(stored, uiLanguage);
}
