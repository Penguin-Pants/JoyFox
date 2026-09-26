// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  EventListFilter,
  FILTER_ATTRIBUTE,
  MATCH_ATTRIBUTE,
} from "../../src/content/event-list-filter";
import {
  ListingPanel,
  type ListingClient,
  type ListingGetAnswer,
  type ListingListAnswer,
} from "../../src/content/listing-panel";
import { detectPage } from "../../src/content/page-detector";
import type { ListingSummary } from "../../src/messaging/protocol";

// Shapes from docs/live-evidence/14-events.md and 15-venues.md, invented values.
const EVENT_PAGE = `
  <div class="event_name_and_type"><h1 class="event_name">Synthetic party</h1></div>
  <div class="event_info_box">
    <span class="event-time">Samstag, 27. September 2026 - ab 21:00</span>
    <div class="event_location_detail"><a class="event_club" href="/club/123.synthetic-club.html">Synthetic club</a></div>
  </div>
  <div class="event_registration_box"></div>`;
const VENUE_PAGE = `<h1 class="profile_name">Synthetic club</h1>`;
const LIST_PAGE = `
  <div id="cfull"><div class="card-list-ui">
    <div class="card-list-ui-list-item event-card-ui" data-element-id="1111111">
      <div class="card-ui-detail-right-headline"><a href="/event/1111111.a.html"><div class="headline">A</div></a></div>
    </div>
    <div class="card-list-ui-list-item date-card-ui"></div>
    <div class="card-list-ui-list-item event-card-ui" data-element-id="2222222">
      <div class="card-ui-detail-right-headline"><a href="/event/2222222.b.html"><div class="headline">B</div></a></div>
    </div>
  </div></div>`;

const listing = (overrides: Partial<ListingSummary> = {}): ListingSummary => ({
  kind: "event",
  eventId: "1234567",
  tags: [],
  attendance: "unknown",
  updatedAt: "2026-09-26T10:00:00.000Z",
  ...overrides,
});

let getAnswer: ListingGetAnswer;
let listAnswer: ListingListAnswer;
let client: ListingClient & {
  get: ReturnType<typeof vi.fn>;
  list: ReturnType<typeof vi.fn>;
  save: ReturnType<typeof vi.fn>;
};
const flush = () => new Promise((resolve) => setTimeout(resolve, 0));
let panelRef: ListingPanel | undefined;
const status = () =>
  document.querySelector(".joyfox-listing__status")?.textContent ?? "";
const button = (text: string) =>
  Array.from(
    document.querySelectorAll<HTMLButtonElement>(".joyfox-listing button"),
  ).find((node) => node.textContent === text)!;

beforeEach(() => {
  getAnswer = { status: "ok", accountId: "account-a", listing: null };
  listAnswer = { accountId: "account-a", listings: [] };
  client = {
    get: vi.fn(() => Promise.resolve(getAnswer)),
    list: vi.fn(() => Promise.resolve(listAnswer)),
    save: vi.fn((request) =>
      Promise.resolve({
        status: "saved",
        listing: listing({
          note: request.note || undefined,
          tags: request.tags,
          attendance: request.attendance,
          updatedAt: "2026-09-26T10:05:00.000Z",
        }),
      }),
    ),
    openOptions: vi.fn(() => Promise.resolve()),
  } as never;
});

describe("V1-5 page detection", () => {
  it("detects event, event list and venue pages from verified paths", () => {
    document.body.innerHTML = EVENT_PAGE;
    expect(
      detectPage(
        "https://www.joyclub.de/event/1234567.synthetic-party.html",
        document,
      ),
    ).toMatchObject({ value: "event" });
    document.body.innerHTML = LIST_PAGE;
    expect(
      detectPage("https://www.joyclub.de/dates_partys/events/?x=1", document),
    ).toMatchObject({ value: "event-calendar" });
    document.body.innerHTML = VENUE_PAGE;
    expect(
      detectPage(
        "https://www.joyclub.de/club/123.synthetic-club.html",
        document,
      ),
    ).toMatchObject({ value: "venue" });
    // The ClubMail inbox is not a venue.
    expect(
      detectPage("https://www.joyclub.de/clubmail/", document),
    ).not.toMatchObject({
      value: "venue",
    });
  });
});

describe("V1-5 event panel", () => {
  const mount = (
    html = EVENT_PAGE,
    path = "/event/1234567.synthetic-party.html",
  ) => {
    document.body.innerHTML = html;
    const panel = new ListingPanel(document, client, () => path);
    panelRef = panel;
    panel.update(html === VENUE_PAGE ? "venue" : "event");
    return panel;
  };

  it("sits after the event's info box and saves attendance with the page's facts", async () => {
    mount();
    await flush();
    const root = document.querySelector(".joyfox-listing")!;
    expect(root.previousElementSibling?.className).toBe("event_info_box");
    expect(client.get).toHaveBeenCalledWith("event", "1234567");
    const select = document.querySelector<HTMLSelectElement>(
      "#joyfox-listing-attendance",
    )!;
    select.value = "attending";
    select.dispatchEvent(new Event("change"));
    await flush();
    expect(client.save).toHaveBeenCalledWith({
      accountId: "account-a",
      kind: "event",
      eventId: "1234567",
      note: "",
      tags: [],
      attendance: "attending",
      facts: {
        title: "Synthetic party",
        startLocal: "2026-09-27T21:00",
        path: "/event/1234567.synthetic-party.html",
        venueId: "123",
        venueName: "Synthetic club",
      },
      expectedUpdatedAt: null,
    });
    expect(status()).toBe("Saved.");
  });

  it("disables the box while a save is on its way, so no change is dropped", async () => {
    mount();
    await flush();
    let answer: (value: unknown) => void = () => undefined;
    client.save.mockImplementationOnce(
      () => new Promise((resolve) => (answer = resolve)),
    );
    const select = document.querySelector<HTMLSelectElement>(
      "#joyfox-listing-attendance",
    )!;
    select.value = "interested";
    select.dispatchEvent(new Event("change"));
    const controls = document.querySelectorAll<HTMLButtonElement>(
      ".joyfox-listing button, .joyfox-listing select, .joyfox-listing input, .joyfox-listing textarea",
    );
    expect(Array.from(controls).every((control) => control.disabled)).toBe(
      true,
    );
    // Another tab's change redraws the box meanwhile: it stays disabled.
    (panelRef as ListingPanel).invalidate();
    await flush();
    expect(
      document.querySelector<HTMLSelectElement>("#joyfox-listing-attendance")!
        .disabled,
    ).toBe(true);
    answer({
      status: "saved",
      listing: listing({
        attendance: "interested",
        updatedAt: "2026-09-26T10:06:00.000Z",
      }),
    });
    await flush();
    const after = document.querySelector<HTMLSelectElement>(
      "#joyfox-listing-attendance",
    )!;
    expect(after.disabled).toBe(false);
    expect(after.value).toBe("interested");
  });

  it("saves the note with its button and keeps a typed note across a conflict", async () => {
    mount();
    await flush();
    const note = document.querySelector<HTMLTextAreaElement>(
      "#joyfox-listing-note",
    )!;
    note.value = "Bring a mask";
    note.dispatchEvent(new Event("input"));
    client.save.mockResolvedValueOnce({
      status: "conflict",
      listing: listing({ note: "From another tab" }),
    });
    button("Save note").click();
    await flush();
    expect(status()).toContain("changed in another tab");
    expect(
      document.querySelector<HTMLTextAreaElement>("#joyfox-listing-note")!
        .value,
    ).toBe("Bring a mask");
    button("Save note").click();
    await flush();
    expect(client.save).toHaveBeenLastCalledWith(
      expect.objectContaining({
        note: "Bring a mask",
        expectedUpdatedAt: "2026-09-26T10:00:00.000Z",
      }),
    );
    expect(status()).toBe("Saved.");
  });

  it("adds and removes tags at once", async () => {
    getAnswer = {
      status: "ok",
      accountId: "account-a",
      listing: listing({ tags: ["Dresscode"], attendance: "interested" }),
    };
    mount();
    await flush();
    const input = document.querySelector<HTMLInputElement>(
      ".joyfox-listing__tag-input",
    )!;
    input.value = "Friends";
    input.dispatchEvent(new Event("input"));
    input.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter" }));
    await flush();
    expect(client.save).toHaveBeenLastCalledWith(
      expect.objectContaining({
        tags: ["Dresscode", "Friends"],
        attendance: "interested",
      }),
    );
    const remove = document.querySelector<HTMLButtonElement>(
      '[aria-label="Remove tag Dresscode"]',
    )!;
    remove.click();
    await flush();
    expect(client.save).toHaveBeenLastCalledWith(
      expect.objectContaining({ tags: ["Friends"] }),
    );
  });

  it("shows no attendance on a venue and keeps the venue's name", async () => {
    mount(VENUE_PAGE, "/club/123.synthetic-club.html");
    await flush();
    expect(document.querySelector("#joyfox-listing-attendance")).toBeNull();
    expect(document.querySelector(".joyfox-listing")?.textContent).toContain(
      "my notes on this venue",
    );
    button("Add tag");
    const input = document.querySelector<HTMLInputElement>(
      ".joyfox-listing__tag-input",
    )!;
    input.value = "Nice bar";
    input.dispatchEvent(new Event("input"));
    button("Add tag").click();
    await flush();
    expect(client.save).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: "venue",
        eventId: "123",
        facts: {
          title: "Synthetic club",
          path: "/club/123.synthetic-club.html",
        },
      }),
    );
  });

  it("asks for an account first", async () => {
    getAnswer = { status: "no-account" };
    mount();
    await flush();
    expect(document.querySelector(".joyfox-listing")?.textContent).toContain(
      "Select or add an account",
    );
  });

  it("leaves nothing behind off the page", async () => {
    const panel = mount();
    await flush();
    panel.leave();
    expect(document.querySelector(".joyfox-listing")).toBeNull();
  });
});

describe("V1-5 event list filter", () => {
  const items = () =>
    Array.from(
      document.querySelectorAll<HTMLElement>(".card-list-ui-list-item"),
    );
  const list = () => document.querySelector(".card-list-ui")!;
  const choose = (value: string) => {
    const select = document.querySelector<HTMLSelectElement>(
      "#joyfox-event-filter",
    )!;
    select.value = value;
    select.dispatchEvent(new Event("change"));
  };

  beforeEach(() => {
    document.body.innerHTML = LIST_PAGE;
    listAnswer = {
      accountId: "account-a",
      listings: [
        listing({
          eventId: "1111111",
          tags: ["Friends"],
          attendance: "attending",
          note: "Go",
        }),
      ],
    };
  });

  it("shows only matching loaded events, and badges tracked ones", async () => {
    const filter = new EventListFilter(document, client);
    filter.update();
    await flush();
    expect(list().getAttribute(FILTER_ATTRIBUTE)).toBeNull();
    expect(items()[0]!.querySelector(".joyfox-event-badge")?.textContent).toBe(
      "JoyFox · Attending · Friends · note",
    );
    expect(items()[2]!.querySelector(".joyfox-event-badge")).toBeNull();
    choose("tag:Friends");
    expect(list().getAttribute(FILTER_ATTRIBUTE)).toBe("on");
    expect(items().map((item) => item.getAttribute(MATCH_ATTRIBUTE))).toEqual([
      "yes",
      "no",
      "no",
    ]);
    expect(
      document.querySelector(".joyfox-event-filter__count")?.textContent,
    ).toContain("1 of 2 loaded events shown");
    // An item JoyClub loads later is checked on the next page event.
    const later = items()[2]!.cloneNode(true) as HTMLElement;
    later.setAttribute("data-element-id", "1111111");
    later.removeAttribute(MATCH_ATTRIBUTE);
    list().append(later);
    filter.update();
    expect(later.getAttribute(MATCH_ATTRIBUTE)).toBe("yes");
    expect(client.list).toHaveBeenCalledTimes(1);
  });

  it("offers no filter without an account", async () => {
    listAnswer = { listings: [] };
    new EventListFilter(document, client).update();
    await flush();
    expect(
      document.querySelector<HTMLSelectElement>("#joyfox-event-filter")!
        .disabled,
    ).toBe(true);
    expect(
      document.querySelector(".joyfox-event-filter")?.textContent,
    ).toContain("Select or add an account");
  });

  it("restores JoyClub's list when it leaves", async () => {
    const filter = new EventListFilter(document, client);
    filter.update();
    await flush();
    choose("tracked");
    filter.leave();
    expect(list().getAttribute(FILTER_ATTRIBUTE)).toBeNull();
    expect(document.querySelector(`[${MATCH_ATTRIBUTE}]`)).toBeNull();
    expect(document.querySelector(".joyfox-event-badge")).toBeNull();
    expect(document.querySelector(".joyfox-event-filter")).toBeNull();
  });
});
