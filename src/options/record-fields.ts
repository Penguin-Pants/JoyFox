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
  "sentAt",
  "steps[].at",
  "updatedAt",
]);

/** Every path that leads to a date: `steps`, `steps[]` and the dates. */
const DATE_PATH_STEPS: ReadonlySet<string> = new Set(
  [...DATE_PATHS].flatMap((path) => {
    const steps = [path];
    for (let index = 0; index < path.length; index += 1)
      if (path[index] === "." || path.startsWith("[]", index))
        steps.push(path.slice(0, index));
    return steps;
  }),
);

/** The longest name in any date path; a longer name can never lead to one. */
const LONGEST_DATE_STEP = Math.max(
  ...[...DATE_PATH_STEPS].map((step) => step.length),
);

/**
 * A child's path, or undefined once it cannot lead to a date. Paths are built
 * only along the schema's date paths, and never from a name longer than any
 * date path's, so a field inside a free-form value costs no path at all.
 */
function childPath(
  parent: string | undefined,
  name: string,
  separator = ".",
): string | undefined {
  if (parent === undefined || name.length > LONGEST_DATE_STEP) return undefined;
  const path = parent === "" ? name : `${parent}${separator}${name}`;
  return DATE_PATH_STEPS.has(path) ? path : undefined;
}

/**
 * A date's value as a readable date, or undefined to show it as stored. The
 * check is strict: `Date.parse` alone repairs `2026-02-30` to 2 March, and the
 * inspector must never show a date other than the stored one. Other values of
 * a date field, such as "unknown", are shown as they are.
 */
function readableDate(path: string | undefined, value: string) {
  if (path === undefined || !DATE_PATHS.has(path) || !isStrictIsoDate(value))
    return undefined;
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

/**
 * A text cut after MAX_SHOWN_CHARACTERS, never inside a character, and how
 * many UTF-16 units were left out. The count takes no time however long the
 * text is; it is exact for letters and digits, and counts an emoji as 2.
 */
function cut(text: string): { shown: string; omitted: number } {
  if (text.length <= MAX_SHOWN_CHARACTERS) return { shown: text, omitted: 0 };
  let end = MAX_SHOWN_CHARACTERS;
  const last = text.charCodeAt(end - 1);
  if (last >= 0xd800 && last <= 0xdbff) end -= 1;
  return { shown: text.slice(0, end), omitted: text.length - end };
}

function moreCharacters(document: Document, count: number): HTMLElement {
  return span(
    document,
    "joyfox-data__value--more",
    t("data.moreCharacters", { count }),
  );
}

/** A text value, cut after MAX_SHOWN_CHARACTERS with a line saying so. */
function renderText(document: Document, text: string): HTMLElement {
  const { shown, omitted } = cut(text);
  const node = span(document, "joyfox-data__value--text", shown);
  if (omitted > 0) node.append(" ", moreCharacters(document, omitted));
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
  path: string | undefined,
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
      entry.append(
        renderValue(document, item, budget, childPath(path, "[]", "")),
      );
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
  path: string | undefined,
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
    // A free-form value can have a field name of any length; it is cut
    // like a text value.
    const shownKey = cut(key);
    const name = document.createElement("code");
    name.textContent = shownKey.shown;
    term.append(name);
    if (shownKey.omitted > 0)
      term.append(" ", moreCharacters(document, shownKey.omitted));
    const description = document.createElement("dd");
    description.append(
      renderValue(document, value, budget, childPath(path, key)),
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
  return fields(document, record, { left: MAX_SHOWN_VALUES }, "");
}
