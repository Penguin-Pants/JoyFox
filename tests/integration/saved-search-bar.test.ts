// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { detectPage } from "../../src/content/page-detector";
import {
  RUN_SEARCH_MARKER,
  SavedSearchBar,
  type SavedSearchClient,
  type SearchList,
} from "../../src/content/saved-searches";
import { readSearchAddress } from "../../src/search/saved-search";

// Shapes from docs/live-evidence/11-search.md, with invented values.
const PAGE =
  "https://www.joyclub.de/member/place-as-r/?user_geo_distance=25&user_age=30_40#infiniteScroll";
const OTHER = "https://www.joyclub.de/member/other-as-r/?user_age=20_30";

function summary(id: string, name: string, url: string) {
  const address = readSearchAddress(url);
  if (address.status !== "ok") throw new Error("setup");
  return { id, name, url: address.url, filters: address.filters };
}

let listAnswer: SearchList;
let client: SavedSearchClient & {
  list: ReturnType<typeof vi.fn>;
  save: ReturnType<typeof vi.fn>;
  remove: ReturnType<typeof vi.fn>;
};
let navigate: ReturnType<typeof vi.fn<(url: string) => void>>;
let bar: SavedSearchBar;

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));
const root = () => document.querySelector(".joyfox-saved-searches");
const status = () =>
  document.querySelector(".joyfox-saved-searches__status")?.textContent ?? "";
const buttons = () =>
  Array.from(
    document.querySelectorAll<HTMLButtonElement>(
      ".joyfox-saved-searches button",
    ),
  );
const buttonNamed = (text: string) =>
  buttons().find((node) => node.textContent === text)!;

beforeEach(() => {
  document.body.innerHTML = `
    <div data-e2e="search-filter-button"></div>
    <div class="member_search_list"><a data-e2e="result-item" href="/profile/1234567.x.html"></a></div>`;
  listAnswer = {
    accountId: "account-a",
    searches: [summary("search:1", "Nearby", OTHER)],
  };
  client = {
    list: vi.fn(() => Promise.resolve(listAnswer)),
    save: vi.fn(() => Promise.resolve({ status: "saved", id: "search:2" })),
    remove: vi.fn(() => Promise.resolve({ status: "deleted" })),
    openOptions: vi.fn(() => Promise.resolve()),
  } as never;
  navigate = vi.fn<(url: string) => void>();
  bar = new SavedSearchBar(document, client, navigate, () => PAGE);
});

describe("V1-3 saved-search bar", () => {
  it("detects the search page from its verified address and root", () => {
    expect(detectPage(PAGE, document)).toMatchObject({
      status: "found",
      value: "search",
    });
    document.querySelector(".member_search_list")!.remove();
    expect(detectPage(PAGE, document)).toMatchObject({ status: "missing" });
  });

  it("shows the saved searches above the result list", async () => {
    bar.update();
    await flush();
    expect(root()?.nextElementSibling?.className).toBe("member_search_list");
    expect(buttons().map((node) => node.textContent)).toEqual([
      "Nearby",
      "✕",
      "Save this search",
    ]);
    // Placed again, with its state, after JoyClub redraws the page.
    const list = document.querySelector(".member_search_list")!;
    root()!.remove();
    list.replaceWith(list.cloneNode(true));
    bar.update();
    expect(root()?.nextElementSibling?.className).toBe("member_search_list");
    expect(client.list).toHaveBeenCalledTimes(1);
  });

  it("opens a saved search in one click", async () => {
    bar.update();
    await flush();
    buttonNamed("Nearby").click();
    expect(navigate).toHaveBeenCalledWith(OTHER + RUN_SEARCH_MARKER);
  });

  it("replaces the saved address's own fragment with the marker", async () => {
    listAnswer = {
      accountId: "account-a",
      searches: [summary("search:3", "Here", `${OTHER}#infiniteScroll`)],
    };
    bar.update();
    await flush();
    buttonNamed("Here").click();
    expect(navigate).toHaveBeenCalledWith(`${OTHER}#joyfox-run-search`);
  });

  it("opens nothing and says so when the address no longer matches", async () => {
    listAnswer = {
      accountId: "account-a",
      searches: [
        {
          id: "search:old",
          name: "Old",
          url: "https://www.joyclub.de/search/members/",
          filters: { path: [], query: [] },
        },
      ],
    };
    bar.update();
    await flush();
    buttonNamed("Old").click();
    expect(navigate).not.toHaveBeenCalled();
    expect(status()).toContain(
      '"Old" no longer matches JoyClub\'s search address',
    );
  });

  it("saves the page's address under a typed name", async () => {
    bar.update();
    await flush();
    buttonNamed("Save this search").click();
    const input = document.querySelector<HTMLInputElement>(
      ".joyfox-saved-searches__name",
    )!;
    buttonNamed("Save").click();
    expect(status()).toBe("Type a name first. Nothing was saved.");
    input.value = "  Weekend  ";
    input.dispatchEvent(new Event("input"));
    input.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter" }));
    await flush();
    expect(client.save).toHaveBeenCalledWith("account-a", "Weekend", PAGE);
    expect(status()).toBe('Saved "Weekend".');
    expect(client.list).toHaveBeenCalledTimes(2);
    expect(document.querySelector(".joyfox-saved-searches__name")).toBeNull();
  });

  it("keeps the save answer when another tab's change reloads the list", async () => {
    bar.update();
    await flush();
    let answer: (value: unknown) => void = () => undefined;
    client.save.mockImplementation(
      () => new Promise((resolve) => (answer = resolve)),
    );
    buttonNamed("Save this search").click();
    const input = document.querySelector<HTMLInputElement>(
      ".joyfox-saved-searches__name",
    )!;
    input.value = "Weekend";
    input.dispatchEvent(new Event("input"));
    buttonNamed("Save").click();
    bar.invalidate();
    answer({ status: "saved", id: "search:2" });
    await flush();
    expect(status()).toBe('Saved "Weekend".');
  });

  it("saves once when Enter or Save is pressed again while saving", async () => {
    bar.update();
    await flush();
    let answer: (value: unknown) => void = () => undefined;
    client.save.mockImplementation(
      () => new Promise((resolve) => (answer = resolve)),
    );
    buttonNamed("Save this search").click();
    const input = document.querySelector<HTMLInputElement>(
      ".joyfox-saved-searches__name",
    )!;
    input.value = "Weekend";
    input.dispatchEvent(new Event("input"));
    input.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter" }));
    input.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter" }));
    buttonNamed("Save").click();
    expect(client.save).toHaveBeenCalledTimes(1);
    answer({ status: "saved", id: "search:2" });
    await flush();
    expect(status()).toBe('Saved "Weekend".');
  });

  it("does not save an address that is not a search", async () => {
    bar = new SavedSearchBar(
      document,
      client,
      navigate,
      () => "https://www.joyclub.de/clubmail/",
    );
    bar.update();
    await flush();
    buttonNamed("Save this search").click();
    const input = document.querySelector<HTMLInputElement>(
      ".joyfox-saved-searches__name",
    )!;
    input.value = "Inbox";
    input.dispatchEvent(new Event("input"));
    buttonNamed("Save").click();
    await flush();
    expect(client.save).not.toHaveBeenCalled();
    expect(status()).toContain("not a search JoyFox can save");
  });

  it("reports a refused, full or failed save", async () => {
    bar.update();
    await flush();
    const attempt = async () => {
      buttonNamed("Save this search")?.click();
      const input = document.querySelector<HTMLInputElement>(
        ".joyfox-saved-searches__name",
      )!;
      input.value = "X";
      input.dispatchEvent(new Event("input"));
      buttonNamed("Save").click();
      await flush();
      return status();
    };
    client.save.mockResolvedValueOnce({ status: "refused" });
    expect(await attempt()).toContain("account changed");
    client.save.mockResolvedValueOnce({ status: "full" });
    expect(await attempt()).toContain("You have 50 saved searches");
    client.save.mockRejectedValueOnce(new Error("offline"));
    expect(await attempt()).not.toBe("");
  });

  it("deletes only on a second click of ✕", async () => {
    bar.update();
    await flush();
    buttonNamed("✕").click();
    expect(client.remove).not.toHaveBeenCalled();
    expect(status()).toBe('Click ✕ again to delete "Nearby".');
    expect(buttonNamed("✕").getAttribute("aria-label")).toBe(
      "Delete saved search Nearby",
    );
    listAnswer = { accountId: "account-a", searches: [] };
    buttonNamed("✕").click();
    await flush();
    expect(client.remove).toHaveBeenCalledWith("account-a", "search:1");
    expect(status()).toBe('Deleted "Nearby".');
    expect(root()?.textContent).toContain("No saved searches yet.");
  });

  it("drops the read error once a later read works", async () => {
    client.list.mockRejectedValueOnce(new Error("offline"));
    bar.update();
    await flush();
    expect(status()).toContain("could not read your saved searches");
    bar.invalidate();
    await flush();
    expect(status()).toBe("");
    expect(buttonNamed("Nearby")).toBeDefined();
  });

  it("asks for an account first", async () => {
    listAnswer = { searches: [] };
    bar.update();
    await flush();
    expect(root()?.textContent).toContain("Select or add an account");
    buttonNamed("Open JoyFox options").click();
    expect(client.openOptions).toHaveBeenCalled();
  });

  it("drops another account's list at once after a switch", async () => {
    bar.update();
    await flush();
    let answer: (value: SearchList) => void = () => undefined;
    client.list.mockImplementation(
      () => new Promise((resolve) => (answer = resolve)),
    );
    bar.accountChanged();
    expect(root()?.textContent).not.toContain("Nearby");
    answer({ accountId: "account-b", searches: [] });
    await flush();
    expect(root()?.textContent).toContain("No saved searches yet.");
  });

  describe("running a saved search", () => {
    const TIMING = { waitMs: 40, pollMs: 5 };
    let replaceState: ReturnType<typeof vi.spyOn>;
    let clicks: string[];
    let inner: HTMLButtonElement;
    let stored: Map<string, string>;
    const store = () => ({
      getItem: (key: string) => stored.get(key) ?? null,
      setItem: (key: string, value: string) => void stored.set(key, value),
      removeItem: (key: string) => void stored.delete(key),
    });
    const options = (extra = {}) => ({ timing: TIMING, store, ...extra });
    /** The record a click on a saved search leaves in the tab. */
    const requested = (address: string, expires = Date.now() + 60_000) =>
      stored.set("joyfox.runSavedSearch", JSON.stringify({ address, expires }));
    const noFragment = (url: string) => url.replace(/#.*$/u, "");

    /** JoyClub's filter button; its click opens the panel with "Anwenden". */
    function joyClubFilter(openPanel = true, drawMs = 10) {
      document
        .querySelector('[data-e2e="search-filter-button"]')!
        .addEventListener("click", () => {
          clicks.push("filter");
          if (!openPanel) return;
          const apply = document.createElement("j-button");
          apply.setAttribute("data-e2e", "apply-filter-button");
          inner = document.createElement("button");
          inner.textContent = "Anwenden";
          inner.addEventListener("click", () => clicks.push("apply"));
          apply.attachShadow({ mode: "open" }).append(inner);
          // The panel appears a moment later, as JoyClub draws it.
          setTimeout(() => document.body.append(apply), drawMs);
        });
    }

    beforeEach(() => {
      clicks = [];
      stored = new Map();
      replaceState = vi
        .spyOn(window.history, "replaceState")
        .mockImplementation(() => undefined);
    });

    afterEach(() => replaceState.mockRestore());

    it("records the click in the tab before opening the saved address", async () => {
      bar = new SavedSearchBar(
        document,
        client,
        navigate,
        () => PAGE,
        options(),
      );
      bar.update();
      await flush();
      buttonNamed("Nearby").click();
      expect(navigate).toHaveBeenCalledWith(OTHER + RUN_SEARCH_MARKER);
      expect(JSON.parse(stored.get("joyfox.runSavedSearch")!).address).toBe(
        OTHER,
      );
    });

    it("removes the marker, then opens the filter and clicks Anwenden once", async () => {
      joyClubFilter();
      requested(OTHER);
      bar = new SavedSearchBar(
        document,
        client,
        navigate,
        () => OTHER + RUN_SEARCH_MARKER,
        options(),
      );
      bar.update();
      expect(replaceState).toHaveBeenCalledWith(
        null,
        "",
        "/member/other-as-r/?user_age=20_30",
      );
      // The request is used once.
      expect(stored.size).toBe(0);
      expect(clicks).toEqual([]);
      await vi.waitFor(() => expect(clicks).toEqual(["filter", "apply"]));
      const innerClicks = vi.fn();
      inner.addEventListener("click", innerClicks);
      // JoyClub redraws; the bar is placed again but clicks nothing more.
      root()!.remove();
      bar.update();
      bar.update();
      await new Promise((resolve) => setTimeout(resolve, 60));
      expect(clicks).toEqual(["filter", "apply"]);
      expect(innerClicks).not.toHaveBeenCalled();
      expect(replaceState).toHaveBeenCalledTimes(1);
      expect(status()).toBe("");
    });

    it("clicks nothing for a marker that no click in this tab asked for", async () => {
      joyClubFilter();
      // A link from another site or a bookmark; a stale request; a request
      // for another search.
      for (const setUp of [
        () => undefined,
        () => requested(OTHER, Date.now() - 1),
        () => requested(noFragment(PAGE)),
      ]) {
        stored.clear();
        setUp();
        bar?.leave();
        bar = new SavedSearchBar(
          document,
          client,
          navigate,
          () => OTHER + RUN_SEARCH_MARKER,
          options(),
        );
        bar.update();
        await new Promise((resolve) => setTimeout(resolve, 30));
        expect(clicks).toEqual([]);
        // The marker is still removed.
        expect(replaceState).toHaveBeenLastCalledWith(
          null,
          "",
          "/member/other-as-r/?user_age=20_30",
        );
      }
    });

    it("clicks nothing on a page loaded without the marker", async () => {
      joyClubFilter();
      requested(noFragment(PAGE));
      bar = new SavedSearchBar(
        document,
        client,
        navigate,
        () => PAGE,
        options(),
      );
      bar.update();
      await new Promise((resolve) => setTimeout(resolve, 60));
      expect(clicks).toEqual([]);
      expect(replaceState).not.toHaveBeenCalled();
    });

    it("reloads the page when the saved address is this page, then runs it", async () => {
      joyClubFilter();
      listAnswer = {
        accountId: "account-a",
        searches: [summary("search:3", "Here", PAGE)],
      };
      const here = noFragment(PAGE);
      const reload = vi.fn();
      bar = new SavedSearchBar(
        document,
        client,
        navigate,
        () => here,
        options({ reload }),
      );
      bar.update();
      await flush();
      buttonNamed("Here").click();
      // The panel may hold edits not applied: the saved filters come back
      // with a reload, never from the panel as it is.
      expect(clicks).toEqual([]);
      expect(navigate).not.toHaveBeenCalled();
      const path = new URL(here);
      expect(replaceState).toHaveBeenCalledWith(
        null,
        "",
        path.pathname + path.search + RUN_SEARCH_MARKER,
      );
      expect(reload).toHaveBeenCalledTimes(1);
      // The reloaded page carries the marker and the tab's request.
      bar.leave();
      bar = new SavedSearchBar(
        document,
        client,
        navigate,
        () => here + RUN_SEARCH_MARKER,
        options(),
      );
      bar.update();
      await vi.waitFor(() => expect(clicks).toEqual(["filter", "apply"]));
    });

    it("never clicks on a page left while it waits", async () => {
      // The panel appears late, so the page is left before it does.
      joyClubFilter(true, 150);
      for (const leave of [
        // Another search in place: the address changes.
        (setUrl: (url: string) => void) => setUrl(noFragment(PAGE)),
        // No search page at all.
        () => bar.leave(),
      ]) {
        clicks = [];
        document.querySelector("j-button")?.remove();
        requested(OTHER);
        let url = OTHER + RUN_SEARCH_MARKER;
        bar = new SavedSearchBar(
          document,
          client,
          navigate,
          () => url,
          options(),
        );
        bar.update();
        url = OTHER;
        // The filter opens; the panel appears 10 ms later.
        await vi.waitFor(() => expect(clicks).toEqual(["filter"]), {
          interval: 1,
        });
        leave((next) => {
          url = next;
        });
        await new Promise((resolve) => setTimeout(resolve, 250));
        expect(clicks).toEqual(["filter"]);
        expect(status()).not.toContain("could not run");
      }
    });

    it("asks the user to click Anwenden when the panel does not open", async () => {
      joyClubFilter(false);
      const address = noFragment(PAGE);
      requested(address);
      let url = address + RUN_SEARCH_MARKER;
      bar = new SavedSearchBar(
        document,
        client,
        navigate,
        () => url,
        options(),
      );
      bar.update();
      url = address;
      await vi.waitFor(() =>
        expect(status()).toBe(
          'JoyFox could not run the saved search. Open JoyClub\'s filter and click "Anwenden".',
        ),
      );
      expect(clicks).toEqual(["filter"]);
    });
  });

  it("leaves no trace off the search page", async () => {
    bar.update();
    await flush();
    bar.leave();
    expect(root()).toBeNull();
    document.querySelector(".member_search_list")!.remove();
    bar.update();
    expect(root()).toBeNull();
  });
});
