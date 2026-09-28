// @vitest-environment jsdom
import "../setup-indexeddb";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { AccountService } from "../../src/accounts/account-service";
import { reportOperation } from "../../src/actions/ignore-delete";
import { DataService } from "../../src/data/data-service";
import type { ActionLog } from "../../src/domain/types";
import { ExtensionError } from "../../src/errors";
import { message } from "../../src/i18n/message";
import { setLocale, t } from "../../src/i18n/translator";
import { confirmTiming } from "../../src/options/confirm";
import { DataPanel, RECORD_PAGE_SIZE } from "../../src/options/data-panel";
import { TemplatePanel } from "../../src/options/template-panel";
import { repositories } from "../../src/storage/repositories";
import { TemplateService } from "../../src/templates/template-service";
import { MemorySettingsArea } from "../memory-settings";
import { freshDatabase } from "../setup-indexeddb";

/**
 * The options page's Templates and "Your data" panels after the UX audit:
 * plain-language texts, record names, failure messages that say what did
 * not happen, and keyboard focus that survives each redraw.
 */

let settings: MemorySettingsArea;
let accounts: AccountService;
let templates: TemplateService;
let root: HTMLElement;
let a: string;
let b: string;

beforeEach(async () => {
  await freshDatabase();
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

afterEach(() => setLocale("en"));

async function settle(until: () => boolean): Promise<void> {
  for (let attempt = 0; attempt < 500 && !until(); attempt += 1)
    await new Promise((resolve) => setTimeout(resolve, 0));
  if (!until())
    throw new Error(`Never reached the expected state: ${root.innerHTML}`);
}

const text = () => root.textContent ?? "";
const status = () => root.querySelector(".joyfox-panel__status");
const byLabel = (label: string) =>
  root.querySelector<HTMLButtonElement>(`button[aria-label="${label}"]`);
const byKey = (key: string) =>
  Array.from(root.querySelectorAll<HTMLElement>("[data-joyfox-focus]")).find(
    (node) => node.dataset.joyfoxFocus === key,
  );
const focused = () =>
  (document.activeElement as HTMLElement | null)?.dataset?.joyfoxFocus ??
  document.activeElement?.tagName;
const count = (entity: string) =>
  root.querySelector(`tr[data-entity="${entity}"] .joyfox-data__count`)
    ?.textContent;

/** Focuses a control and clicks it, as a keyboard user does. */
function press(node: HTMLElement | null | undefined): void {
  node!.focus();
  node!.click();
}

/** Every button's accessible name starts with its visible text (WCAG 2.5.3). */
function expectNamesStartWithText(where: string): void {
  const buttons = Array.from(root.querySelectorAll("button"));
  expect(buttons.length, where).toBeGreaterThan(3);
  for (const node of buttons) {
    const visible = node.textContent ?? "";
    const name = node.getAttribute("aria-label") ?? visible;
    expect(name.startsWith(visible), `${where}: ${name}`).toBe(true);
  }
}

/** A stopped Ignore and Delete run, as the action log stores it. */
function stoppedRun(accountId: string): ActionLog {
  return {
    id: "action:2026-09-27T10:00:00.000Z:000001:x",
    accountId,
    memberId: "2222222",
    conversationId: "personal-1-2",
    action: "quick-ignore-delete",
    steps: [
      { name: "Started", ok: true, at: "2026-09-27T10:00:00.000Z" },
      { name: "DeleteRequested", ok: true, at: "2026-09-27T10:00:01.000Z" },
      { name: "DeleteConfirmed", ok: true, at: "2026-09-27T10:00:02.000Z" },
      {
        name: "Failed",
        ok: false,
        at: "2026-09-27T10:00:03.000Z",
        errorCode: "handoff-failed",
      },
    ],
    createdAt: "2026-09-27T10:00:00.000Z",
    updatedAt: "2026-09-27T10:00:03.000Z",
  };
}

describe("Your data", () => {
  let saved: Array<{ name: string; text: string }>;
  let panel: DataPanel;

  const mount = async (
    service: DataService = new DataService(accounts, settings),
    importRoot?: HTMLElement,
    saveFile: (name: string, text: string) => void = (name, content) =>
      saved.push({ name, text: content }),
  ) => {
    panel = new DataPanel(
      root,
      service,
      accounts,
      saveFile,
      () => undefined,
      importRoot,
    );
    await panel.render();
  };

  beforeEach(async () => {
    saved = [];
    await templates.save(a, { name: "Hi", body: "Hallo" });
  });

  it("points to Import on the Accounts tab when Import is there (U14)", async () => {
    const importRoot = document.createElement("section");
    document.body.append(importRoot);
    await mount(undefined, importRoot);
    const link = root.querySelector<HTMLAnchorElement>('a[href="#accounts"]');
    expect(link?.textContent).toBe("Accounts");
    expect(link?.parentElement?.textContent).toBe(
      "To import a file, go to Accounts.",
    );
    setLocale("de");
    await panel.render();
    expect(
      root.querySelector('a[href="#accounts"]')?.parentElement?.textContent,
    ).toBe("Eine Datei importierst du unter Konten.");
  });

  it("has no pointer when Import is in the panel itself", async () => {
    await mount();
    expect(text()).not.toContain("To import a file");
    expect(root.querySelector("#joyfox-data-import")).not.toBeNull();
  });

  it("links the account record hint to the Accounts tab (U66)", async () => {
    await mount();
    press(byLabel("Show Account record"));
    await settle(() => text().includes("removed only with the whole account"));
    const hint = root.querySelector(
      '.joyfox-data__records a[href="#accounts"]',
    );
    expect(hint?.parentElement?.textContent).toBe(
      "The account record is removed only with the whole account, on the Accounts tab.",
    );
  });

  it("says the account picker does not switch the active account, in German (U69)", async () => {
    setLocale("de");
    await mount();
    expect(
      root.querySelector('label[for="joyfox-data-account"]')?.textContent,
    ).toBe("Konto zum Ansehen (ändert das aktive Konto nicht)");
    // Each account shows its identifier too. Both accounts can share a
    // creation time, so their order is not part of this check.
    expect(
      Array.from(
        root.querySelectorAll<HTMLOptionElement>("#joyfox-data-account option"),
        (option) => option.textContent,
      ).sort(),
    ).toEqual(["Alpha (synthetic-a)", "Beta (synthetic-b)"]);
  });

  it("tells the user to click Save for the snapshot setting (U43)", async () => {
    await mount();
    expect(
      root.querySelector("#joyfox-data-retention-hint")?.textContent,
    ).toMatch(/Click "Save" to apply\.$/u);
  });

  it("lists a record by its name first, with its ID beside it (U68)", async () => {
    await repositories.savedSearches.put(a, {
      id: "search-1",
      accountId: a,
      name: "Near me",
      url: "https://www.joyclub.de/search/",
      filters: {},
      createdAt: "2026-09-27T10:00:00.000Z",
      updatedAt: "2026-09-27T10:00:00.000Z",
    });
    await repositories.eventMetadata.put(a, {
      id: "event:123",
      accountId: a,
      eventId: "123",
      kind: "event",
      title: "Summer party",
      tags: [],
      attendance: "interested",
      createdAt: "2026-09-27T10:00:00.000Z",
      updatedAt: "2026-09-27T10:00:00.000Z",
    });
    await mount();
    const summaries = async (label: string) => {
      press(byLabel(label));
      // The records of this type, not the ones shown before.
      const title = label.replace(/^Show /u, "");
      await settle(
        () =>
          root
            .querySelector(".joyfox-data__records-title")
            ?.textContent?.startsWith(`${title} (`) === true,
      );
      return Array.from(
        root.querySelectorAll(".joyfox-data__record summary"),
        (node) => node.textContent,
      );
    };
    expect(await summaries("Show Saved searches")).toEqual([
      expect.stringMatching(/^Near me: search-1 \(updated /u),
    ]);
    expect(await summaries("Show Event notes")).toEqual([
      expect.stringMatching(/^Summer party: event:123 \(updated /u),
    ]);
    expect(await summaries("Show Account record")).toEqual([
      expect.stringMatching(new RegExp(`^Alpha: ${a} \\(updated `, "u")),
    ]);
    const [template] = await templates.list(a);
    await summaries("Show Message templates");
    press(byLabel(`Delete record Hi (${template!.id})`));
    await settle(
      () => byLabel(`Confirm: Delete record Hi (${template!.id})`) !== null,
    );
    expect(status()?.textContent).toBe(
      `Click "Confirm" to delete record Hi (${template!.id}).`,
    );
  });

  it("names settings in the import result in words, and never shows a stored key (U68)", async () => {
    const importRoot = document.createElement("section");
    document.body.append(importRoot);
    await mount(undefined, importRoot);
    const file = {
      schemaVersion: 1,
      scope: "all",
      exportedAt: "2026-09-27T10:00:00.000Z",
      entities: {},
      settings: {
        "joyfox.locale": "de",
        "joyfox.snapshotRetention": 5,
        "joyfox.quickIgnoreDelete": true,
        "joyfox.somethingNew": 1,
      },
    };
    const input = importRoot.querySelector<HTMLInputElement>(
      "#joyfox-data-import",
    )!;
    Object.defineProperty(input, "files", {
      value: [new File([JSON.stringify(file)], "export.json")],
    });
    input.dispatchEvent(new Event("change"));
    const result = () =>
      importRoot.querySelector(".joyfox-data__import-result")?.textContent ??
      "";
    await settle(() => result().includes("Settings added"));
    expect(result()).toContain(
      "Settings added (only those not set here): language, snapshots kept per member.",
    );
    expect(result()).toContain(
      "they switch features on): Ignore and Delete button.",
    );
    // A setting JoyFox does not know is counted, not named by its key.
    expect(result()).toContain(
      "The file also holds settings that this version of JoyFox does not know. They were not imported.",
    );
    expect(result()).not.toContain("joyfox.");
    setLocale("de");
    await panel.render();
    expect(result()).toContain("Sprache, Momentaufnahmen je Mitglied");
    expect(result()).toContain(
      "Die Datei enthält außerdem Einstellungen, die diese JoyFox-Version nicht kennt.",
    );
    expect(result()).not.toContain("joyfox.");
  });

  it("shows an Ignore and Delete run in plain words above its stored fields (U37)", async () => {
    const log = stoppedRun(a);
    await repositories.actionLogs.put(a, log);
    await mount();
    press(byLabel("Show Action log"));
    await settle(() => root.querySelector(".joyfox-data__record") !== null);
    const details = root.querySelector<HTMLDetailsElement>(
      ".joyfox-data__record details",
    )!;
    details.open = true;
    await settle(() => details.querySelector(".joyfox-data__report") !== null);
    const report = details.querySelector(".joyfox-data__report")!;
    const lines = Array.from(
      report.querySelectorAll("li"),
      (li) => li.textContent,
    );
    expect(lines).toEqual(
      reportOperation(log, Date.now()).lines.map((line) => t(line)),
    );
    expect(lines.length).toBeGreaterThan(2);
    // No state name or error code in the plain words.
    expect(report.textContent).not.toMatch(/DeleteConfirmed|handoff-failed/u);
    // The stored fields stay, below the report.
    const fields = details.querySelector(":scope > .joyfox-data__fields")!;
    expect(
      report.compareDocumentPosition(fields) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(fields.textContent).toContain("handoff-failed");
    // And in German after a language change.
    setLocale("de");
    await panel.render();
    const german = root.querySelector(".joyfox-data__report li")?.textContent;
    expect(german).toBe(t(reportOperation(log, Date.now()).lines[0]!));
  });

  it("says a failed export exported nothing, not that nothing was deleted (U36)", async () => {
    await mount(undefined, undefined, () => {
      throw new Error("download blocked");
    });
    press(root.querySelector<HTMLButtonElement>(".joyfox-data__export"));
    await settle(() => status()?.getAttribute("data-kind") === "error");
    expect(status()?.textContent).toBe(
      "JoyFox could not create the export. Nothing was exported. Try again.",
    );

    class Refusing extends DataService {
      override exportAll(): never {
        throw new ExtensionError("IdentityMismatch", "refused", {
          display: message("error.account.gone"),
        });
      }
    }
    await mount(new Refusing(accounts, settings));
    press(root.querySelector<HTMLButtonElement>(".joyfox-data__export-all"));
    await settle(() => status()?.getAttribute("data-kind") === "error");
    expect(status()?.textContent).toBe(
      "That account no longer exists. Nothing was exported. Try again.",
    );
    expect(text()).not.toContain("Nothing was deleted");

    // An error without its own text gets the panel's failure text, never
    // a generic line for its code.
    class Plain extends DataService {
      override exportAll(): never {
        throw new ExtensionError("StorageError", "storage.local unavailable");
      }
    }
    await mount(new Plain(accounts, settings));
    press(root.querySelector<HTMLButtonElement>(".joyfox-data__export-all"));
    await settle(() => status()?.getAttribute("data-kind") === "error");
    expect(status()?.textContent).toBe(
      "JoyFox could not create the export. Nothing was exported. Try again.",
    );
  });

  it("says a failed delete may have stopped part-way, and what to do", async () => {
    class Failing extends DataService {
      override deleteEverything(): never {
        throw new Error("write refused");
      }
    }
    await mount(new Failing(accounts, settings));
    press(byLabel("Delete all JoyFox data in this browser"));
    await settle(
      () => byLabel("Confirm: Delete all JoyFox data in this browser") !== null,
    );
    press(byLabel("Confirm: Delete all JoyFox data in this browser"));
    await settle(() => status()?.getAttribute("data-kind") === "error");
    expect(status()?.textContent).toBe(
      "JoyFox could not finish the delete. Some records may be deleted already: the counts shown now are what is still stored. Try again.",
    );
  });

  it("gives a next step when a file cannot be checked or imported", async () => {
    const importRoot = document.createElement("section");
    document.body.append(importRoot);
    const choose = (service: DataService) => async () => {
      await mount(service, importRoot);
      const input = importRoot.querySelector<HTMLInputElement>(
        "#joyfox-data-import",
      )!;
      Object.defineProperty(input, "files", {
        value: [new File(["{}"], "export.json")],
      });
      input.dispatchEvent(new Event("change"));
      await settle(
        () =>
          importRoot
            .querySelector(".joyfox-panel__status")
            ?.getAttribute("data-kind") === "error",
      );
      return importRoot.querySelector(".joyfox-panel__status")?.textContent;
    };
    class Unchecked extends DataService {
      override previewImport(): never {
        throw new Error("read failed");
      }
    }
    expect(await choose(new Unchecked(accounts, settings))()).toBe(
      "JoyFox could not check that file. Nothing was imported. Choose the file again. If it still fails, reload the page, or export the file from JoyFox again.",
    );
    class Unfinished extends DataService {
      override async previewImport() {
        return { signature: "x" } as never;
      }
      override applyImport(): never {
        throw new Error("write failed");
      }
    }
    expect(await choose(new Unfinished(accounts, settings))()).toBe(
      "JoyFox could not finish the import. Choose the file again to try again: records already stored are not added twice.",
    );
  });

  it("says a failed snapshot setting was not changed (U36)", async () => {
    let refuse = false;
    class Failing extends DataService {
      override async setSnapshotRetention(keep: number): Promise<number> {
        if (refuse)
          throw new ExtensionError("IdentityMismatch", "refused", {
            display: message("error.account.gone"),
          });
        throw new ExtensionError("StorageError", `cannot store ${keep}`);
      }
    }
    await mount(new Failing(accounts, settings));
    const input = root.querySelector<HTMLInputElement>(
      "#joyfox-data-retention",
    )!;
    // A higher number saves at once (a lower one asks first).
    input.value = "30";
    press(
      root.querySelector<HTMLButtonElement>(".joyfox-data__retention-save"),
    );
    // Waits for the redraw, which comes after the message.
    await settle(() => root.querySelector("#joyfox-data-retention") !== input);
    expect(status()?.textContent).toBe(
      "JoyFox could not save the setting. The field shows the number in use now. Try again.",
    );
    expect(
      root.querySelector<HTMLInputElement>("#joyfox-data-retention")?.value,
    ).toBe("20");
    refuse = true;
    press(
      root.querySelector<HTMLButtonElement>(".joyfox-data__retention-save"),
    );
    await settle(
      () =>
        status()?.textContent?.includes("The setting was not changed") ?? false,
    );
    expect(status()?.textContent).toBe(
      "That account no longer exists. The setting was not changed. Try again.",
    );
  });

  it("still says nothing was deleted when a delete is refused", async () => {
    class Refusing extends DataService {
      override deleteEntity(): never {
        throw new ExtensionError("IdentityMismatch", "gone", {
          display: message("error.account.gone"),
        });
      }
    }
    await mount(new Refusing(accounts, settings));
    press(byLabel("Delete all Message templates"));
    await settle(
      () => byLabel("Confirm: Delete all Message templates") !== null,
    );
    press(byLabel("Confirm: Delete all Message templates"));
    await settle(() => status()?.getAttribute("data-kind") === "error");
    expect(status()?.textContent).toBe(
      "That account no longer exists. Nothing was deleted.",
    );
  });

  it("asks to reload the page when stored data cannot be read (U36)", async () => {
    class Unreadable extends AccountService {
      override listAccounts(): never {
        throw new Error("read failed");
      }
    }
    panel = new DataPanel(
      root,
      new DataService(accounts, settings),
      new Unreadable(repositories.extensionAccounts, settings),
    );
    await panel.render();
    expect(text()).toBe(
      "JoyFox could not read its stored data. Nothing was changed. Reload the page to try again.",
    );
  });

  it("gives an import error a plain next step (U36)", async () => {
    await mount();
    const input = root.querySelector<HTMLInputElement>("#joyfox-data-import")!;
    Object.defineProperty(input, "files", {
      value: [
        new File(
          [JSON.stringify({ scope: "all", schemaVersion: "x", entities: {} })],
          "x.json",
        ),
      ],
    });
    input.dispatchEvent(new Event("change"));
    await settle(() => text().includes("Nothing was imported"));
    expect(status()?.textContent).toBe(
      "The file does not say which JoyFox version made it. Choose a file exported by JoyFox. Nothing was imported.",
    );
  });

  describe("keyboard focus across redraws (U50)", () => {
    it("moves to the records heading after Show, and stays on Hide", async () => {
      await mount();
      press(byLabel("Show Message templates"));
      await settle(() => root.querySelector(".joyfox-data__records") !== null);
      const heading = root.querySelector<HTMLElement>(
        ".joyfox-data__records-title",
      )!;
      expect(document.activeElement).toBe(heading);
      expect(heading.tabIndex).toBe(-1);
      press(byLabel("Hide Message templates"));
      await settle(() => root.querySelector(".joyfox-data__records") === null);
      expect(focused()).toBe("show:messageTemplates");
    });

    it("stays on a delete when it arms, then moves to the table when the type is emptied", async () => {
      await mount();
      press(byLabel("Delete all Message templates"));
      await settle(
        () => byLabel("Confirm: Delete all Message templates") !== null,
      );
      expect(document.activeElement).toBe(
        byLabel("Confirm: Delete all Message templates"),
      );
      press(byLabel("Confirm: Delete all Message templates"));
      await settle(() => count("messageTemplates") === "0");
      expect(document.activeElement).toBe(
        root.querySelector(".joyfox-data__counts"),
      );
    });

    it("moves to the records heading after a record is deleted", async () => {
      await mount();
      const [template] = await templates.list(a);
      press(byLabel("Show Message templates"));
      await settle(() => root.querySelector(".joyfox-data__record") !== null);
      const label = `Delete record Hi (${template!.id})`;
      press(byLabel(label));
      await settle(() => byLabel(`Confirm: ${label}`) !== null);
      expect(focused()).toBe(`delete:${template!.id}`);
      press(byLabel(`Confirm: ${label}`));
      await settle(() => count("messageTemplates") === "0");
      expect(focused()).toBe("records-heading");
    });

    it("keeps focus on the account picker when it changes the account", async () => {
      await mount();
      const select = root.querySelector<HTMLSelectElement>(
        "#joyfox-data-account",
      )!;
      select.focus();
      select.value = b;
      select.dispatchEvent(new Event("change"));
      await settle(
        () =>
          root.querySelector<HTMLSelectElement>("#joyfox-data-account") !==
          select,
      );
      expect(document.activeElement).toBe(
        root.querySelector("#joyfox-data-account"),
      );
    });

    it("moves to the first new record after Show more", async () => {
      for (let i = 0; i < RECORD_PAGE_SIZE + 2; i += 1)
        await repositories.spamPhrases.put(a, {
          id: `phrase-${String(i).padStart(3, "0")}`,
          accountId: a,
          phrase: `invented ${i}`,
          enabled: true,
          createdAt: "2026-09-23T00:00:00.000Z",
          updatedAt: "2026-09-23T00:00:00.000Z",
        });
      await mount();
      press(byLabel("Show Spam phrases"));
      await settle(() => root.querySelector(".joyfox-data__more") !== null);
      const next = root.querySelectorAll(".joyfox-data__record").length;
      press(root.querySelector<HTMLButtonElement>(".joyfox-data__more"));
      await settle(() => root.querySelector(".joyfox-data__more") === null);
      const records = root.querySelectorAll<HTMLElement>(
        ".joyfox-data__record",
      );
      expect(document.activeElement).toBe(
        records[next]!.querySelector("summary"),
      );
    });

    it("returns to the file chooser after an import, though disabling it dropped focus", async () => {
      const importRoot = document.createElement("section");
      document.body.append(importRoot);
      await mount(undefined, importRoot);
      const input = importRoot.querySelector<HTMLInputElement>(
        "#joyfox-data-import",
      )!;
      Object.defineProperty(input, "files", {
        value: [new File(["not json"], "x.json")],
      });
      input.focus();
      input.dispatchEvent(new Event("change"));
      // Firefox drops focus from a disabled control; jsdom keeps it.
      const elsewhere = document.createElement("button");
      document.body.append(elsewhere);
      elsewhere.focus();
      elsewhere.remove();
      expect(document.activeElement).toBe(document.body);
      await settle(
        () =>
          importRoot.querySelector<HTMLInputElement>("#joyfox-data-import")
            ?.disabled === false,
      );
      expect(document.activeElement).toBe(
        importRoot.querySelector("#joyfox-data-import"),
      );
    });
  });

  it("starts every accessible name with the visible text, in English and German (U56)", async () => {
    await mount();
    press(byLabel("Show Message templates"));
    await settle(() => root.querySelector(".joyfox-data__record") !== null);
    for (const locale of ["en", "de"] as const) {
      setLocale(locale);
      await panel.render();
      expectNamesStartWithText(`${locale} unarmed`);
    }
    setLocale("en");
    await panel.render();
    press(byLabel("Delete all Message templates"));
    await settle(
      () => byLabel("Confirm: Delete all Message templates") !== null,
    );
    for (const locale of ["en", "de"] as const) {
      setLocale(locale);
      await panel.render();
      expectNamesStartWithText(`${locale} armed`);
    }
    expect(
      root
        .querySelector('tr[data-entity="messageTemplates"] .joyfox-data__show')
        ?.getAttribute("aria-label"),
    ).toBe("Ausblenden: Nachrichtenvorlagen");
  });
});

describe("Templates", () => {
  let panel: TemplatePanel;

  beforeEach(async () => {
    panel = new TemplatePanel(root, templates, accounts);
    await panel.render();
  });

  const field = <T extends HTMLElement>(id: string) =>
    root.querySelector<T>(`#${id}`)!;

  function fill(name: string, body: string, folder = ""): void {
    field<HTMLInputElement>("joyfox-template-name").value = name;
    field<HTMLInputElement>("joyfox-template-folder").value = folder;
    field<HTMLTextAreaElement>("joyfox-template-body").value = body;
  }

  async function add(name: string, body: string, folder = ""): Promise<void> {
    fill(name, body, folder);
    root.querySelector<HTMLFormElement>("form")!.requestSubmit();
    await settle(() => byLabel(`Edit template ${name}`) !== null);
  }

  /** Clicks the form's submit button with focus on it. */
  function submitWithButton(): HTMLButtonElement {
    const submit = root.querySelector<HTMLButtonElement>(
      ".joyfox-panel__submit",
    )!;
    submit.focus();
    submit.form!.requestSubmit(submit);
    return submit;
  }

  /** Firefox drops focus from a disabled button; jsdom keeps it. */
  function dropFocus(): void {
    const elsewhere = document.createElement("button");
    document.body.append(elsewhere);
    elsewhere.focus();
    elsewhere.remove();
  }

  it("links to the Accounts tab when no account is active (U66)", async () => {
    await accounts.clearActiveAccount();
    await panel.render();
    const link = root.querySelector<HTMLAnchorElement>('a[href="#accounts"]');
    expect(link?.parentElement?.textContent).toBe(
      "Choose an active account on the Accounts tab to store templates.",
    );
  });

  it("asks to reload the page when templates cannot be read (U36)", async () => {
    class Unreadable extends TemplateService {
      override list(): never {
        throw new Error("read failed");
      }
    }
    await new TemplatePanel(root, new Unreadable(), accounts).render();
    expect(text()).toBe(
      "JoyFox could not read your templates. No template was changed. Reload the page to try again.",
    );
  });

  describe("keyboard focus across redraws (U50)", () => {
    it("stays on Delete when it arms, then moves to the folder list", async () => {
      await add("One", "Text");
      await add("Two", "Text");
      const [one] = (await templates.list(a)).filter((x) => x.name === "One");
      press(byLabel("Delete template One"));
      await settle(() => byLabel("Confirm delete: template One") !== null);
      expect(document.activeElement).toBe(
        byLabel("Confirm delete: template One"),
      );
      expect(focused()).toBe(`delete:${one!.id}`);
      press(byLabel("Confirm delete: template One"));
      // Waits for the redraw, which comes after the message.
      await settle(() => byLabel("Confirm delete: template One") === null);
      expect(text()).toContain("Deleted One.");
      expect(focused()).toBe("folder:General");
      expect(document.activeElement?.getAttribute("aria-label")).toBe(
        "Templates in General",
      );
    });

    it("moves to the name field after the last template is deleted", async () => {
      await add("One", "Text");
      press(byLabel("Delete template One"));
      await settle(() => byLabel("Confirm delete: template One") !== null);
      press(byLabel("Confirm delete: template One"));
      await settle(() => text().includes("No templates yet."));
      expect(document.activeElement).toBe(field("joyfox-template-name"));
    });

    it("returns to the template's Edit button after saving changes", async () => {
      await add("Old", "Text");
      press(byLabel("Edit template Old"));
      await settle(
        () => field<HTMLInputElement>("joyfox-template-name").value === "Old",
      );
      expect(document.activeElement).toBe(field("joyfox-template-name"));
      fill("New", "Changed");
      submitWithButton();
      dropFocus();
      await settle(() => byLabel("Edit template New") !== null);
      expect(document.activeElement).toBe(byLabel("Edit template New"));
    });

    it("stays on Add template after an add, though disabling it dropped focus", async () => {
      fill("First", "Text");
      submitWithButton();
      dropFocus();
      expect(document.activeElement).toBe(document.body);
      await settle(() => byLabel("Edit template First") !== null);
      expect(document.activeElement).toBe(
        root.querySelector(".joyfox-panel__submit"),
      );
    });

    it("returns to the button when a save fails", async () => {
      fill("   ", "Text");
      const submit = submitWithButton();
      dropFocus();
      await settle(() => status()?.getAttribute("data-kind") === "error");
      await settle(() => !submit.disabled);
      expect(document.activeElement).toBe(submit);
    });

    it("returns to the Edit button after Cancel editing", async () => {
      await add("Kept", "Text");
      press(byLabel("Edit template Kept"));
      await settle(
        () => root.querySelector(".joyfox-templates__cancel") !== null,
      );
      press(root.querySelector<HTMLButtonElement>(".joyfox-templates__cancel"));
      await settle(
        () => root.querySelector(".joyfox-templates__cancel") === null,
      );
      expect(document.activeElement).toBe(byLabel("Edit template Kept"));
    });
  });

  it("starts every accessible name with the visible text, in English and German (U56)", async () => {
    await add("One", "Text");
    await add("Two", "Text");
    press(byLabel("Delete template Two"));
    await settle(() => byLabel("Confirm delete: template Two") !== null);
    for (const locale of ["en", "de"] as const) {
      setLocale(locale);
      await panel.render();
      expectNamesStartWithText(locale);
    }
    expect(
      byKey(
        root.querySelector<HTMLElement>(".joyfox-panel__remove")!.dataset
          .joyfoxFocus!,
      )?.getAttribute("aria-label"),
    ).toBe("Löschen: Vorlage One");
  });
});
