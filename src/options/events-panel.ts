import { AccountService } from "../accounts/account-service";
import type { EventMetadata } from "../domain/types";
import { EventTrackerService } from "../events/event-service";
import { kindOf, type Attendance } from "../events/listing";
import type { PlainKey } from "../i18n/catalog/en";
import { message } from "../i18n/message";
import { formatWallTime, t } from "../i18n/translator";

const ATTENDANCE_TEXT: Record<Attendance, PlainKey> = {
  unknown: "listing.attendance.unknown",
  interested: "listing.attendance.interested",
  attending: "listing.attendance.attending",
  "not-attending": "listing.attendance.not-attending",
  attended: "listing.attendance.attended",
};

function element<K extends keyof HTMLElementTagNameMap>(
  document: Document,
  tag: K,
  className: string,
  text?: string,
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  node.className = className;
  // Titles, notes and tags are user or page text and are always set as text.
  if (text !== undefined) node.textContent = text;
  return node;
}

/** Today in the user's own time zone, as `YYYY-MM-DD`. */
function today(now: Date): string {
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

type Filter = "all" | "note" | Attendance | `tag:${string}`;

function matches(
  record: EventMetadata,
  filter: Filter,
  search: string,
): boolean {
  if (filter === "note" && !record.note) return false;
  if (filter.startsWith("tag:")) {
    const key = filter.slice(4).toLowerCase();
    if (!record.tags.some((tag) => tag.toLowerCase() === key)) return false;
  } else if (
    filter !== "all" &&
    filter !== "note" &&
    record.attendance !== filter
  )
    return false;
  if (!search) return true;
  const haystack = [record.title, record.note, record.venueName, ...record.tags]
    .filter(Boolean)
    .join("\n")
    .toLowerCase();
  return haystack.includes(search.toLowerCase());
}

/**
 * V1-5: the personal calendar (PRD 9.1). Every tracked event of the active
 * account, in date order, with the same filter as JoyClub's event list plus
 * a text search, and the tracked venues. It reads only what JoyFox stored:
 * a past event stays listed after JoyClub removes it (PRD 6.3). Notes are
 * edited on the event or venue page itself.
 */
export class EventsPanel {
  #generation = 0;
  #accountId: string | undefined;
  #filter: Filter = "all";
  #search = "";

  constructor(
    private readonly root: HTMLElement,
    private readonly listings = new EventTrackerService(),
    private readonly accounts = new AccountService(),
    private readonly now: () => Date = () => new Date(),
  ) {}

  async render(): Promise<void> {
    const generation = (this.#generation += 1);
    let accountId: string | undefined;
    let records: EventMetadata[];
    try {
      accountId = (await this.accounts.getActiveAccount())?.id;
      records = accountId ? await this.listings.list(accountId) : [];
    } catch {
      if (generation === this.#generation)
        this.root.textContent = t("events.readFailed");
      return;
    }
    if (generation !== this.#generation) return;
    if (accountId !== this.#accountId) {
      // Another account's tag or search must never carry over.
      this.#filter = "all";
      this.#search = "";
    }
    this.#accountId = accountId;
    this.#draw(accountId, records);
  }

  #draw(accountId: string | undefined, records: EventMetadata[]): void {
    const document = this.root.ownerDocument;
    const focused = document.activeElement?.id;
    this.root.replaceChildren();
    const heading = element(
      document,
      "h2",
      "joyfox-panel__heading",
      t("events.heading"),
    );
    heading.id = "joyfox-events-heading";
    this.root.setAttribute("aria-labelledby", heading.id);
    this.root.append(
      heading,
      element(document, "p", "joyfox-panel__hint", t("events.hint")),
    );
    if (!accountId) {
      this.root.append(
        element(document, "p", "joyfox-panel__empty", t("events.noAccount")),
      );
      return;
    }
    const events = records.filter((record) => kindOf(record) === "event");
    const venues = records.filter((record) => kindOf(record) === "venue");
    const tags = [
      ...new Map(
        events
          .flatMap((record) => record.tags)
          .map((tag) => [tag.toLowerCase(), tag]),
      ).values(),
    ].sort((a, b) => a.localeCompare(b));
    if (
      this.#filter.startsWith("tag:") &&
      !tags.some(
        (tag) => tag.toLowerCase() === this.#filter.slice(4).toLowerCase(),
      )
    )
      this.#filter = "all";
    this.root.append(this.#controls(document, tags, accountId, records));
    const shown = events.filter((record) =>
      matches(record, this.#filter, this.#search),
    );
    this.root.append(
      element(
        document,
        "p",
        "joyfox-panel__hint",
        t(
          message("events.count", {
            shown: shown.length,
            total: events.length,
          }),
        ),
      ),
    );
    if (events.length === 0)
      this.root.append(
        element(document, "p", "joyfox-panel__empty", t("events.empty")),
      );
    else this.root.append(this.#eventList(document, shown));
    if (venues.length > 0) {
      this.root.append(element(document, "h3", "", t("events.venuesHeading")));
      this.root.append(this.#venueList(document, venues));
    }
    if (focused) document.getElementById(focused)?.focus();
  }

  #controls(
    document: Document,
    tags: string[],
    accountId: string,
    records: EventMetadata[],
  ): HTMLElement {
    const row = element(document, "div", "joyfox-events__filters");
    const filterLabel = element(document, "label", "", t("events.filterLabel"));
    const select = element(document, "select", "");
    select.id = "joyfox-events-filter";
    filterLabel.htmlFor = select.id;
    const option = (value: Filter, text: string) =>
      select.append(new Option(text, value, false, value === this.#filter));
    option("all", t("events.filter.all"));
    option("note", t("eventFilter.note"));
    for (const value of [
      "attending",
      "interested",
      "attended",
      "not-attending",
    ] as const)
      option(value, t(ATTENDANCE_TEXT[value]));
    for (const tag of tags)
      option(`tag:${tag}`, t(message("eventFilter.tag", { tag })));
    select.addEventListener("change", () => {
      this.#filter = select.value as Filter;
      this.#draw(accountId, records);
    });
    const searchLabel = element(document, "label", "", t("events.searchLabel"));
    const search = element(document, "input", "");
    search.type = "search";
    search.id = "joyfox-events-search";
    searchLabel.htmlFor = search.id;
    search.value = this.#search;
    search.addEventListener("input", () => {
      this.#search = search.value.trim();
      const start = search.selectionStart;
      this.#draw(accountId, records);
      const again = this.root.querySelector<HTMLInputElement>(
        "#joyfox-events-search",
      );
      again?.setSelectionRange(start, start);
    });
    row.append(filterLabel, select, searchLabel, search);
    return row;
  }

  #eventList(document: Document, events: EventMetadata[]): HTMLElement {
    const list = element(document, "ol", "joyfox-events__list");
    const day = today(this.now());
    for (const record of events) {
      const item = element(document, "li", "joyfox-events__item");
      const when = record.startLocal
        ? formatWallTime(record.startLocal)
        : t("events.noDate");
      const past =
        record.startLocal !== undefined && record.startLocal.slice(0, 10) < day;
      item.append(
        element(
          document,
          "strong",
          "",
          record.title ?? t(message("events.untitled", { id: record.eventId })),
        ),
        element(
          document,
          "span",
          "joyfox-events__when",
          past ? t(message("events.past", { when })) : when,
        ),
      );
      if (record.venueName)
        item.append(
          element(
            document,
            "span",
            "",
            t(message("events.venue", { venue: record.venueName })),
          ),
        );
      const details = [t(ATTENDANCE_TEXT[record.attendance])];
      if (record.tags.length > 0) details.push(record.tags.join(", "));
      item.append(
        element(
          document,
          "span",
          "joyfox-events__details",
          details.join(" · "),
        ),
      );
      if (record.note)
        item.append(element(document, "p", "joyfox-events__note", record.note));
      list.append(item);
    }
    return list;
  }

  #venueList(document: Document, venues: EventMetadata[]): HTMLElement {
    const list = element(document, "ul", "joyfox-events__list");
    for (const record of [...venues].sort((a, b) =>
      (a.title ?? "").localeCompare(b.title ?? ""),
    )) {
      const item = element(document, "li", "joyfox-events__item");
      item.append(
        element(
          document,
          "strong",
          "",
          record.title ?? t(message("events.untitled", { id: record.eventId })),
        ),
      );
      if (record.tags.length > 0)
        item.append(
          element(
            document,
            "span",
            "joyfox-events__details",
            record.tags.join(", "),
          ),
        );
      if (record.note)
        item.append(element(document, "p", "joyfox-events__note", record.note));
      list.append(item);
    }
    return list;
  }
}
