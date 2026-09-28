// @vitest-environment jsdom
import "../setup-indexeddb";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { AccountService } from "../../src/accounts/account-service";
import { setLocale } from "../../src/i18n/translator";
import {
  AccountPanel,
  mountAccountPanel,
  PANEL_CLASS,
} from "../../src/options/account-panel";
import { confirmTiming } from "../../src/options/confirm";
import { repositories } from "../../src/storage/repositories";
import { freshDatabase } from "../setup-indexeddb";
import { MemorySettingsArea } from "../memory-settings";

let service: AccountService;
let root: HTMLElement;

beforeEach(async () => {
  await freshDatabase();
  // Tests confirm at once; the double-click test restores the grace period.
  confirmTiming.graceMs = 0;
  service = new AccountService(
    repositories.extensionAccounts,
    new MemorySettingsArea(),
  );
  document.body.replaceChildren();
  root = document.createElement("section");
  document.body.append(root);
});

afterEach(() => setLocale("en"));

const text = () => root.textContent ?? "";
const button = (selector: string) =>
  root.querySelector<HTMLButtonElement>(selector);
const items = () => Array.from(root.querySelectorAll(".joyfox-panel__item"));
const status = () => root.querySelector(".joyfox-panel__status");
// The status updates before the re-render, so wait on the armed node itself.
const armed = () =>
  button(".joyfox-panel__remove")?.textContent === "Confirm removal";
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
    // The label with the identifier, so similar labels stay apart.
    expect(text()).toContain("Active account is now Account B (synthetic-b).");
  });

  it("requires a second click before deleting an account and its data", async () => {
    await mountAccountPanel(root, service);
    await addAccount("synthetic-a", "Account A");
    await click(button(".joyfox-panel__remove")!, armed);
    expect(text()).toContain("Click again to confirm");
    expect(await service.listAccounts()).toHaveLength(1);
    await click(button(".joyfox-panel__remove")!, () => items().length === 0);
    expect(await service.listAccounts()).toEqual([]);
    expect(text()).toContain("Removed Account A");
  });

  it("a double-click never confirms a removal", async () => {
    confirmTiming.graceMs = 500;
    await mountAccountPanel(root, service);
    await addAccount("synthetic-a", "Account A");
    // The first click of a double-click arms; its second click is ignored.
    button(".joyfox-panel__remove")!.dispatchEvent(
      new MouseEvent("click", { detail: 1 }),
    );
    button(".joyfox-panel__remove")!.dispatchEvent(
      new MouseEvent("click", { detail: 2 }),
    );
    await settle(armed);
    const confirm = button(".joyfox-panel__remove")!;
    // The second click of a double-click on the armed node, and a fast single click.
    confirm.dispatchEvent(new MouseEvent("click", { detail: 2 }));
    confirm.dispatchEvent(new MouseEvent("click", { detail: 1 }));
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(await service.listAccounts()).toHaveLength(1);
    expect(items()).toHaveLength(1);
    // After the grace period, a single click confirms.
    confirmTiming.graceMs = 0;
    confirm.dispatchEvent(new MouseEvent("click", { detail: 1 }));
    await settle(() => items().length === 0);
    expect(await service.listAccounts()).toEqual([]);
  });

  it("disarms a pending removal when another action intervenes", async () => {
    await mountAccountPanel(root, service);
    await addAccount("synthetic-a", "Account A");
    await addAccount("synthetic-b", "Account B");
    await click(button(".joyfox-panel__remove")!, armed);
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
    expect(status()?.textContent).toBe(
      "An account with this identifier is already in the list. Use that account, or enter another identifier. Nothing was changed.",
    );
    expect(await service.listAccounts()).toHaveLength(1);
  });

  it("says in plain words when the account to use was removed elsewhere", async () => {
    await mountAccountPanel(root, service);
    await addAccount("synthetic-a", "Account A");
    await addAccount("synthetic-b", "Account B");
    const other = (await service.listAccounts()).find(
      (account) => account.label === "Account B",
    )!;
    // Another tab removes B; this tab has not redrawn yet.
    await service.deleteAccount(other.id);
    await click(button(".joyfox-panel__activate")!, failed);
    expect(status()?.textContent).toBe(
      "That account is no longer in the list, for example because it was removed in another tab. Nothing was changed.",
    );
    expect((await service.getActiveAccount())?.label).toBe("Account A");
  });

  it("asks for the identifier when only spaces were typed", async () => {
    await mountAccountPanel(root, service);
    await addAccount("   ");
    expect(failed()).toBe(true);
    expect(status()?.textContent).toBe(
      "Enter your JoyClub account identifier first. Nothing was changed.",
    );
    expect(await service.listAccounts()).toHaveLength(0);
  });

  it("gives a next step when a change cannot be stored", async () => {
    class Failing extends AccountService {
      override createAccount(): never {
        throw new Error("write refused");
      }
    }
    await mountAccountPanel(
      root,
      new Failing(repositories.extensionAccounts, new MemorySettingsArea()),
    );
    await addAccount("synthetic-a");
    expect(failed()).toBe(true);
    expect(status()?.textContent).toBe(
      "JoyFox could not save that change. Nothing was changed. Try again. If it keeps failing, reload the page.",
    );
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

describe("account panel redraw", () => {
  it("keeps text typed into the add form while a redraw reads storage", async () => {
    const panel = await mountAccountPanel(root, service);
    const identifier = () =>
      root.querySelector<HTMLInputElement>("#joyfox-account-identifier")!;
    identifier().value = "typed";
    // Hold the redraw's first read until the user has typed more.
    let release!: () => void;
    const held = new Promise<void>((resolve) => (release = resolve));
    const list = service.listAccounts.bind(service);
    service.listAccounts = async () => {
      await held;
      return list();
    };
    const redraw = panel.render();
    identifier().value = "typed-login";
    release();
    await redraw;
    expect(identifier().value).toBe("typed-login");
  });
});

/** The keyed control that has focus, or the tag name when none has a key. */
const focused = () =>
  document.activeElement?.getAttribute("data-joyfox-focus") ??
  document.activeElement?.tagName;

/** Focuses a control and clicks it, as a keyboard user does. */
async function press(node: HTMLElement, until: () => boolean): Promise<void> {
  node.focus();
  await click(node, until);
}

const rowOf = (identifier: string) =>
  items().find((item) => item.textContent?.includes(`(${identifier})`)) ??
  items().find((item) => item.textContent?.startsWith(identifier));
const inRow = (identifier: string, selector: string) =>
  rowOf(identifier)!.querySelector<HTMLButtonElement>(selector)!;
const armedIn = (identifier: string) => () =>
  inRow(identifier, ".joyfox-panel__remove").textContent === "Confirm removal";

describe("account identifier and label (U2)", () => {
  it("explains both fields, linked to them for assistive technology", async () => {
    await mountAccountPanel(root, service);
    for (const [id, hint] of [
      ["joyfox-account-identifier", "Your JoyClub nickname works well."],
      ["joyfox-account-label", "Only JoyFox shows this label."],
    ] as const) {
      const input = root.querySelector<HTMLInputElement>(`#${id}`)!;
      const described = input.getAttribute("aria-describedby")!;
      expect(root.querySelector(`#${described}`)?.textContent).toContain(hint);
    }
    expect(text()).toContain(
      "JoyFox uses it only to tell your accounts apart and to match imports. JoyFox does not check it.",
    );
  });

  it("shows each account's identifier beside its label", async () => {
    await mountAccountPanel(root, service);
    await addAccount("drclaw", "Me");
    await addAccount("second-login");
    expect(
      items().map(
        (item) => item.querySelector(".joyfox-panel__item-name")?.textContent,
      ),
    ).toEqual(["Me (drclaw)", "second-login"]);
    expect(root.querySelector(".joyfox-panel__active-value")?.textContent).toBe(
      "Me (drclaw)",
    );
  });
});

describe("renaming an account", () => {
  const renameField = () =>
    root.querySelector<HTMLInputElement>("#joyfox-account-rename");

  async function openRename(identifier: string): Promise<HTMLInputElement> {
    await press(inRow(identifier, ".joyfox-account__rename"), () =>
      Boolean(renameField()),
    );
    return renameField()!;
  }

  it("changes only the label, with Enter, and returns focus to Rename", async () => {
    await mountAccountPanel(root, service);
    await addAccount("drclaw", "Old");
    const [before] = await service.listAccounts();
    const input = await openRename("drclaw");
    // The field opens focused, with the label selected to type over.
    expect(document.activeElement).toBe(input);
    expect([input.selectionStart, input.selectionEnd]).toEqual([0, 3]);
    expect(root.querySelector(`label[for="${input.id}"]`)?.textContent).toBe(
      "New display label for drclaw",
    );
    input.value = "Me";
    // Enter in a text field submits its form.
    input.form!.requestSubmit();
    await settle(() => !renameField());
    expect(status()?.textContent).toBe(
      "Label saved. JoyFox now shows this account as Me (drclaw).",
    );
    const [after] = await service.listAccounts();
    expect(after).toMatchObject({
      id: before!.id,
      joyClubAccountId: "drclaw",
      label: "Me",
    });
    expect(focused()).toBe(`rename:${before!.id}`);
  });

  it("cancels with Escape or Cancel and changes nothing", async () => {
    await mountAccountPanel(root, service);
    await addAccount("drclaw", "Old");
    const [account] = await service.listAccounts();
    let input = await openRename("drclaw");
    input.value = "Typed";
    input.dispatchEvent(
      new KeyboardEvent("keydown", { key: "Escape", bubbles: true }),
    );
    await settle(() => !renameField());
    expect(focused()).toBe(`rename:${account!.id}`);
    input = await openRename("drclaw");
    // A new rename starts from the stored label, not the dropped text.
    expect(input.value).toBe("Old");
    await press(
      root.querySelector<HTMLButtonElement>(".joyfox-account__rename-cancel")!,
      () => !renameField(),
    );
    expect(focused()).toBe(`rename:${account!.id}`);
    expect((await service.listAccounts())[0]?.label).toBe("Old");
  });

  it("keeps the typed label across a redraw", async () => {
    const panel = await mountAccountPanel(root, service);
    await addAccount("drclaw", "Old");
    const input = await openRename("drclaw");
    input.value = "Half typed";
    await panel.render();
    expect(renameField()?.value).toBe("Half typed");
    expect(document.activeElement).toBe(renameField());
  });

  it("shows the identifier when the label is emptied", async () => {
    await mountAccountPanel(root, service);
    await addAccount("drclaw", "Old");
    const input = await openRename("drclaw");
    input.value = "  ";
    input.form!.requestSubmit();
    await settle(() => !renameField());
    expect(
      items()[0]?.querySelector(".joyfox-panel__item-name")?.textContent,
    ).toBe("drclaw");
    expect((await service.listAccounts())[0]).not.toHaveProperty("label");
  });

  it("keeps the field open with the text when the account is gone", async () => {
    await mountAccountPanel(root, service);
    await addAccount("drclaw", "Old");
    const [account] = await service.listAccounts();
    const input = await openRename("drclaw");
    input.value = "Me";
    // Removed in another tab meanwhile.
    const other = new AccountService(
      repositories.extensionAccounts,
      new MemorySettingsArea(),
    );
    await other.deleteAccount(account!.id);
    input.form!.requestSubmit();
    await settle(failed);
    expect(status()?.textContent).toBe(
      "That account no longer exists. Nothing was changed.",
    );
    expect(await service.listAccounts()).toEqual([]);
  });
});

describe("removing an account (U19)", () => {
  it("names everything the removal deletes", async () => {
    await mountAccountPanel(root, service);
    await addAccount("synthetic-a", "Account A");
    await click(button(".joyfox-panel__remove")!, armed);
    expect(status()?.textContent).toBe(
      "Removing Account A (synthetic-a) deletes everything JoyFox stored for this account, for example notes, tags, rules, templates, messages, event notes and saved searches. Click again to confirm.",
    );
  });

  it("drops the removal prompt when Rename disarms the removal", async () => {
    await mountAccountPanel(root, service);
    await addAccount("synthetic-a", "Account A");
    await click(button(".joyfox-panel__remove")!, armed);
    await click(
      button(".joyfox-account__rename")!,
      () => root.querySelector(".joyfox-account__rename-form") !== null,
    );
    expect(armed()).toBe(false);
    expect(status()?.textContent).toBe("");
  });

  it("says no account is active after the active one is removed", async () => {
    await mountAccountPanel(root, service);
    await addAccount("synthetic-a", "Account A");
    await addAccount("synthetic-b", "Account B");
    await click(inRow("synthetic-a", ".joyfox-panel__remove"), armed);
    await click(
      inRow("synthetic-a", ".joyfox-panel__remove"),
      () => items().length === 1,
    );
    expect(status()?.textContent).toBe(
      'Removed Account A (synthetic-a) and its stored data. No account is active now. Choose one with "Use this account".',
    );
    // No other account became active on its own.
    expect(await service.getActiveAccount()).toBeUndefined();
    expect(text()).toContain("None selected");
  });

  it("says no account is left after the last one is removed", async () => {
    await mountAccountPanel(root, service);
    await addAccount("synthetic-a", "Account A");
    await click(button(".joyfox-panel__remove")!, armed);
    await click(button(".joyfox-panel__remove")!, () => items().length === 0);
    expect(status()?.textContent).toBe(
      "Removed Account A (synthetic-a) and its stored data. No accounts are left. Add one to use JoyFox.",
    );
  });

  it("keeps the short message when another account is removed", async () => {
    await mountAccountPanel(root, service);
    await addAccount("synthetic-a", "Account A");
    await addAccount("synthetic-b", "Account B");
    await click(
      inRow("synthetic-b", ".joyfox-panel__remove"),
      armedIn("synthetic-b"),
    );
    await click(
      inRow("synthetic-b", ".joyfox-panel__remove"),
      () => items().length === 1,
    );
    expect(status()?.textContent).toBe(
      "Removed Account B (synthetic-b) and its stored data.",
    );
    expect((await service.getActiveAccount())?.joyClubAccountId).toBe(
      "synthetic-a",
    );
  });
});

describe("adding an account (U23)", () => {
  it("adds once on a double submit, with no error, and disables the button meanwhile", async () => {
    await mountAccountPanel(root, service);
    root.querySelector<HTMLInputElement>("#joyfox-account-identifier")!.value =
      "synthetic-a";
    const form = root.querySelector<HTMLFormElement>(".joyfox-panel__form")!;
    const submit = button(".joyfox-panel__submit")!;
    form.requestSubmit();
    expect(submit.disabled).toBe(true);
    // The second submit, before the first one is saved.
    form.dispatchEvent(
      new Event("submit", { cancelable: true, bubbles: true }),
    );
    await settle(() => items().length === 1);
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(failed()).toBe(false);
    expect(status()?.textContent).toBe("Added synthetic-a.");
    expect(await service.listAccounts()).toHaveLength(1);
    expect(button(".joyfox-panel__submit")!.disabled).toBe(false);
  });
});

describe("keyboard focus across redraws (U50)", () => {
  it("stays on Remove when it arms, then moves to the list after the removal", async () => {
    await mountAccountPanel(root, service);
    await addAccount("synthetic-a", "Account A");
    await addAccount("synthetic-b", "Account B");
    const [first] = await service.listAccounts();
    await press(inRow("synthetic-a", ".joyfox-panel__remove"), armed);
    expect(document.activeElement).toBe(
      inRow("synthetic-a", ".joyfox-panel__remove"),
    );
    expect(document.activeElement?.textContent).toBe("Confirm removal");
    expect(focused()).toBe(`remove:${first!.id}`);
    await press(
      inRow("synthetic-a", ".joyfox-panel__remove"),
      () => items().length === 1,
    );
    expect(document.activeElement).toBe(root.querySelector("ul"));
    expect(document.activeElement?.getAttribute("aria-label")).toBe(
      "Stored accounts",
    );
  });

  it("moves to the add form after the last account is removed", async () => {
    await mountAccountPanel(root, service);
    await addAccount("synthetic-a", "Account A");
    await press(button(".joyfox-panel__remove")!, armed);
    await press(button(".joyfox-panel__remove")!, () => items().length === 0);
    expect(document.activeElement?.id).toBe("joyfox-account-identifier");
  });

  it("stays in the row after Use this account", async () => {
    await mountAccountPanel(root, service);
    await addAccount("synthetic-a", "Account A");
    await addAccount("synthetic-b", "Account B");
    const second = (await service.listAccounts())[1]!;
    await press(
      inRow("synthetic-b", ".joyfox-panel__activate"),
      () => rowOf("synthetic-b")?.getAttribute("aria-current") === "true",
    );
    expect(focused()).toBe(`rename:${second.id}`);
  });

  it("returns to Add account after an add, even when focus fell to the page", async () => {
    await mountAccountPanel(root, service);
    root.querySelector<HTMLInputElement>("#joyfox-account-identifier")!.value =
      "synthetic-a";
    const submit = button(".joyfox-panel__submit")!;
    submit.focus();
    submit.form!.requestSubmit(submit);
    // Firefox drops focus from a button that is disabled. jsdom keeps it,
    // so move it off and let it fall to the page.
    const elsewhere = document.createElement("button");
    document.body.append(elsewhere);
    elsewhere.focus();
    elsewhere.remove();
    expect(document.activeElement).toBe(document.body);
    await settle(() => items().length === 1);
    expect(document.activeElement).toBe(button(".joyfox-panel__submit"));
  });

  it("keeps focus and the caret in the add form across a redraw", async () => {
    const panel = await mountAccountPanel(root, service);
    const input = root.querySelector<HTMLInputElement>(
      "#joyfox-account-identifier",
    )!;
    input.value = "typed";
    input.focus();
    input.setSelectionRange(2, 2);
    await panel.render();
    const next = root.querySelector<HTMLInputElement>(
      "#joyfox-account-identifier",
    )!;
    expect(next).not.toBe(input);
    expect(document.activeElement).toBe(next);
    expect([next.selectionStart, next.selectionEnd]).toEqual([2, 2]);
  });
});

describe("accessible names start with the visible text (U56)", () => {
  it("holds for every account button, in English and German", async () => {
    const panel = await mountAccountPanel(root, service);
    await addAccount("synthetic-a", "Account A");
    await addAccount("synthetic-b", "Account B");
    // Draw every state: one removal armed, one rename open.
    await click(
      inRow("synthetic-b", ".joyfox-panel__remove"),
      armedIn("synthetic-b"),
    );
    await click(inRow("synthetic-a", ".joyfox-account__rename"), () =>
      Boolean(root.querySelector("#joyfox-account-rename")),
    );
    for (const locale of ["en", "de"] as const) {
      setLocale(locale);
      await panel.render();
      const buttons = Array.from(root.querySelectorAll("button"));
      expect(buttons.length).toBeGreaterThan(5);
      for (const node of buttons) {
        const visible = node.textContent ?? "";
        const name = node.getAttribute("aria-label") ?? visible;
        expect(name.startsWith(visible), `${locale}: ${name}`).toBe(true);
      }
    }
    expect(
      inRow("synthetic-b", ".joyfox-panel__activate").getAttribute(
        "aria-label",
      ),
    ).toBe("Dieses Konto verwenden: Account B (synthetic-b)");
  });
});
