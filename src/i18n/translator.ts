import { isExtensionError, type ExtensionErrorCode } from "../errors";
import { de } from "./catalog/de";
import {
  en,
  type ArgsOf,
  type Catalog,
  type Format,
  type MessageKey,
} from "./catalog/en";
import type { Locale } from "./locale";
import {
  isMessage,
  message as build,
  paramsOf,
  type Message,
  type WireParams,
} from "./message";

const CATALOGS: Record<Locale, Catalog> = { en, de };

/** The `Intl` locale tags, for dates and numbers. */
const TAGS: Record<Locale, string> = { en: "en-US", de: "de-DE" };

let locale: Locale = "en";
const listeners = new Set<(locale: Locale) => void>();

export function currentLocale(): Locale {
  return locale;
}

/**
 * Switch the language of every text drawn from now on, and tell each
 * listener, so open panels draw again. The options page and the content
 * script call it from their `storage.onChanged` listener.
 */
export function setLocale(next: Locale): void {
  if (next === locale) return;
  locale = next;
  for (const listener of Array.from(listeners)) listener(next);
}

/** Called after each language change. Returns the unsubscribe function. */
export function onLocaleChange(listener: (locale: Locale) => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

const numberFormats = new Map<Locale, Intl.NumberFormat>();
const dateFormats = new Map<Locale, Intl.DateTimeFormat>();
const dateTimeFormats = new Map<Locale, Intl.DateTimeFormat>();
const pluralRules = new Map<Locale, Intl.PluralRules>();
const wallDateFormats = new Map<Locale, Intl.DateTimeFormat>();
const wallDateTimeFormats = new Map<Locale, Intl.DateTimeFormat>();

function cached<V>(map: Map<Locale, V>, make: (tag: string) => V): V {
  let value = map.get(locale);
  if (!value) {
    value = make(TAGS[locale]);
    map.set(locale, value);
  }
  return value;
}

/** de: 1.234, en: 1,234 */
export function formatNumber(value: number): string {
  return cached(numberFormats, (tag) => new Intl.NumberFormat(tag)).format(
    value,
  );
}

/**
 * A stored number with every digit kept: de 50,123456, en 50.123456. It uses
 * the digits of the number's shortest exact text, so no rounding applies (the
 * default keeps only three decimals) and binary noise never shows. Intl only
 * supplies the grouping and the decimal sign, with default options, so this
 * needs no newer Intl feature. A number that JavaScript writes with an
 * exponent (below 10^-6 or from 10^21) keeps it: 1E-200.
 */
export function formatExactNumber(value: number): string {
  const text = String(value);
  const parts = /^(-?)(\d+)(?:\.(\d+))?(?:e([+-]\d+))?$/u.exec(text);
  if (!parts) return text;
  const [, sign, whole, fraction, exponent] = parts;
  const format = cached(numberFormats, (tag) => new Intl.NumberFormat(tag));
  const decimal =
    format.formatToParts(1.5).find((part) => part.type === "decimal")?.value ??
    ".";
  return (
    sign +
    format.format(BigInt(whole!)) +
    (fraction ? decimal + fraction : "") +
    (exponent ? `E${Number(exponent)}` : "")
  );
}

/**
 * de: 25.09.2026, en: Sep 25, 2026. The date is the UTC calendar date, the
 * same day an ISO timestamp names, so a record never shows a day earlier
 * or later than the one stored. A value that is not a date is shown as is.
 */
export function formatDate(iso: string): string {
  const time = Date.parse(iso);
  if (!Number.isFinite(time)) return iso;
  return cached(
    dateFormats,
    (tag) =>
      new Intl.DateTimeFormat(tag, { dateStyle: "medium", timeZone: "UTC" }),
  ).format(time);
}

/**
 * de: 25. Sept. 2026, 20:03 UTC, en: Sep 25, 2026, 08:03 PM UTC. The time is
 * shown in UTC, as stored, and says so. A value that is not a date is shown
 * as is.
 */
export function formatDateTime(iso: string): string {
  const time = Date.parse(iso);
  if (!Number.isFinite(time)) return iso;
  return cached(
    dateTimeFormats,
    (tag) =>
      new Intl.DateTimeFormat(tag, {
        year: "numeric",
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        timeZone: "UTC",
        timeZoneName: "short",
      }),
  ).format(time);
}

/**
 * An event's start in its own local time (`YYYY-MM-DD` or
 * `YYYY-MM-DDTHH:mm`, as JoyClub shows it), with the weekday and no time
 * zone: de Sa., 27. Sept. 2026, 21:00; en Sat, Sep 27, 2026, 09:00 PM. Any
 * other value is shown as it is.
 */
export function formatWallTime(local: string): string {
  const parts = /^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2}))?$/u.exec(local);
  if (!parts) return local;
  const [, year, month, day, hour, minute] = parts;
  const time = Date.UTC(
    Number(year),
    Number(month) - 1,
    Number(day),
    Number(hour ?? 0),
    Number(minute ?? 0),
  );
  const withTime = hour !== undefined;
  return cached(withTime ? wallDateTimeFormats : wallDateFormats, (tag) =>
    withTime
      ? new Intl.DateTimeFormat(tag, {
          weekday: "short",
          year: "numeric",
          month: "short",
          day: "numeric",
          hour: "2-digit",
          minute: "2-digit",
          timeZone: "UTC",
        })
      : new Intl.DateTimeFormat(tag, {
          weekday: "short",
          year: "numeric",
          month: "short",
          day: "numeric",
          timeZone: "UTC",
        }),
  ).format(time);
}

const format: Format = {
  number: formatNumber,
  plural(value, forms) {
    return cached(pluralRules, (tag) => new Intl.PluralRules(tag)).select(
      value,
    ) === "one"
      ? forms.one
      : forms.other;
  },
};

/** Keys already reported as invalid, so each is logged once. */
const reported = new Set<string>();

function fallback(value: unknown): string {
  const key =
    typeof value === "object" &&
    value !== null &&
    typeof (value as { key?: unknown }).key === "string"
      ? (value as { key: string }).key
      : "?";
  if (!reported.has(key)) {
    reported.add(key);
    console.warn(`JoyFox: cannot show message "${key}"`);
  }
  return key;
}

function render(message: Message): string {
  const entry = CATALOGS[locale][message.key] as
    | string
    | ((params: Record<string, unknown>, f: Format) => string);
  if (typeof entry === "string") return entry;
  const spec = paramsOf(message.key) ?? {};
  const given = (message as { params: Record<string, unknown> }).params;
  const params: Record<string, unknown> = {};
  // A nested message is translated first. A string or number param is
  // passed on as is: a string is always literal, never looked up.
  for (const [name, kind] of Object.entries(spec))
    params[name] =
      kind === "message" ? render(given[name] as Message) : given[name];
  return entry(params, format);
}

/**
 * The text of a message, or of a key and its params, in the current
 * language. A value that is not a valid message (an old or damaged record)
 * shows its key, or "?" if it has none, and is logged once. It never throws.
 */
export function t(message: Message): string;
export function t<K extends MessageKey>(
  key: K,
  ...params: ArgsOf<K> extends undefined ? [] : [WireParams<ArgsOf<K>>]
): string;
export function t(first: Message | MessageKey, ...rest: unknown[]): string {
  const value: unknown =
    typeof first === "string"
      ? rest.length > 0
        ? { key: first, params: rest[0] }
        : { key: first }
      : first;
  if (!isMessage(value)) return fallback(value);
  return render(value);
}

/** The per-code text for an error that carries no display message. */
export const ERROR_CODE_KEY: Record<ExtensionErrorCode, MessageKey> = {
  SelectorUnavailable: "error.code.SelectorUnavailable",
  ExtractionInvalid: "error.code.ExtractionInvalid",
  IdentityMismatch: "error.code.IdentityMismatch",
  StorageError: "error.code.StorageError",
  RuleEvaluationError: "error.code.RuleEvaluationError",
  ActionStepFailed: "error.code.ActionStepFailed",
  NavigationTimeout: "error.code.NavigationTimeout",
  UnsupportedPage: "error.code.UnsupportedPage",
};

/**
 * What the UI shows for an `ExtensionError`: its display message, or the
 * fallback for its code. Never its English `message`, which is for logs.
 * `undefined` for any other value.
 */
export function errorDisplay(error: unknown): Message | undefined {
  if (!isExtensionError(error)) return undefined;
  return error.display ?? ({ key: ERROR_CODE_KEY[error.code] } as Message);
}

export { build as message };
