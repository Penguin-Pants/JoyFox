// @vitest-environment jsdom
import "../setup-indexeddb";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { AccountService } from "../../src/accounts/account-service";
import { EventTrackerService } from "../../src/events/event-service";
import { setLocale } from "../../src/i18n/translator";
import { EventsPanel } from "../../src/options/events-panel";
import { repositories } from "../../src/storage/repositories";
import { SHARED_EVENT_EXCEPTION_KEY } from "../../src/triage/shared-event";
import { MemorySettingsArea } from "../memory-settings";
import { freshDatabase } from "../setup-indexeddb";

let accounts: AccountService;
let listings: EventTrackerService;
let root: HTMLElement;
let panel: EventsPanel;

beforeEach(async () => {
  await freshDatabase();
  accounts = new AccountService(
    repositories.extensionAccounts,
    new MemorySettingsArea(),
  );
  listings = new EventTrackerService();
  document.body.replaceChildren();
  root = document.createElement("section");
  document.body.append(root);
  panel = new EventsPanel(
    root,
    listings,
    accounts,
    () => new Date(2026, 8, 26, 12),
  );
});

const titles = () =>
  Array.from(
    root.querySelectorAll(".joyfox-events__item strong"),
    (node) => node.textContent,
  );

async function track(
  accountId: string,
  id: string,
  startLocal: string | undefined,
  title: string,
  notes: {
    note?: string;
    tags?: string[];
    attendance?: "attending" | "interested" | "attended" | "unknown";
  } = {},
  kind: "event" | "venue" = "event",
) {
  await listings.save(
    accountId,
    kind,
    id,
    {
      note: notes.note ?? "",
      tags: notes.tags ?? [],
      attendance: notes.attendance ?? "attending",
    },
    { title, ...(startLocal ? { startLocal } : {}) },
    null,
  );
}

describe("V1-5 personal event calendar", () => {
  it("asks for an account first", async () => {
    await panel.render();
    expect(root.textContent).toContain("Select or add an account first");
  });

  it("lists every tracked event in date order, past ones marked, and venues apart", async () => {
    const account = await accounts.createAccount({ joyClubAccountId: "a" });
    await track(account.id, "3", "2026-10-03T21:00", "Later party", {
      tags: ["Friends"],
    });
    await track(account.id, "1", "2026-09-20", "Past party", {
      attendance: "attended",
      note: "Great",
    });
    await track(account.id, "2", undefined, "Undated party");
    await track(
      account.id,
      "9",
      undefined,
      "Synthetic club",
      { tags: ["Bar"] },
      "venue",
    );
    await panel.render();
    expect(titles()).toEqual([
      "Past party",
      "Later party",
      "Undated party",
      "Synthetic club",
    ]);
    const items = root.querySelectorAll(".joyfox-events__item");
    expect(items[0]!.textContent).toContain("(past)");
    expect(items[0]!.textContent).toContain("Attended");
    expect(items[0]!.textContent).toContain("Great");
    expect(items[1]!.textContent).not.toContain("(past)");
    expect(items[2]!.textContent).toContain("No date");
    expect(root.textContent).toContain("My venues");
    expect(root.textContent).toContain("3 of 3 tracked events shown.");
  });

  it("filters by tag, attendance and note, and searches the text", async () => {
    const account = await accounts.createAccount({ joyClubAccountId: "a" });
    await track(account.id, "1", "2026-10-01", "Masquerade", {
      tags: ["Friends"],
      note: "Bring a mask",
    });
    await track(account.id, "2", "2026-10-02", "Garden party", {
      attendance: "interested",
    });
    await panel.render();
    const filter = () =>
      root.querySelector<HTMLSelectElement>("#joyfox-events-filter")!;
    filter().value = "tag:Friends";
    filter().dispatchEvent(new Event("change"));
    expect(titles()).toEqual(["Masquerade"]);
    filter().value = "interested";
    filter().dispatchEvent(new Event("change"));
    expect(titles()).toEqual(["Garden party"]);
    filter().value = "all";
    filter().dispatchEvent(new Event("change"));
    const search = root.querySelector<HTMLInputElement>(
      "#joyfox-events-search",
    )!;
    search.value = "MASK";
    search.dispatchEvent(new Event("input"));
    expect(titles()).toEqual(["Masquerade"]);
    // A space typed before the next word stays in the field.
    const typed = () =>
      root.querySelector<HTMLInputElement>("#joyfox-events-search")!;
    typed().value = "Garden ";
    typed().dispatchEvent(new Event("input"));
    expect(typed().value).toBe("Garden ");
    expect(titles()).toEqual(["Garden party"]);
    typed().value = "MASK";
    typed().dispatchEvent(new Event("input"));
    expect(root.textContent).toContain("1 of 2 tracked events shown.");
  });

  it("shows only the active account's events", async () => {
    const a = await accounts.createAccount({ joyClubAccountId: "a" });
    const b = await accounts.createAccount({ joyClubAccountId: "b" });
    await track(a.id, "1", "2026-10-01", "Account A party");
    await accounts.setActiveAccount(b.id);
    await panel.render();
    expect(root.textContent).toContain("No tracked events yet");
  });
});

describe("the shared-event switch's status (U29, U31)", () => {
  let settings: MemorySettingsArea;
  const flush = async () => {
    for (let round = 0; round < 10; round += 1)
      await new Promise((resolve) => setTimeout(resolve, 0));
  };
  const toggle = () =>
    root.querySelector<HTMLInputElement>("#joyfox-shared-event-exception")!;
  const statusNode = () =>
    root.querySelector<HTMLElement>(".joyfox-panel__status")!;
  const switchOn = async () => {
    toggle().checked = true;
    toggle().dispatchEvent(new Event("change"));
    await flush();
  };

  beforeEach(async () => {
    settings = new MemorySettingsArea();
    panel = new EventsPanel(
      root,
      listings,
      accounts,
      () => new Date(2026, 8, 26, 12),
      settings,
    );
    const account = await accounts.createAccount({ joyClubAccountId: "a" });
    await track(account.id, "1", "2026-10-01", "Masquerade", {
      tags: ["Friends"],
    });
  });

  afterEach(() => setLocale("en"));

  it("says so as an error and reverts the switch when the setting cannot be saved", async () => {
    await panel.render();
    settings.set = () => Promise.reject(new Error("unavailable"));
    await switchOn();
    expect(toggle().checked).toBe(false);
    expect(statusNode().textContent).toBe(
      "JoyFox could not save this setting. Try again.",
    );
    expect(statusNode().dataset.kind).toBe("error");
    expect(statusNode().getAttribute("role")).toBe("alert");
    expect(toggle().closest(".joyfox-events__exception")).toBe(
      statusNode().closest(".joyfox-events__exception"),
    );
  });

  it("keeps one status node across redraws, and clears it on a filter or search", async () => {
    await panel.render();
    await switchOn();
    expect(settings.items.get(SHARED_EVENT_EXCEPTION_KEY)).toBe(true);
    const node = statusNode();
    expect(node.textContent).toBe("Saved.");
    expect(node.dataset.kind).toBe("info");
    // The page's own storage.onChanged draws the panel again.
    await panel.render();
    expect(statusNode()).toBe(node);
    expect(root.querySelectorAll(".joyfox-panel__status")).toHaveLength(1);
    setLocale("de");
    await panel.render();
    expect(statusNode().textContent).toBe("Gespeichert.");
    setLocale("en");

    const search = root.querySelector<HTMLInputElement>(
      "#joyfox-events-search",
    )!;
    search.value = "mask";
    search.dispatchEvent(new Event("input"));
    expect(statusNode()).toBe(node);
    expect(node.textContent).toBe("");

    await switchOn();
    expect(node.textContent).toBe("Saved.");
    const filter = root.querySelector<HTMLSelectElement>(
      "#joyfox-events-filter",
    )!;
    filter.value = "tag:Friends";
    filter.dispatchEvent(new Event("change"));
    expect(node.textContent).toBe("");
  });
});
