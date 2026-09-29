// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { detectPage } from "../../src/content/page-detector";
import {
  ProfileTypeFilter,
  TYPE_FILTER_ATTRIBUTE,
  TYPE_FILTER_KEY,
  TYPE_MATCH_ATTRIBUTE,
} from "../../src/content/profile-type-filter";
import { setLocale } from "../../src/i18n/translator";
import contentCss from "../../src/content/content.css?raw";

// Shapes from docs/live-evidence/17-my-joy-lists.md, invented values.
const cardLi = (code: string | null, name: string) =>
  `<li><j-member-card ${
    code === null ? "" : `universal-gender="${code}" `
  }user-name="${name}" is-interactive="true"><div class="image-ui" slot="image"></div></j-member-card></li>`;
const PLACEHOLDERS = Array.from(
  { length: 4 },
  () =>
    `<li class="card-grid-placeholder-card hidden-xs"><j-card is-placeholder="true" aria-hidden="true"></j-card></li>`,
).join("");
const page = (items: string, grid = true) => `
  <main class="my_joy my_joy-wide">
    <div class="my_joy_header page-header">
      <j-page-header><j-pill-navigation id="my-joy-visits-and-voting-navigation" active-index="0"></j-pill-navigation></j-page-header>
    </div>
    <section class="my-joy-visits-view my_joy_view">
      <h2 class="screen-reader-only">Profilbesucher</h2>
      <div>${
        grid
          ? `<div class="card-grid-container">
          <aside><j-card></j-card></aside>
          <ul class="card-grid-container-list">${items}${PLACEHOLDERS}</ul>
        </div>`
          : ""
      }<div class="load_more_container"></div></div>
    </section>
  </main>`;
// 2 man, 2 woman, 2 couple and 1 card without a type.
const SEVEN = [
  cardLi("1", "A"),
  cardLi("2", "B"),
  cardLi("3", "C"),
  cardLi(null, "D"),
  cardLi("1", "E"),
  cardLi("2", "F"),
  cardLi("3", "G"),
].join("");
const URL_OF = {
  visitors: "https://www.joyclub.de/my_joy/visitors/",
  match: "https://www.joyclub.de/my_joy/voting/match/",
  top: "https://www.joyclub.de/my_joy/voting/top/",
  fav: "https://www.joyclub.de/my_joy/voting/fav/",
  visits: "https://www.joyclub.de/my_joy/visits/",
};

const grid = () => document.querySelector(".card-grid-container")!;
const slots = () =>
  Array.from(
    document.querySelectorAll<HTMLElement>(
      "ul.card-grid-container-list > li:not(.card-grid-placeholder-card)",
    ),
  );
const placeholders = () =>
  Array.from(document.querySelectorAll(".card-grid-placeholder-card"));
const bar = () => document.querySelector<HTMLElement>(".joyfox-type-filter");
const box = (type: string) =>
  document.querySelector<HTMLInputElement>(
    `.joyfox-type-filter input[value="${type}"]`,
  )!;
const tick = (type: string) => box(type).click();
const count = () =>
  document.querySelector(".joyfox-type-filter__count")?.textContent ?? "";
const hint = () =>
  document.querySelector(".joyfox-type-filter__hint")?.textContent ?? "";
const marks = () =>
  Array.from(document.querySelectorAll(".joyfox-type-unknown"));
const visible = () =>
  slots().filter((slot) => getComputedStyle(slot).display !== "none");
const names = (list: HTMLElement[]) =>
  list.map((slot) =>
    slot.querySelector("j-member-card")!.getAttribute("user-name"),
  );

let filter: ProfileTypeFilter;

beforeEach(() => {
  sessionStorage.clear();
  document.head.innerHTML = `<style>${contentCss}</style>`;
  document.body.innerHTML = page(SEVEN);
  filter = new ProfileTypeFilter(document);
});

afterEach(() => {
  filter.leave();
  setLocale("en");
  vi.unstubAllGlobals();
});

describe("V1-14 page detection", () => {
  it("detects the five My JOY lists on www.joyclub.de only (AC-17)", () => {
    for (const url of Object.values(URL_OF))
      expect(detectPage(url, document), url).toMatchObject({
        value: "my-joy-list",
      });
    for (const url of [
      "https://www.joyclub.de/my_joy/",
      "https://www.joyclub.de/my_joy/visitorsx/",
      "https://www.joyclub.de/my_joy/voting/",
      "https://www.joyclub.de/my_joy/voting/other/",
      "https://www.joyce.app/my_joy/visitors/",
    ])
      expect(detectPage(url, document), url).not.toMatchObject({
        value: "my-joy-list",
      });
    // The section has not rendered yet.
    document.body.innerHTML = "";
    expect(detectPage(URL_OF.visitors, document)).toMatchObject({
      status: "missing",
    });
  });
});

describe("V1-14 profile type filter", () => {
  it("places one bar before the grid, with four unticked boxes (AC-01, AC-02)", () => {
    filter.update();
    filter.update();
    expect(document.querySelectorAll(".joyfox-type-filter")).toHaveLength(1);
    expect(bar()!.nextElementSibling).toBe(grid());
    expect(bar()!.querySelector("legend")?.textContent).toBe("Profile type");
    const boxes = Array.from(
      bar()!.querySelectorAll<HTMLInputElement>("input[type=checkbox]"),
    );
    expect(
      boxes.map((node) => node.parentElement!.textContent!.trim()),
    ).toEqual(["Man", "Woman", "Couple", "Unknown"]);
    expect(boxes.every((node) => !node.checked)).toBe(true);
    expect(visible()).toHaveLength(7);
    expect(grid().hasAttribute(TYPE_FILTER_ATTRIBUTE)).toBe(false);
    expect(document.querySelector(`[${TYPE_MATCH_ATTRIBUTE}]`)).toBeNull();
    expect(marks()).toHaveLength(0);
    expect(count()).toBe("");
    expect(hint()).toBe("");
  });

  it("shows only ticked types and counts the loaded cards (AC-03, AC-04)", () => {
    filter.update();
    tick("woman");
    expect(names(visible())).toEqual(["B", "F"]);
    expect(marks()).toHaveLength(0);
    expect(count()).toBe("Showing 2 of 7 loaded · 1 with unknown type hidden");
    expect(hint()).toBe("Scroll down to load more.");
    tick("couple");
    expect(names(visible())).toEqual(["B", "C", "F", "G"]);
    expect(count()).toBe("Showing 4 of 7 loaded · 1 with unknown type hidden");
  });

  it("treats Unknown as a type and marks the unknown cards it shows (AC-05)", () => {
    filter.update();
    tick("woman");
    tick("unknown");
    expect(names(visible())).toEqual(["B", "D", "F"]);
    expect(marks()).toHaveLength(1);
    expect(marks()[0]!.parentElement!.getAttribute("user-name")).toBe("D");
    expect(marks()[0]!.getAttribute("slot")).toBe("badge-top-right");
    expect(marks()[0]!.textContent).toBe("Type unknown");
    expect(count()).toBe("Showing 3 of 7 loaded");
  });

  it("shows everything again when nothing is ticked (AC-06)", () => {
    filter.update();
    tick("unknown");
    tick("man");
    tick("unknown");
    tick("man");
    expect(visible()).toHaveLength(7);
    expect(marks()).toHaveLength(0);
    expect(grid().hasAttribute(TYPE_FILTER_ATTRIBUTE)).toBe(false);
    expect(document.querySelector(`[${TYPE_MATCH_ATTRIBUTE}]`)).toBeNull();
    expect(count()).toBe("");
    expect(hint()).toBe("");
    expect(sessionStorage.getItem(TYPE_FILTER_KEY)).toBeNull();
  });

  it("filters cards JoyClub adds or changes later (AC-07, AC-08)", () => {
    filter.update();
    tick("woman");
    const list = document.querySelector("ul.card-grid-container-list")!;
    const first = list.querySelector(".card-grid-placeholder-card");
    for (const html of [cardLi("2", "H"), cardLi("2", "I"), cardLi("1", "J")])
      first!.insertAdjacentHTML("beforebegin", html);
    filter.update();
    expect(names(visible())).toEqual(["B", "F", "H", "I"]);
    expect(count()).toBe("Showing 4 of 10 loaded · 1 with unknown type hidden");
    // The card host's code changes in place (the coordinator watches it).
    document
      .querySelector('j-member-card[user-name="A"]')!
      .setAttribute("universal-gender", "2");
    filter.update();
    expect(names(visible())).toEqual(["A", "B", "F", "H", "I"]);
    expect(count()).toContain("Showing 5 of 10 loaded");
  });

  it("keeps the choice across the five lists in the tab (AC-09)", () => {
    filter.update();
    tick("woman");
    tick("couple");
    expect(JSON.parse(sessionStorage.getItem(TYPE_FILTER_KEY)!)).toEqual([
      "woman",
      "couple",
    ]);
    // JoyClub's tabs move client-side; the list can pass a state with no
    // section, and a full page load builds a new filter.
    filter.leave();
    document.body.innerHTML = page(SEVEN);
    filter.update();
    expect(box("woman").checked && box("couple").checked).toBe(true);
    expect(names(visible())).toEqual(["B", "C", "F", "G"]);
    filter.leave();
    const next = new ProfileTypeFilter(document);
    next.update();
    expect(box("woman").checked && box("couple").checked).toBe(true);
    expect(names(visible())).toEqual(["B", "C", "F", "G"]);
    next.leave();
  });

  it("starts with nothing ticked in a tab opened on its own (AC-10)", () => {
    filter.update();
    for (const type of ["man", "woman", "couple", "unknown"])
      expect(box(type).checked, type).toBe(false);
  });

  it("still filters when the tab's storage fails (AC-11)", () => {
    filter = new ProfileTypeFilter(document, () => {
      throw new Error("blocked");
    });
    filter.update();
    tick("man");
    expect(names(visible())).toEqual(["A", "E"]);
    expect(document.querySelector(".joyfox-error")).toBeNull();
  });

  it("reads only valid kept types (AC-12)", () => {
    sessionStorage.setItem(TYPE_FILTER_KEY, '["woman","robot"]');
    filter.update();
    expect(box("woman").checked).toBe(true);
    expect(box("man").checked).toBe(false);
    expect(names(visible())).toEqual(["B", "F"]);
    filter.leave();
    sessionStorage.setItem(TYPE_FILTER_KEY, "not json");
    filter.update();
    expect(box("woman").checked).toBe(false);
    expect(visible()).toHaveLength(7);
  });

  it("restores JoyClub's list when it leaves (AC-13)", () => {
    filter.update();
    tick("woman");
    tick("unknown");
    filter.leave();
    expect(bar()).toBeNull();
    expect(grid().hasAttribute(TYPE_FILTER_ATTRIBUTE)).toBe(false);
    expect(document.querySelector(`[${TYPE_MATCH_ATTRIBUTE}]`)).toBeNull();
    expect(document.querySelector("[data-joyfox-ui]")).toBeNull();
    expect(visible()).toHaveLength(7);
    // The tab's choice stays for the next list.
    expect(sessionStorage.getItem(TYPE_FILTER_KEY)).toBe('["woman","unknown"]');
  });

  it("sends nothing, requests nothing and stores no member data (AC-14)", () => {
    const fetch = vi.fn();
    const sendMessage = vi.fn();
    const set = vi.fn();
    const open = vi.fn();
    vi.stubGlobal("fetch", fetch);
    vi.stubGlobal("browser", {
      runtime: { sendMessage },
      storage: { local: { set }, session: { set } },
    });
    vi.stubGlobal("indexedDB", { open });
    filter.update();
    tick("couple");
    tick("unknown");
    filter.update();
    filter.leave();
    expect(fetch).not.toHaveBeenCalled();
    expect(sendMessage).not.toHaveBeenCalled();
    expect(set).not.toHaveBeenCalled();
    expect(open).not.toHaveBeenCalled();
    expect(Object.keys({ ...sessionStorage })).toEqual([TYPE_FILTER_KEY]);
    expect(sessionStorage.getItem(TYPE_FILTER_KEY)).toBe(
      '["couple","unknown"]',
    );
  });

  it("switches language in place and keeps the ticked boxes (AC-15)", () => {
    filter.update();
    tick("woman");
    tick("unknown");
    setLocale("de");
    filter.localeChanged();
    expect(bar()!.querySelector("legend")?.textContent).toBe("Profiltyp");
    expect(box("woman").checked && box("unknown").checked).toBe(true);
    expect(box("woman").parentElement!.textContent!.trim()).toBe("Frau");
    expect(count()).toBe("3 von 7 geladenen angezeigt");
    expect(hint()).toBe("Nach unten scrollen, um mehr zu laden.");
    expect(marks().map((mark) => mark.textContent)).toEqual(["Typ unbekannt"]);
  });

  it("works by keyboard and keeps focus across a redraw (AC-16)", () => {
    filter.update();
    box("couple").focus();
    box("couple").click();
    expect(document.activeElement).toBe(box("couple"));
    const before = box("couple");
    filter.localeChanged();
    expect(box("couple")).not.toBe(before);
    expect(document.activeElement).toBe(box("couple"));
    const status = document.querySelector(".joyfox-type-filter__count")!;
    expect(status.getAttribute("aria-live")).toBe("polite");
    expect(status.getAttribute("role")).toBe("status");
    expect(bar()!.querySelector("fieldset > legend")).not.toBeNull();
  });

  it("shows the bar and a zero count on a list without a grid (AC-20)", () => {
    sessionStorage.setItem(TYPE_FILTER_KEY, '["woman"]');
    document.body.innerHTML = page("", false);
    filter.update();
    const section = document.querySelector("section.my-joy-visits-view")!;
    expect(section.firstElementChild).toBe(bar());
    expect(box("woman").checked).toBe(true);
    expect(count()).toBe("Showing 0 of 0 loaded");
  });

  it("never counts, hides or marks JoyClub's filler cards (AC-21)", () => {
    document.body.innerHTML = page(cardLi("2", "B") + cardLi("2", "F"));
    filter.update();
    tick("woman");
    tick("unknown");
    expect(count()).toBe("Showing 2 of 2 loaded");
    for (const filler of placeholders()) {
      expect(filler.hasAttribute(TYPE_MATCH_ATTRIBUTE)).toBe(false);
      expect(getComputedStyle(filler).display).not.toBe("none");
    }
    expect(marks()).toHaveLength(0);
  });

  it("reads a couple from its one code, never from its icons (AC-23)", () => {
    document.body.innerHTML = page(cardLi("3", "C"));
    // The card's gender icon draws two glyphs in its shadow root.
    const card = document.querySelector("j-member-card")!;
    const shadow = card.attachShadow({ mode: "open" });
    shadow.innerHTML = `<j-gender-icon universal-gender="3"></j-gender-icon>`;
    filter.update();
    tick("couple");
    expect(names(visible())).toEqual(["C"]);
    tick("couple");
    tick("woman");
    expect(visible()).toHaveLength(0);
  });

  it("changes nothing in the page when an update finds nothing new", async () => {
    filter.update();
    tick("woman");
    tick("unknown");
    filter.update();
    const records: MutationRecord[] = [];
    const observer = new MutationObserver((batch) => records.push(...batch));
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      characterData: true,
    });
    filter.update();
    filter.update();
    await new Promise((resolve) => setTimeout(resolve, 0));
    observer.disconnect();
    expect(records).toEqual([]);
  });

  it("moves to a grid JoyClub renders again, and clears the old one", () => {
    filter.update();
    tick("man");
    const old = grid();
    const fresh = old.cloneNode(true) as Element;
    for (const node of Array.from(
      fresh.querySelectorAll(`[${TYPE_MATCH_ATTRIBUTE}]`),
    ))
      node.removeAttribute(TYPE_MATCH_ATTRIBUTE);
    fresh.removeAttribute(TYPE_FILTER_ATTRIBUTE);
    old.replaceWith(fresh);
    filter.update();
    expect(old.hasAttribute(TYPE_FILTER_ATTRIBUTE)).toBe(false);
    expect(old.querySelector(`[${TYPE_MATCH_ATTRIBUTE}]`)).toBeNull();
    expect(bar()!.nextElementSibling).toBe(fresh);
    expect(names(visible())).toEqual(["A", "E"]);
  });
});
