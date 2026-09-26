// @vitest-environment jsdom
import "../setup-indexeddb";
import { beforeEach, describe, expect, it } from "vitest";
import { AccountService } from "../../src/accounts/account-service";
import { EventTrackerService } from "../../src/events/event-service";
import { EventsPanel } from "../../src/options/events-panel";
import { repositories } from "../../src/storage/repositories";
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
