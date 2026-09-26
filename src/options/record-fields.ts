import { isStrictIsoDate } from "../domain/iso-date";
import {
  formatDate,
  formatDateTime,
  formatExactNumber,
  t,
} from "../i18n/translator";

/**
 * Every stored field that holds a date, by name (`src/domain/types.ts`).
 * Only these are shown as dates, so a note whose text looks like a date stays
 * text. A test keeps this list in step with the schema.
 */
export const DATE_FIELDS: ReadonlySet<string> = new Set([
  "at",
  "capturedAt",
  "createdAt",
  "decidedAt",
  "joinedAt",
  "joinedEarliest",
  "joinedLatest",
  "lastSyncedAt",
  "matchedAt",
  "observedAt",
  "occurredAt",
  "updatedAt",
]);

/**
 * A date field's value as a readable date, or undefined to show it as stored.
 * The check is strict: `Date.parse` alone repairs `2026-02-30` to 2 March,
 * and the inspector must never show a date other than the stored one. Other
 * values of a date field, such as "unknown", are shown as they are.
 */
function readableDate(key: string | undefined, value: string) {
  if (key === undefined || !DATE_FIELDS.has(key) || !isStrictIsoDate(value))
    return undefined;
  return value.includes("T") ? formatDateTime(value) : formatDate(value);
}

function isEmpty(value: unknown): boolean {
  return (
    value === null ||
    value === "" ||
    (Array.isArray(value) && value.length === 0) ||
    (typeof value === "object" &&
      value !== null &&
      !Array.isArray(value) &&
      Object.keys(value).length === 0)
  );
}

function span(document: Document, className: string, text: string) {
  const node = document.createElement("span");
  node.className = className;
  // Stored values are user input or page-derived and are always set as text.
  node.textContent = text;
  return node;
}

/**
 * The most values drawn for one record. An imported record can hold a list of
 * any length (imports allow up to 50 MiB), and drawing every item would freeze
 * the options page. Past the limit, a line says how many more there are; the
 * full record is always in "Stored JSON".
 */
export const MAX_SHOWN_VALUES = 200;

interface Budget {
  left: number;
}

function more(document: Document, count: number): HTMLElement {
  return span(
    document,
    "joyfox-data__value--more",
    t("data.moreValues", { count }),
  );
}

/**
 * One stored value, readable: numbers and dates in the UI language, yes or no
 * for booleans, lists as lists and objects as nested fields. Field names are
 * the stored keys, never translated (i18n spec: export JSON keys stay as they
 * are), so what the user reads matches the exported file.
 */
function renderValue(
  document: Document,
  value: unknown,
  budget: Budget,
  key?: string,
): HTMLElement {
  budget.left -= 1;
  if (isEmpty(value))
    return span(document, "joyfox-data__value--empty", t("data.valueEmpty"));
  if (typeof value === "boolean")
    return span(
      document,
      "joyfox-data__value",
      t(value ? "data.valueYes" : "data.valueNo"),
    );
  if (typeof value === "number")
    return span(document, "joyfox-data__value", formatExactNumber(value));
  if (typeof value === "string") {
    const date = readableDate(key, value);
    if (date !== undefined) {
      const time = document.createElement("time");
      time.className = "joyfox-data__value";
      time.dateTime = value;
      time.title = value;
      time.textContent = date;
      return time;
    }
    return span(document, "joyfox-data__value--text", value);
  }
  if (Array.isArray(value)) {
    const list = document.createElement("ul");
    list.className = "joyfox-data__list";
    for (const [index, item] of value.entries()) {
      const entry = document.createElement("li");
      if (budget.left <= 0) {
        entry.append(more(document, value.length - index));
        list.append(entry);
        break;
      }
      entry.append(renderValue(document, item, budget));
      list.append(entry);
    }
    return list;
  }
  if (typeof value === "object" && value !== null)
    return fields(document, value as Record<string, unknown>, budget);
  // JSON has no other types; anything else is shown as its text.
  return span(document, "joyfox-data__value", String(value));
}

function fields(
  document: Document,
  record: Readonly<Record<string, unknown>>,
  budget: Budget,
): HTMLDListElement {
  const list = document.createElement("dl");
  list.className = "joyfox-data__fields";
  // JSON drops undefined fields, so the export never has them either.
  const entries = Object.entries(record).filter(
    ([, value]) => value !== undefined,
  );
  for (const [index, [key, value]] of entries.entries()) {
    const term = document.createElement("dt");
    const description = document.createElement("dd");
    if (budget.left <= 0) {
      term.textContent = "…";
      description.append(more(document, entries.length - index));
      list.append(term, description);
      break;
    }
    const name = document.createElement("code");
    name.textContent = key;
    term.append(name);
    description.append(renderValue(document, value, budget, key));
    list.append(term, description);
  }
  return list;
}

/**
 * A stored record as a list of its fields (V1-7, PRD 13.5): each field name
 * with its value, so the user can read a record without reading JSON. Fields
 * are shown in stored order, up to MAX_SHOWN_VALUES values.
 */
export function renderFields(
  document: Document,
  record: Readonly<Record<string, unknown>>,
): HTMLDListElement {
  return fields(document, record, { left: MAX_SHOWN_VALUES });
}
