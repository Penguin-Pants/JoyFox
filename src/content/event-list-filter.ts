import { message, type Message } from "../i18n/message";
import { t } from "../i18n/translator";
import type { ListingSummary } from "../messaging/protocol";
import { verifiedSelector } from "../selectors/registry";
import {
  ATTENDANCE_TEXT,
  type ListingClient,
  type ListingListAnswer,
} from "./listing-panel";
import { element, UI_ATTRIBUTE } from "./triage-ui";

/** Set on JoyClub's list while a filter is on; CSS hides what does not match. */
export const FILTER_ATTRIBUTE = "data-joyfox-event-filter";
/** Set on each list item: `yes` when it matches the chosen filter. */
export const MATCH_ATTRIBUTE = "data-joyfox-event-match";
const BADGE = "joyfox-event-badge";

type Filter =
  | { kind: "all" }
  | { kind: "tracked" }
  | { kind: "note" }
  | { kind: "attendance"; value: "interested" | "attending" }
  | { kind: "tag"; tag: string };

function matches(filter: Filter, listing: ListingSummary | undefined): boolean {
  if (filter.kind === "all") return true;
  if (!listing) return false;
  switch (filter.kind) {
    case "tracked":
      return true;
    case "note":
      return Boolean(listing.note);
    case "attendance":
      return listing.attendance === filter.value;
    case "tag": {
      const key = filter.tag.toLowerCase();
      return listing.tags.some((tag) => tag.toLowerCase() === key);
    }
  }
}

const encode = (filter: Filter) =>
  filter.kind === "attendance"
    ? `attendance:${filter.value}`
    : filter.kind === "tag"
      ? `tag:${filter.tag}`
      : filter.kind;

function decode(value: string): Filter {
  if (value === "tracked" || value === "note") return { kind: value };
  if (value === "attendance:interested" || value === "attendance:attending")
    return {
      kind: "attendance",
      value: value.slice("attendance:".length) as "interested" | "attending",
    };
  if (value.startsWith("tag:")) return { kind: "tag", tag: value.slice(4) };
  return { kind: "all" };
}

/**
 * V1-5: a filter for JoyClub's already-loaded event list by the user's own
 * notes, tags and attendance (PRD 9.1, 10.1), and a small badge on each
 * tracked event. It hides and shows the items JoyClub already loaded; it
 * never loads more, sends nothing and asks JoyClub for nothing. Items
 * JoyClub adds while scrolling are checked as they appear.
 */
export class EventListFilter {
  #bar?: HTMLElement;
  #list?: Element;
  #count?: HTMLElement;
  #data?: ListingListAnswer;
  #error?: Message;
  #filter: Filter = { kind: "all" };
  #session = 0;
  #loadSequence = 0;

  constructor(
    private readonly document: Document,
    private readonly client: ListingClient,
  ) {}

  update(): void {
    const selector = verifiedSelector("event-calendar", "list");
    const list = selector ? this.document.querySelector(selector) : null;
    if (!list) return this.leave();
    if (list !== this.#list) {
      this.#unmark();
      this.#list = list;
    }
    if (!this.#bar) {
      this.#bar = element(
        this.document,
        "div",
        "joyfox-panel joyfox-event-filter",
      );
      this.#bar.setAttribute(UI_ATTRIBUTE, "event-filter");
      this.#draw();
      void this.#load();
    }
    if (!this.#bar.isConnected || this.#bar.nextElementSibling !== list)
      list.before(this.#bar);
    this.#apply();
  }

  leave(): void {
    this.#session += 1;
    this.#unmark();
    this.#bar?.remove();
    this.#bar = undefined;
    this.#list = undefined;
    this.#count = undefined;
    this.#data = undefined;
    this.#error = undefined;
    this.#filter = { kind: "all" };
  }

  /** Another account's notes must never stay on screen after a switch. */
  accountChanged(): void {
    this.#session += 1;
    if (!this.#bar) return;
    this.#data = undefined;
    this.#filter = { kind: "all" };
    this.#draw();
    this.#apply();
    void this.#load();
  }

  invalidate(): void {
    if (this.#bar) void this.#load();
  }

  localeChanged(): void {
    if (!this.#bar) return;
    this.#draw();
    this.#apply(true);
  }

  async #load(): Promise<void> {
    const session = this.#session;
    const sequence = (this.#loadSequence += 1);
    const current = () =>
      session === this.#session && sequence === this.#loadSequence;
    let answer: ListingListAnswer;
    try {
      answer = await this.client.list();
    } catch {
      if (!current()) return;
      this.#error = message("eventFilter.readFailed");
      this.#draw();
      return;
    }
    if (!current()) return;
    this.#data = answer;
    this.#error = undefined;
    // A tag no longer in use cannot stay chosen.
    if (this.#filter.kind === "tag" && !this.#tags().includes(this.#filter.tag))
      this.#filter = { kind: "all" };
    this.#draw();
    this.#apply(true);
  }

  #events(): Map<string, ListingSummary> {
    return new Map(
      (this.#data?.listings ?? [])
        .filter((listing) => listing.kind === "event")
        .map((listing) => [listing.eventId, listing]),
    );
  }

  #tags(): string[] {
    const seen = new Map<string, string>();
    for (const listing of this.#data?.listings ?? [])
      if (listing.kind === "event")
        for (const tag of listing.tags)
          if (!seen.has(tag.toLowerCase())) seen.set(tag.toLowerCase(), tag);
    return [...seen.values()].sort((a, b) => a.localeCompare(b));
  }

  #draw(): void {
    const bar = this.#bar;
    if (!bar) return;
    const document = this.document;
    bar.replaceChildren();
    const label = element(
      document,
      "label",
      "joyfox-event-filter__label",
      t("eventFilter.label"),
    );
    const select = element(document, "select", "joyfox-event-filter__select");
    select.id = "joyfox-event-filter";
    label.htmlFor = select.id;
    const option = (value: string, text: string) =>
      select.append(
        new Option(text, value, false, value === encode(this.#filter)),
      );
    option("all", t("eventFilter.all"));
    if (this.#data?.accountId) {
      option("tracked", t("eventFilter.tracked"));
      option("note", t("eventFilter.note"));
      option("attendance:attending", t("eventFilter.attending"));
      option("attendance:interested", t("eventFilter.interested"));
      for (const tag of this.#tags())
        option(`tag:${tag}`, t(message("eventFilter.tag", { tag })));
    }
    select.disabled = !this.#data?.accountId;
    select.addEventListener("change", () => {
      this.#filter = decode(select.value);
      this.#apply();
    });
    const count = element(document, "span", "joyfox-event-filter__count");
    count.setAttribute("role", "status");
    count.setAttribute("aria-live", "polite");
    bar.append(label, select, count);
    if (this.#error)
      bar.append(element(document, "p", "joyfox-error", t(this.#error)));
    else if (this.#data && !this.#data.accountId)
      bar.append(
        element(document, "p", "joyfox-note", t("eventFilter.noAccount")),
      );
    this.#count = count;
  }

  /**
   * Mark every loaded item and show or hide it; badge tracked events.
   * `redrawBadges` also rewrites badges already placed (new data or
   * language).
   */
  #apply(redrawBadges = false): void {
    const list = this.#list;
    if (!list) return;
    const itemSelector = verifiedSelector("event-calendar", "item");
    const eventSelector = verifiedSelector("event-calendar", "eventItem");
    if (!itemSelector || !eventSelector) return;
    const events = this.#events();
    const filtering = this.#filter.kind !== "all";
    let shown = 0;
    let loaded = 0;
    for (const item of Array.from(list.querySelectorAll(itemSelector))) {
      const isEvent = item.matches(eventSelector);
      const id = isEvent ? (item.getAttribute("data-element-id") ?? "") : "";
      const listing = isEvent ? events.get(id) : undefined;
      if (isEvent) loaded += 1;
      const match = isEvent && matches(this.#filter, listing);
      if (match && isEvent) shown += 1;
      item.setAttribute(MATCH_ATTRIBUTE, match ? "yes" : "no");
      this.#badge(item, listing, redrawBadges);
    }
    if (filtering) list.setAttribute(FILTER_ATTRIBUTE, "on");
    else list.removeAttribute(FILTER_ATTRIBUTE);
    if (this.#count)
      this.#count.textContent = filtering
        ? t(message("eventFilter.count", { shown, loaded }))
        : "";
  }

  #badge(
    item: Element,
    listing: ListingSummary | undefined,
    redraw: boolean,
  ): void {
    const existing = item.querySelector(`.${BADGE}`);
    if (!listing) return existing?.remove();
    if (
      existing &&
      !redraw &&
      existing.getAttribute("data-joyfox-version") === listing.updatedAt
    )
      return;
    const parts = [t("eventFilter.badge")];
    if (listing.attendance !== "unknown")
      parts.push(t(ATTENDANCE_TEXT[listing.attendance]));
    if (listing.tags.length > 0) parts.push(listing.tags.join(", "));
    if (listing.note) parts.push(t("eventFilter.hasNote"));
    const badge = element(
      this.document,
      "span",
      `joyfox-badge ${BADGE}`,
      parts.join(" · "),
    );
    badge.setAttribute(UI_ATTRIBUTE, "event-badge");
    badge.setAttribute("data-joyfox-version", listing.updatedAt);
    if (existing) return existing.replaceWith(badge);
    const headlineSelector = verifiedSelector("event-calendar", "headline");
    const headline = headlineSelector
      ? item.querySelector(headlineSelector)
      : null;
    (headline ?? item).append(badge);
  }

  #unmark(): void {
    const list = this.#list;
    if (!list) return;
    list.removeAttribute(FILTER_ATTRIBUTE);
    for (const item of Array.from(
      list.querySelectorAll(`[${MATCH_ATTRIBUTE}]`),
    ))
      item.removeAttribute(MATCH_ATTRIBUTE);
    for (const badge of Array.from(list.querySelectorAll(`.${BADGE}`)))
      badge.remove();
  }
}
