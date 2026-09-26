import { formatDateTime, formatNumber, t } from "../i18n/translator";

/** An ISO 8601 timestamp, as JoyFox stores every date. */
const ISO_TIMESTAMP = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/;

/**
 * Stored date fields all end in "At" (`createdAt`, `capturedAt`, `joinedAt`
 * and so on). Only those are shown as dates, so a note whose text looks like a
 * date stays text. Other values of a date field, such as "unknown", are shown
 * as is.
 */
function isTimestamp(key: string | undefined, value: string): boolean {
  return (
    key !== undefined &&
    key.endsWith("At") &&
    ISO_TIMESTAMP.test(value) &&
    Number.isFinite(Date.parse(value))
  );
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
 * One stored value, readable: numbers and dates in the UI language, yes or no
 * for booleans, lists as lists and objects as nested fields. Field names are
 * the stored keys, never translated (i18n spec: export JSON keys stay as they
 * are), so what the user reads matches the exported file.
 */
function renderValue(
  document: Document,
  value: unknown,
  key?: string,
): HTMLElement {
  if (isEmpty(value))
    return span(document, "joyfox-data__value--empty", t("data.valueEmpty"));
  if (typeof value === "boolean")
    return span(
      document,
      "joyfox-data__value",
      t(value ? "data.valueYes" : "data.valueNo"),
    );
  if (typeof value === "number")
    return span(document, "joyfox-data__value", formatNumber(value));
  if (typeof value === "string") {
    if (isTimestamp(key, value)) {
      const time = document.createElement("time");
      time.className = "joyfox-data__value";
      time.dateTime = value;
      time.title = value;
      time.textContent = formatDateTime(value);
      return time;
    }
    return span(document, "joyfox-data__value--text", value);
  }
  if (Array.isArray(value)) {
    const list = document.createElement("ul");
    list.className = "joyfox-data__list";
    for (const item of value) {
      const entry = document.createElement("li");
      entry.append(renderValue(document, item));
      list.append(entry);
    }
    return list;
  }
  if (typeof value === "object" && value !== null)
    return renderFields(document, value as Record<string, unknown>);
  // JSON has no other types; anything else is shown as its text.
  return span(document, "joyfox-data__value", String(value));
}

/**
 * A stored record as a list of its fields (V1-7, PRD 13.5): each field name
 * with its value, so the user can read a record without reading JSON. Every
 * field of the record is shown, in stored order.
 */
export function renderFields(
  document: Document,
  record: Readonly<Record<string, unknown>>,
): HTMLDListElement {
  const list = document.createElement("dl");
  list.className = "joyfox-data__fields";
  for (const [key, value] of Object.entries(record)) {
    // JSON drops undefined fields, so the export never has them either.
    if (value === undefined) continue;
    const term = document.createElement("dt");
    const name = document.createElement("code");
    name.textContent = key;
    term.append(name);
    const description = document.createElement("dd");
    description.append(renderValue(document, value, key));
    list.append(term, description);
  }
  return list;
}
