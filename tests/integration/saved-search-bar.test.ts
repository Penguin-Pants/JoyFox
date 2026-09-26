// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { detectPage } from "../../src/content/page-detector";
import {
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
    expect(navigate).toHaveBeenCalledWith(OTHER);
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
