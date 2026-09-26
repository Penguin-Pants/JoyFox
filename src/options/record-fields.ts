import { isStrictIsoDate } from "../domain/iso-date";
import {
  formatDate,
  formatDateTime,
  formatExactNumber,
  t,
} from "../i18n/translator";

/**
 * Every stored date, by its path in a record (`src/domain/types.ts`): a
 * top-level field, or `steps[].at` in an ActionLog. Only these are shown as
 * dates. The same name elsewhere, such as an `at` inside a saved search's
 * free-form filters, and a note whose text looks like a date stay as stored.
 * A test keeps this list in step with the schema.
 */
export const DATE_PATHS: ReadonlySet<string> = new Set([
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
  "steps[].at",
  "updatedAt",
]);

/**
 * A date's value as a readable date, or undefined to show it as stored. The
 * check is strict: `Date.parse` alone repairs `2026-02-30` to 2 March, and the
 * inspector must never show a date other than the stored one. Other values of
 * a date field, such as "unknown", are shown as they are.
 */
function readableDate(path: string, value: string) {
  if (!DATE_PATHS.has(path) || !isStrictIsoDate(value)) return undefined;
  return value.includes("T") ? formatDateTime(value) : formatDate(value);
}

/** True when an object has no own field; stops at the first one it finds. */
function hasNoFields(value: object): boolean {
  for (const key in value) if (Object.hasOwn(value, key)) return false;
  return true;
}

function isEmpty(value: unknown): boolean {
  return (
    value === null ||
    value === "" ||
    (Array.isArray(value) && value.length === 0) ||
    (typeof value === "object" &&
      value !== null &&
      !Array.isArray(value) &&
      hasNoFields(value))
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

/**
 * The most characters shown of one text value. An imported free-form value
 * can hold a text of almost 50 MiB; past this length, a line says how many
 * more characters there are, and "Stored JSON" has the whole text.
 */
export const MAX_SHOWN_CHARACTERS = 1_000;

/** Characters (code points) from `start` to the end, counted without copying. */
function charactersFrom(text: string, start: number): number {
  let count = 0;
  for (let index = start; index < text.length; index += 1) {
    const unit = text.charCodeAt(index);
    // A low surrogate is the second half of a character already counted.
    if (unit < 0xdc00 || unit > 0xdfff) count += 1;
  }
  return count;
}

/** A text value, cut after MAX_SHOWN_CHARACTERS with a line saying so. */
function renderText(document: Document, text: string): HTMLElement {
  if (text.length <= MAX_SHOWN_CHARACTERS)
    return span(document, "joyfox-data__value--text", text);
  let end = MAX_SHOWN_CHARACTERS;
  // Never cut a character in half.
  const last = text.charCodeAt(end - 1);
  if (last >= 0xd800 && last <= 0xdbff) end -= 1;
  const node = span(document, "joyfox-data__value--text", text.slice(0, end));
  node.append(
    " ",
    span(
      document,
      "joyfox-data__value--more",
      t("data.moreCharacters", { count: charactersFrom(text, end) }),
    ),
  );
  return node;
}

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
  path: string,
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
    const date = readableDate(path, value);
    if (date !== undefined) {
      const time = document.createElement("time");
      time.className = "joyfox-data__value";
      time.dateTime = value;
      time.title = value;
      time.textContent = date;
      return time;
    }
    return renderText(document, value);
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
      entry.append(renderValue(document, item, budget, `${path}[]`));
      list.append(entry);
    }
    return list;
  }
  if (typeof value === "object" && value !== null)
    return fields(document, value as Record<string, unknown>, budget, path);
  // JSON has no other types; anything else is shown as its text.
  return span(document, "joyfox-data__value", String(value));
}

function fields(
  document: Document,
  record: Readonly<Record<string, unknown>>,
  budget: Budget,
  path = "",
): HTMLDListElement {
  const list = document.createElement("dl");
  list.className = "joyfox-data__fields";
  // Keys are read one at a time, with no entry array per field, so a very
  // wide imported object costs no more than a count past the budget.
  let omitted = 0;
  for (const key in record) {
    if (!Object.hasOwn(record, key)) continue;
    const value = record[key];
    // JSON drops undefined fields, so the export never has them either.
    if (value === undefined) continue;
    if (omitted > 0 || budget.left <= 0) {
      omitted += 1;
      continue;
    }
    const term = document.createElement("dt");
    const name = document.createElement("code");
    name.textContent = key;
    term.append(name);
    const description = document.createElement("dd");
    description.append(
      renderValue(document, value, budget, path ? `${path}.${key}` : key),
    );
    list.append(term, description);
  }
  if (omitted > 0) {
    const term = document.createElement("dt");
    term.textContent = "…";
    const description = document.createElement("dd");
    description.append(more(document, omitted));
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
