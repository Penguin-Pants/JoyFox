// @vitest-environment jsdom
import "../setup-indexeddb";
import { beforeEach, describe, expect, it } from "vitest";
import { AccountService } from "../../src/accounts/account-service";
import { DataService } from "../../src/data/data-service";
import { confirmTiming } from "../../src/options/confirm";
import { DataPanel, RECORD_PAGE_SIZE } from "../../src/options/data-panel";
import { TemplatePanel } from "../../src/options/template-panel";
import { ENTITY_NAMES } from "../../src/storage/database";
import { repositories } from "../../src/storage/repositories";
import { TemplateService } from "../../src/templates/template-service";
import { MemorySettingsArea } from "../memory-settings";
import { freshDatabase } from "../setup-indexeddb";

let settings: MemorySettingsArea;
let accounts: AccountService;
let templates: TemplateService;
let root: HTMLElement;
let a: string;
let b: string;

beforeEach(async () => {
  await freshDatabase();
  // Tests confirm at once; the double-click test restores the grace period.
  confirmTiming.graceMs = 0;
  settings = new MemorySettingsArea();
  accounts = new AccountService(repositories.extensionAccounts, settings);
  templates = new TemplateService();
  a = (
    await accounts.createAccount({
      joyClubAccountId: "synthetic-a",
      label: "Alpha",
    })
  ).id;
  b = (
    await accounts.createAccount({
      joyClubAccountId: "synthetic-b",
      label: "Beta",
    })
  ).id;
  document.body.replaceChildren();
  root = document.createElement("section");
  document.body.append(root);
});

async function settle(until: () => boolean): Promise<void> {
  for (let attempt = 0; attempt < 500 && !until(); attempt += 1)
    await new Promise((resolve) => setTimeout(resolve, 0));
  if (!until())
    throw new Error(`Never reached the expected state: ${root.innerHTML}`);
}

const text = () => root.textContent ?? "";
const status = () => root.querySelector(".joyfox-panel__status");
const byLabel = (label: string) =>
  root.querySelector<HTMLButtonElement>(`button[aria-label="${label}"]`)!;
// Note: a status message is set before the redraw finishes, so waits key off
// the redrawn DOM, never off the status text alone.
const count = (entity: string) =>
  root.querySelector(`tr[data-entity="${entity}"] .joyfox-data__count`)
    ?.textContent;

const data = () => new DataService(accounts, settings);

describe("M8 data panel", () => {
  let saved: Array<{ name: string; text: string }>;
  let panel: DataPanel;
  let changes: number;

  beforeEach(async () => {
    saved = [];
    changes = 0;
    await templates.save(a, { name: "Hi", body: "Hallo" });
    await templates.save(b, { name: "B only", body: "Beta text" });
    panel = new DataPanel(
      root,
      new DataService(accounts, settings),
      accounts,
      (name, content) => saved.push({ name, text: content }),
      () => (changes += 1),
    );
    await panel.render();
  });

  it("shows a count for every entity of the active account by default", () => {
    expect(root.querySelectorAll("tr[data-entity]")).toHaveLength(
      ENTITY_NAMES.length,
    );
    expect(count("messageTemplates")).toBe("1");
    expect(count("extensionAccounts")).toBe("1");
    // Every row has the same three table cells; the buttons sit in a box
    // inside the last one, so the cell stays a table cell and lines up.
    for (const row of Array.from(root.querySelectorAll("tr[data-entity]"))) {
      expect(Array.from(row.children, (cell) => cell.tagName)).toEqual([
        "TH",
        "TD",
        "TD",
      ]);
      expect(row.lastElementChild?.className).toBe("");
    }
    expect(
      root.querySelector(
        'tr[data-entity="messageTemplates"] td > .joyfox-data__actions button',
      ),
    ).not.toBeNull();
    const select = root.querySelector<HTMLSelectElement>(
      "#joyfox-data-account",
    )!;
    expect(select.value).toBe(a);
    expect(
      root.querySelector("label[for='joyfox-data-account']"),
    ).not.toBeNull();
  });

  it("inspects another account without changing the active one", async () => {
    const select = root.querySelector<HTMLSelectElement>(
      "#joyfox-data-account",
    )!;
    select.value = b;
    select.dispatchEvent(new Event("change"));
    await settle(() => byLabel("Show Message templates") !== null);
    byLabel("Show Message templates").click();
    await settle(() => text().includes("Beta text"));
    expect(text()).not.toContain("Hallo");
    expect((await accounts.getActiveAccount())?.id).toBe(a);
  });

  it("shows records as text, never as markup", async () => {
    await templates.save(a, {
      name: "<img src=x onerror=alert(1)>",
      body: "<b>x</b>",
    });
    await panel.render();
    byLabel("Show Message templates").click();
    await settle(() => text().includes("<b>x</b>"));
    expect(root.querySelector("img")).toBeNull();
    expect(root.querySelector("b")).toBeNull();
  });

  it("deletes a record only on the second click", async () => {
    byLabel("Show Message templates").click();
    await settle(() => root.querySelector(".joyfox-data__record") !== null);
    const id = root.querySelector<HTMLElement>(".joyfox-data__record")!.dataset
      .recordId!;
    byLabel(`Delete record ${id}`).click();
    await settle(() => byLabel(`Confirm: Delete record ${id}`) !== null);
    expect(status()?.textContent).toContain(`delete record ${id}`);
    expect(await templates.list(a)).toHaveLength(1);
    byLabel(`Confirm: Delete record ${id}`).click();
    await settle(() => count("messageTemplates") === "0");
    expect(await templates.list(a)).toEqual([]);
    expect(await templates.list(b)).toHaveLength(1);
    expect(changes).toBe(1);
  });

  it("any other action disarms a pending delete", async () => {
    byLabel("Delete all Message templates").click();
    await settle(
      () => byLabel("Confirm: Delete all Message templates") !== null,
    );
    byLabel("Show Message templates").click();
    await settle(() => byLabel("Delete all Message templates") !== null);
    expect(await templates.list(a)).toHaveLength(1);
  });

  it("an export disarms a pending delete", async () => {
    byLabel("Delete all JoyFox data in this browser").click();
    await settle(
      () => byLabel("Confirm: Delete all JoyFox data in this browser") !== null,
    );
    root.querySelector<HTMLButtonElement>(".joyfox-data__export-all")!.click();
    await settle(
      () =>
        saved.length === 1 &&
        byLabel("Delete all JoyFox data in this browser") !== null,
    );
    expect(await accounts.listAccounts()).toHaveLength(2);
  });

  it("offers no delete for the account record", async () => {
    byLabel("Show Account record").click();
    await settle(() => text().includes("removed only with the whole account"));
    expect(
      root.querySelector('button[aria-label^="Delete all Account"]'),
    ).toBeNull();
    expect(
      root.querySelector('button[aria-label^="Delete record"]'),
    ).toBeNull();
  });

  it("pages through a long record list", async () => {
    for (let i = 0; i < RECORD_PAGE_SIZE + 5; i += 1)
      await repositories.spamPhrases.put(a, {
        id: `phrase-${i}`,
        accountId: a,
        phrase: `invented ${i}`,
        enabled: true,
        createdAt: "2026-09-23T00:00:00.000Z",
        updatedAt: "2026-09-23T00:00:00.000Z",
      });
    await panel.render();
    byLabel("Show Spam phrases").click();
    await settle(() => root.querySelector(".joyfox-data__more") !== null);
    expect(root.querySelectorAll(".joyfox-data__record")).toHaveLength(
      RECORD_PAGE_SIZE,
    );
    root.querySelector<HTMLButtonElement>(".joyfox-data__more")!.click();
    await settle(
      () =>
        root.querySelectorAll(".joyfox-data__record").length ===
        RECORD_PAGE_SIZE + 5,
    );
  });

  it("exports the inspected account and everything as JSON files", async () => {
    root.querySelector<HTMLButtonElement>(".joyfox-data__export")!.click();
    await settle(() => saved.length === 1);
    const account = JSON.parse(saved[0]!.text);
    expect(account.accountId).toBe(a);
    expect(account.entities.messageTemplates[0].body).toBe("Hallo");
    root.querySelector<HTMLButtonElement>(".joyfox-data__export-all")!.click();
    await settle(() => saved.length === 2);
    const all = JSON.parse(saved[1]!.text);
    expect(all.scope).toBe("all");
    expect(all.entities.messageTemplates).toHaveLength(2);
    expect(saved[1]!.name).toMatch(
      /^joyfox-export-all-\d{4}-\d{2}-\d{2}\.json$/,
    );
  });

  it("clears one account's data and keeps the account", async () => {
    byLabel("Delete all data of this account").click();
    await settle(
      () => byLabel("Confirm: Delete all data of this account") !== null,
    );
    byLabel("Confirm: Delete all data of this account").click();
    await settle(() => count("messageTemplates") === "0");
    expect(count("extensionAccounts")).toBe("1");
    expect(await templates.list(b)).toHaveLength(1);
  });

  it("a double-click never confirms a delete", async () => {
    confirmTiming.graceMs = 500;
    const target = () => byLabel("Delete all JoyFox data in this browser");
    target().dispatchEvent(new MouseEvent("click", { detail: 1 }));
    await settle(
      () => byLabel("Confirm: Delete all JoyFox data in this browser") !== null,
    );
    const confirm = byLabel("Confirm: Delete all JoyFox data in this browser");
    // The second click of a double-click, and a fast single click.
    confirm.dispatchEvent(new MouseEvent("click", { detail: 2 }));
    confirm.dispatchEvent(new MouseEvent("click", { detail: 1 }));
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(await accounts.listAccounts()).toHaveLength(2);
    // A double-click on the unarmed button does not arm it twice either.
    confirmTiming.graceMs = 0;
    confirm.dispatchEvent(new MouseEvent("click", { detail: 1 }));
    await settle(() => text().includes("No accounts yet."));
  });

  it("includes every JoyFox setting in the full export", async () => {
    await settings.set({ "joyfox.diagnostics": true });
    root.querySelector<HTMLButtonElement>(".joyfox-data__export-all")!.click();
    await settle(() => saved.length === 1);
    const all = JSON.parse(saved[0]!.text);
    expect(all.settings).toMatchObject({
      "joyfox.activeAccountId": a,
      "joyfox.diagnostics": true,
    });
  });

  it("imports a file after a preview, and only on confirm", async () => {
    // Export account B, then change its template so the import has work.
    root.querySelector<HTMLButtonElement>(".joyfox-data__export-all")!.click();
    await settle(() => saved.length === 1);
    const file = new File([saved[0]!.text], "export.json", {
      type: "application/json",
    });
    await data().clearAccountData(b);
    await panel.render();

    const input = root.querySelector<HTMLInputElement>("#joyfox-data-import")!;
    Object.defineProperty(input, "files", { value: [file] });
    input.dispatchEvent(new Event("change"));
    await settle(
      () => root.querySelector(".joyfox-data__import-confirm") !== null,
    );
    const row = root.querySelector('tr[data-import-entity="messageTemplates"]');
    expect(row?.textContent).toContain("1");
    // Nothing is written by the preview.
    expect(await templates.list(b)).toEqual([]);

    root
      .querySelector<HTMLButtonElement>(".joyfox-data__import-confirm")!
      .click();
    await settle(
      () =>
        text().includes("Import complete") &&
        root.querySelector(".joyfox-data__import-confirm") === null,
    );
    expect((await templates.list(b)).map((t) => t.body)).toEqual(["Beta text"]);
  });

  it("shows only the newest file's preview when reads finish out of order", async () => {
    root.querySelector<HTMLButtonElement>(".joyfox-data__export-all")!.click();
    await settle(() => saved.length === 1);
    let finishFirst!: (text: string) => void;
    const slow = {
      size: 10,
      text: () => new Promise<string>((resolve) => (finishFirst = resolve)),
    } as unknown as File;
    const fast = {
      size: 10,
      text: () => Promise.resolve("not json"),
    } as unknown as File;
    const input = root.querySelector<HTMLInputElement>("#joyfox-data-import")!;
    let files: File[] = [slow];
    Object.defineProperty(input, "files", { get: () => files });
    input.dispatchEvent(new Event("change"));
    files = [fast];
    input.dispatchEvent(new Event("change"));
    await settle(() => text().includes("Nothing was imported"));
    // The first, older choice finishes last with a valid export.
    finishFirst(saved[0]!.text);
    await new Promise((resolve) => setTimeout(resolve, 30));
    expect(root.querySelector(".joyfox-data__import-confirm")).toBeNull();
    expect(text()).toContain("Nothing was imported");
  });

  it("reports a file that is not an export, and imports nothing", async () => {
    const input = root.querySelector<HTMLInputElement>("#joyfox-data-import")!;
    Object.defineProperty(input, "files", {
      value: [new File(["not json"], "x.json")],
    });
    input.dispatchEvent(new Event("change"));
    await settle(() => text().includes("Nothing was imported"));
    expect(root.querySelector(".joyfox-data__import-confirm")).toBeNull();
  });

  it("deletes all JoyFox data after confirmation", async () => {
    await settings.set({ "joyfox.diagnostics": true });
    byLabel("Delete all JoyFox data in this browser").click();
    await settle(
      () => byLabel("Confirm: Delete all JoyFox data in this browser") !== null,
    );
    byLabel("Confirm: Delete all JoyFox data in this browser").click();
    await settle(() => text().includes("No accounts yet."));
    expect(await accounts.listAccounts()).toEqual([]);
    expect(settings.items.size).toBe(0);
  });
});

describe("M10 template panel", () => {
  let panel: TemplatePanel;
  let changes: number;

  beforeEach(async () => {
    changes = 0;
    panel = new TemplatePanel(root, templates, accounts, () => (changes += 1));
    await panel.render();
  });

  const field = <T extends HTMLElement>(id: string) =>
    root.querySelector<T>(`#${id}`)!;

  async function submit(name: string, body: string, folder = "") {
    field<HTMLInputElement>("joyfox-template-name").value = name;
    field<HTMLInputElement>("joyfox-template-folder").value = folder;
    field<HTMLTextAreaElement>("joyfox-template-body").value = body;
    root.querySelector<HTMLFormElement>("form")!.requestSubmit();
  }

  it("adds a template into a folder under the active account", async () => {
    await submit("Confirm", "Du bist dabei!", "Event confirmation");
    await settle(() => byLabel("Edit template Confirm") !== null);
    expect(text()).toContain("Added Confirm.");
    expect(root.querySelector(".joyfox-templates__folder")?.textContent).toBe(
      "Event confirmation",
    );
    expect((await templates.list(a))[0]).toMatchObject({
      name: "Confirm",
      folder: "Event confirmation",
    });
    expect(await templates.list(b)).toEqual([]);
    expect(changes).toBe(1);
    expect(field<HTMLInputElement>("joyfox-template-name").value).toBe("");
    const suggestions = Array.from(
      root.querySelectorAll("#joyfox-template-folders option"),
    ).map((option) => (option as HTMLOptionElement).value);
    expect(suggestions).toContain("Event cancellation");
  });

  it("edits a template in place", async () => {
    await submit("Old", "Old text");
    await settle(() => byLabel("Edit template Old") !== null);
    byLabel("Edit template Old").click();
    await settle(
      () => field<HTMLInputElement>("joyfox-template-name").value === "Old",
    );
    expect(field<HTMLTextAreaElement>("joyfox-template-body").value).toBe(
      "Old text",
    );
    await submit("New", "New text");
    await settle(() => byLabel("Edit template New") !== null);
    expect(text()).toContain("Saved New.");
    const list = await templates.list(a);
    expect(list).toHaveLength(1);
    expect(list[0]).toMatchObject({ name: "New", body: "New text" });
  });

  it("keeps the typed text when saving fails", async () => {
    await submit("   ", "Text");
    await settle(() => status()?.getAttribute("data-kind") === "error");
    expect(status()?.textContent).toContain("Nothing was changed");
    expect(field<HTMLTextAreaElement>("joyfox-template-body").value).toBe(
      "Text",
    );
  });

  it("keeps a draft while a delete is armed, and deletes on the second click", async () => {
    await submit("One", "Text");
    await settle(() => byLabel("Delete template One") !== null);
    field<HTMLTextAreaElement>("joyfox-template-body").value = "Draft";
    byLabel("Delete template One").click();
    await settle(() => byLabel("Confirm deleting template One") !== null);
    expect(field<HTMLTextAreaElement>("joyfox-template-body").value).toBe(
      "Draft",
    );
    byLabel("Confirm deleting template One").click();
    await settle(() => text().includes("No templates yet."));
    expect(text()).toContain("Deleted One.");
    expect(await templates.list(a)).toEqual([]);
  });

  it("keeps the typed text as a new template when the edited one was deleted", async () => {
    await submit("Gone", "Old");
    await settle(() => byLabel("Edit template Gone") !== null);
    byLabel("Edit template Gone").click();
    await settle(
      () => field<HTMLInputElement>("joyfox-template-name").value === "Gone",
    );
    const [stored] = await templates.list(a);
    await templates.delete(a, stored!.id);
    await submit("Kept", "Typed text");
    await settle(() => status()?.getAttribute("data-kind") === "error");
    await settle(
      () =>
        root.querySelector("form")?.getAttribute("aria-label") ===
        "Add a template",
    );
    expect(field<HTMLTextAreaElement>("joyfox-template-body").value).toBe(
      "Typed text",
    );
    root.querySelector<HTMLFormElement>("form")!.requestSubmit();
    await settle(() => byLabel("Edit template Kept") !== null);
  });

  it("refuses to write after the active account changed", async () => {
    await accounts.setActiveAccount(b);
    await submit("Late", "Text");
    await settle(() => text().includes("The active account changed"));
    expect(await templates.list(a)).toEqual([]);
    expect(await templates.list(b)).toEqual([]);
  });

  it("adds one template on a double submit", async () => {
    await submit("Once", "Text");
    root.querySelector<HTMLFormElement>("form")!.requestSubmit();
    await settle(() => byLabel("Edit template Once") !== null);
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(await templates.list(a)).toHaveLength(1);
  });

  it("clears the status when the active account changes", async () => {
    await submit("Secret name", "Text");
    await settle(() => byLabel("Edit template Secret name") !== null);
    expect(status()?.textContent).toContain("Secret name");
    await accounts.setActiveAccount(b);
    await panel.render();
    expect(text()).not.toContain("Secret name");
  });

  it("asks for an account when none is active", async () => {
    await accounts.clearActiveAccount();
    await panel.render();
    expect(text()).toContain("Choose an active account");
    expect(root.querySelector("form")).toBeNull();
  });
});
