// @vitest-environment jsdom
import "../setup-indexeddb";
import { beforeEach, describe, expect, it } from "vitest";
import { AccountService } from "../../src/accounts/account-service";
import {
  AccountPanel,
  mountAccountPanel,
  PANEL_CLASS,
} from "../../src/options/account-panel";
import { repositories } from "../../src/storage/repositories";
import { freshDatabase } from "../setup-indexeddb";
import { MemorySettingsArea } from "../memory-settings";

let service: AccountService;
let root: HTMLElement;

beforeEach(async () => {
  await freshDatabase();
  service = new AccountService(
    repositories.extensionAccounts,
    new MemorySettingsArea(),
  );
  document.body.replaceChildren();
  root = document.createElement("section");
  document.body.append(root);
});

const text = () => root.textContent ?? "";
const button = (selector: string) =>
  root.querySelector<HTMLButtonElement>(selector);
const items = () => Array.from(root.querySelectorAll(".joyfox-panel__item"));
const status = () => root.querySelector(".joyfox-panel__status");
const failed = () => status()?.getAttribute("data-kind") === "error";

/**
 * A handler persists and then re-renders, which spans several IndexedDB ticks,
 * and it updates the live region before the re-render finishes. Waiting on an
 * explicit predicate therefore beats counting ticks or watching the text.
 */
async function settle(until: () => boolean): Promise<void> {
  for (let attempt = 0; attempt < 500 && !until(); attempt += 1)
    await new Promise((resolve) => setTimeout(resolve, 0));
  if (!until())
    throw new Error(
      `The panel never reached the expected state: ${JSON.stringify(root.innerHTML)}`,
    );
}

async function click(node: HTMLElement, until: () => boolean): Promise<void> {
  node.click();
  await settle(until);
}

async function addAccount(identifier: string, label?: string): Promise<void> {
  const expected = items().length + 1;
  const id = root.querySelector<HTMLInputElement>("#joyfox-account-identifier");
  const labelInput = root.querySelector<HTMLInputElement>(
    "#joyfox-account-label",
  );
  id!.value = identifier;
  if (label !== undefined) labelInput!.value = label;
  const form = root.querySelector<HTMLFormElement>("form");
  form!.dispatchEvent(new Event("submit", { cancelable: true, bubbles: true }));
  await settle(() => items().length === expected || failed());
}

describe("M7 options account switcher", () => {
  it("states that no account is active before one is added", async () => {
    await mountAccountPanel(root, service);
    expect(root.classList.contains(PANEL_CLASS)).toBe(true);
    expect(text()).toContain("None selected");
    expect(text()).toContain("No accounts yet");
    expect(root.getAttribute("aria-labelledby")).toBe(
      "joyfox-accounts-heading",
    );
  });

  it("does not claim to detect the JoyClub login", async () => {
    await mountAccountPanel(root, service);
    expect(text()).toContain(
      "JoyFox cannot read which JoyClub login a tab uses",
    );
  });

  it("marks the active account in words, not only by styling", async () => {
    await mountAccountPanel(root, service);
    await addAccount("synthetic-a", "Account A");
    await addAccount("synthetic-b", "Account B");
    const rows = items();
    expect(rows).toHaveLength(2);
    const active = rows.find(
      (item) => item.getAttribute("aria-current") === "true",
    );
    expect(active?.textContent).toContain("Account A");
    expect(active?.textContent).toContain("Active");
    expect(rows[1]?.textContent).toContain("Not active");
  });

  it("switches the active account and persists the choice", async () => {
    await mountAccountPanel(root, service);
    await addAccount("synthetic-a", "Account A");
    await addAccount("synthetic-b", "Account B");
    await click(
      button(".joyfox-panel__activate")!,
      () => items()[1]?.getAttribute("aria-current") === "true",
    );
    expect((await service.getActiveAccount())?.label).toBe("Account B");
    expect(text()).toContain("Active account:");
    expect(text()).toContain("Active account is now Account B.");
  });

  it("requires a second click before deleting an account and its data", async () => {
    await mountAccountPanel(root, service);
    await addAccount("synthetic-a", "Account A");
    await click(button(".joyfox-panel__remove")!, () =>
      text().includes("Click again to confirm"),
    );
    expect(await service.listAccounts()).toHaveLength(1);
    await click(button(".joyfox-panel__remove")!, () => items().length === 0);
    expect(await service.listAccounts()).toEqual([]);
    expect(text()).toContain("Removed Account A");
  });

  it("disarms a pending removal when another action intervenes", async () => {
    await mountAccountPanel(root, service);
    await addAccount("synthetic-a", "Account A");
    await addAccount("synthetic-b", "Account B");
    await click(button(".joyfox-panel__remove")!, () =>
      text().includes("Click again to confirm"),
    );
    await click(
      button(".joyfox-panel__activate")!,
      () => items()[1]?.getAttribute("aria-current") === "true",
    );
    // The arming click is spent: removal must ask again rather than delete.
    await click(button(".joyfox-panel__remove")!, () =>
      text().includes("Click again to confirm"),
    );
    expect(await service.listAccounts()).toHaveLength(2);
  });

  it("keeps one live region across renders", async () => {
    const panel = new AccountPanel(root, service);
    await panel.render();
    const first = root.querySelector("[aria-live]");
    await panel.render();
    expect(root.querySelectorAll("[aria-live]")).toHaveLength(1);
    expect(root.querySelector("[aria-live]")).toBe(first);
  });

  it("reports a rejected account without changing stored data", async () => {
    await mountAccountPanel(root, service);
    await addAccount("synthetic-a", "Account A");
    await addAccount("synthetic-a", "Duplicate");
    expect(items()).toHaveLength(1);
    expect(failed()).toBe(true);
    expect(status()?.getAttribute("role")).toBe("alert");
    expect(status()?.textContent).toContain("already registered");
    expect(status()?.textContent).toContain("Nothing was changed.");
    expect(await service.listAccounts()).toHaveLength(1);
  });

  it("renders a label as text rather than markup", async () => {
    await mountAccountPanel(root, service);
    await addAccount("synthetic-a", "<img src=x onerror=alert(1)>");
    expect(root.querySelector("img")).toBeNull();
    expect(text()).toContain("<img src=x onerror=alert(1)>");
  });

  it("mounts once per host element", async () => {
    const first = await mountAccountPanel(root, service);
    const second = await mountAccountPanel(root, service);
    expect(second).toBe(first);
    expect(root.querySelectorAll("form")).toHaveLength(1);
    expect(root.getAttribute("data-joyfox-account-panel")).toBe("true");
  });

  it("re-rendering replaces the panel instead of duplicating it", async () => {
    const panel = new AccountPanel(root, service);
    await panel.render();
    await panel.render();
    expect(root.querySelectorAll("form")).toHaveLength(1);
    expect(root.querySelectorAll("h2")).toHaveLength(1);
  });

  it("labels every control for assistive technology", async () => {
    await mountAccountPanel(root, service);
    await addAccount("synthetic-a", "Account A");
    await addAccount("synthetic-b", "Account B");
    for (const control of Array.from(root.querySelectorAll("button")))
      expect(
        control.getAttribute("aria-label") ?? control.textContent ?? "",
      ).not.toBe("");
    for (const input of Array.from(root.querySelectorAll("input")))
      expect(root.querySelector(`label[for="${input.id}"]`)).not.toBeNull();
  });
});
