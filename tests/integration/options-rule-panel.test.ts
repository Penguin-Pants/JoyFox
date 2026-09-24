// @vitest-environment jsdom
import "../setup-indexeddb";
import { beforeEach, describe, expect, it } from "vitest";
import { AccountService } from "../../src/accounts/account-service";
import { RulePanel } from "../../src/options/rule-panel";
import { RuleService } from "../../src/rules/rule-service";
import { withAccountLock } from "../../src/storage/account-lock";
import { repositories } from "../../src/storage/repositories";
import { TRIAGE_REVISION_KEY } from "../../src/storage/triage-revision";
import { MemorySettingsArea } from "../memory-settings";
import { freshDatabase } from "../setup-indexeddb";

let settings: MemorySettingsArea;
let accounts: AccountService;
let rules: RuleService;
let root: HTMLElement;
let panel: RulePanel;

beforeEach(async () => {
  await freshDatabase();
  settings = new MemorySettingsArea();
  accounts = new AccountService(repositories.extensionAccounts, settings);
  rules = new RuleService(undefined, settings);
  document.body.replaceChildren();
  root = document.createElement("section");
  document.body.append(root);
  panel = new RulePanel(root, rules, accounts);
});

const input = (id: string) => root.querySelector<HTMLInputElement>(`#${id}`)!;
const select = (id: string) => root.querySelector<HTMLSelectElement>(`#${id}`)!;
const status = () => root.querySelector(".joyfox-panel__status");

async function settle(until: () => boolean): Promise<void> {
  for (let attempt = 0; attempt < 500 && !until(); attempt += 1)
    await new Promise((resolve) => setTimeout(resolve, 0));
  if (!until()) throw new Error(`Never settled: ${root.textContent}`);
}

function submit() {
  root
    .querySelector("form")!
    .dispatchEvent(new Event("submit", { cancelable: true, bubbles: true }));
}

/** Every condition kind in a stored rule tree, in order. */
function kindsOf(node: unknown): string[] {
  const value = node as { kind?: string; children?: unknown[] } | undefined;
  if (!value) return [];
  if (value.kind) return [value.kind];
  return (value.children ?? []).flatMap(kindsOf);
}

function change(node: HTMLElement) {
  node.dispatchEvent(new Event("change", { bubbles: true }));
}

describe("M4 rule builder panel", () => {
  it("asks for an account before offering a rule", async () => {
    await panel.render();
    expect(root.textContent).toContain("Select or add an account first");
    expect(root.querySelector("form")).toBeNull();
  });

  it("saves the two boxes as the global rule and bumps the triage revision", async () => {
    const account = await accounts.createAccount({ joyClubAccountId: "a" });
    await panel.render();
    expect(root.textContent).toContain("No rule is saved");
    input("joyfox-rule-all-verified-on").checked = true;
    input("joyfox-rule-all-minimumPhotos-on").checked = true;
    input("joyfox-rule-all-minimumPhotos-value").value = "3";
    select("joyfox-rule-all-minimumPhotos-unknown").value = "met";
    input("joyfox-rule-any-personallyKnown-on").checked = true;
    submit();
    await settle(
      () => status()?.textContent?.startsWith("Rule saved") ?? false,
    );
    const stored = await rules.getGlobalRule(account.id);
    expect(stored).toMatchObject({
      enabled: true,
      defaultPlacement: "quarantined",
      root: {
        match: "any",
        children: [
          {
            match: "all",
            children: [
              { kind: "verified", whenUnknown: "needs-review" },
              { kind: "minimumPhotos", value: 3, whenUnknown: "met" },
            ],
          },
          { kind: "personallyKnown" },
        ],
      },
    });
    expect(settings.items.get(TRIAGE_REVISION_KEY)).toBeDefined();
    // The re-rendered form shows what was stored.
    expect(input("joyfox-rule-all-minimumPhotos-value").value).toBe("3");
    expect(input("joyfox-rule-any-personallyKnown-on").checked).toBe(true);
  });

  it("autosaves a ticked box at once, without a Save button", async () => {
    const account = await accounts.createAccount({ joyClubAccountId: "a" });
    await panel.render();
    expect(root.querySelector(".joyfox-panel__submit")).toBeNull();
    const box = input("joyfox-rule-all-personallyKnown-on");
    box.checked = true;
    change(box);
    await settle(
      () => status()?.textContent?.startsWith("Rule saved") ?? false,
    );
    expect(kindsOf((await rules.getGlobalRule(account.id))?.root)).toEqual([
      "personallyKnown",
    ]);
    // Saved in place: the same form stays, and "Remove rule" appears.
    expect(input("joyfox-rule-all-personallyKnown-on")).toBe(box);
    expect(root.textContent).toContain("A rule is saved");
    expect(root.querySelector(".joyfox-panel__remove")).not.toBeNull();
  });

  it("autosaves a number when its field reports a change", async () => {
    const account = await accounts.createAccount({ joyClubAccountId: "a" });
    await panel.render();
    input("joyfox-rule-all-minimumPhotos-on").checked = true;
    const value = input("joyfox-rule-all-minimumPhotos-value");
    value.value = "4";
    change(value);
    await settle(
      () => status()?.textContent?.startsWith("Rule saved") ?? false,
    );
    expect(
      JSON.stringify((await rules.getGlobalRule(account.id))?.root),
    ).toContain('"kind":"minimumPhotos","value":4');
  });

  it("keeps a change made while an earlier autosave runs", async () => {
    const account = await accounts.createAccount({ joyClubAccountId: "a" });
    await panel.render();
    const first = input("joyfox-rule-all-verified-on");
    first.checked = true;
    change(first);
    const second = input("joyfox-rule-all-personallyKnown-on");
    second.checked = true;
    change(second);
    await settle(
      () =>
        root.querySelector(".joyfox-panel__remove") !== null &&
        (status()?.textContent?.startsWith("Rule saved") ?? false),
    );
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(second.checked).toBe(true);
    expect(kindsOf((await rules.getGlobalRule(account.id))?.root)).toEqual([
      "verified",
      "personallyKnown",
    ]);
  });

  it("refuses an invalid number and keeps the stored rule", async () => {
    const account = await accounts.createAccount({ joyClubAccountId: "a" });
    await panel.render();
    input("joyfox-rule-all-minimumAccountAgeDays-on").checked = true;
    input("joyfox-rule-all-minimumAccountAgeDays-value").value = "2.5";
    submit();
    await settle(() => status()?.getAttribute("data-kind") === "error");
    expect(status()?.textContent).toContain("Minimum account age in days");
    expect(status()?.getAttribute("role")).toBe("alert");
    expect(await rules.getGlobalRule(account.id)).toBeUndefined();
  });

  it("can turn triage off and remove the rule", async () => {
    const account = await accounts.createAccount({ joyClubAccountId: "a" });
    await panel.render();
    input("joyfox-rule-enabled").checked = false;
    select("joyfox-rule-placement").value = "needs-review";
    submit();
    await settle(
      () => status()?.textContent?.startsWith("Rule saved") ?? false,
    );
    expect(await rules.getGlobalRule(account.id)).toMatchObject({
      enabled: false,
      defaultPlacement: "needs-review",
    });
    root.querySelector<HTMLButtonElement>(".joyfox-panel__remove")!.click();
    await settle(
      () => status()?.textContent?.startsWith("Rule removed") ?? false,
    );
    expect(await rules.getGlobalRule(account.id)).toBeUndefined();
  });

  it("warns when the ANY box cannot matter", async () => {
    await accounts.createAccount({ joyClubAccountId: "a" });
    await panel.render();
    input("joyfox-rule-any-verified-on").checked = true;
    submit();
    await settle(
      () => status()?.textContent?.startsWith("Rule saved") ?? false,
    );
    expect(status()?.textContent).toContain("the ANY box has no effect");
  });

  it("keeps the newest render when an older one finishes last", async () => {
    const a = await accounts.createAccount({ joyClubAccountId: "a" });
    const b = await accounts.createAccount({ joyClubAccountId: "b" });
    await rules.saveGlobalRule(a.id, {
      schemaVersion: 1,
      audience: "all",
      enabled: false,
      defaultPlacement: "quarantined",
      root: { type: "group", match: "all", children: [] },
    });
    // The first render reads account A slowly; the switch to B renders fast.
    let releaseA: () => void = () => undefined;
    let slow = true;
    const slowAccounts = {
      getActiveAccount: async () => {
        const account = await accounts.getActiveAccount();
        if (slow) {
          slow = false;
          await new Promise<void>((resolve) => (releaseA = resolve));
        }
        return account;
      },
    } as AccountService;
    panel = new RulePanel(root, rules, slowAccounts);
    const first = panel.render();
    await accounts.setActiveAccount(b.id);
    await panel.render();
    expect(input("joyfox-rule-enabled").checked).toBe(true);
    releaseA();
    await first;
    // Still only B's (empty) form: A's late render added nothing.
    expect(root.querySelectorAll("form")).toHaveLength(1);
    expect(root.querySelectorAll("h2")).toHaveLength(1);
    expect(root.textContent).toContain("No rule is saved");
    expect(root.textContent).not.toContain("A rule is saved");
  });

  it("refuses to save a form drawn for an account that is no longer active", async () => {
    const a = await accounts.createAccount({ joyClubAccountId: "a" });
    const b = await accounts.createAccount({ joyClubAccountId: "b" });
    await panel.render();
    await accounts.setActiveAccount(b.id);
    input("joyfox-rule-all-verified-on").checked = true;
    submit();
    await settle(() => status()?.getAttribute("data-kind") === "error");
    expect(status()?.textContent).toContain("The active account changed");
    expect(await rules.getGlobalRule(a.id)).toBeUndefined();
    expect(await rules.getGlobalRule(b.id)).toBeUndefined();
  });

  it("refuses to remove the rule from a form drawn for another account", async () => {
    const a = await accounts.createAccount({ joyClubAccountId: "a" });
    const b = await accounts.createAccount({ joyClubAccountId: "b" });
    await rules.saveGlobalRule(a.id, {
      schemaVersion: 1,
      audience: "all",
      enabled: true,
      defaultPlacement: "quarantined",
      root: { type: "group", match: "all", children: [] },
    });
    await panel.render();
    await accounts.setActiveAccount(b.id);
    root.querySelector<HTMLButtonElement>(".joyfox-panel__remove")!.click();
    await settle(() => status()?.getAttribute("data-kind") === "error");
    expect(status()?.textContent).toContain("The rule was not removed");
    expect(await rules.getGlobalRule(a.id)).toBeDefined();
  });

  it("runs a quick save then remove in click order", async () => {
    const a = await accounts.createAccount({ joyClubAccountId: "a" });
    await rules.saveGlobalRule(a.id, {
      schemaVersion: 1,
      audience: "all",
      enabled: true,
      defaultPlacement: "quarantined",
      root: { type: "group", match: "all", children: [] },
    });
    await panel.render();
    submit();
    root.querySelector<HTMLButtonElement>(".joyfox-panel__remove")!.click();
    await settle(
      () => status()?.textContent?.startsWith("Rule removed") ?? false,
    );
    // Give any stray write time to land.
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(await rules.getGlobalRule(a.id)).toBeUndefined();
  });

  it("does not let a stale second tab recreate a removed rule", async () => {
    const a = await accounts.createAccount({ joyClubAccountId: "a" });
    await rules.saveGlobalRule(a.id, {
      schemaVersion: 1,
      audience: "all",
      enabled: true,
      defaultPlacement: "quarantined",
      root: { type: "group", match: "all", children: [] },
    });
    await panel.render();
    const otherRoot = document.createElement("section");
    document.body.append(otherRoot);
    const other = new RulePanel(otherRoot, rules, accounts);
    await other.render();
    // The other tab removes the rule and finishes.
    otherRoot
      .querySelector<HTMLButtonElement>(".joyfox-panel__remove")!
      .click();
    await settle(
      () =>
        otherRoot
          .querySelector(".joyfox-panel__status")
          ?.textContent?.startsWith("Rule removed") ?? false,
    );
    // Later, this tab saves its old form without having redrawn.
    submit();
    await settle(() => status()?.getAttribute("data-kind") === "error");
    expect(status()?.textContent).toContain("changed in another tab");
    expect(await rules.getGlobalRule(a.id)).toBeUndefined();
  });

  it("redraws on another tab's rule change but keeps edits otherwise", async () => {
    const a = await accounts.createAccount({ joyClubAccountId: "a" });
    await panel.render();
    input("joyfox-rule-all-verified-on").checked = true;
    // An unrelated revision (a trust log, a snapshot) keeps the edit.
    await panel.refreshIfChanged();
    expect(input("joyfox-rule-all-verified-on").checked).toBe(true);
    // Another tab saves a rule: the form redraws from storage.
    await rules.saveGlobalRule(a.id, {
      schemaVersion: 1,
      audience: "all",
      enabled: false,
      defaultPlacement: "needs-review",
      root: { type: "group", match: "all", children: [] },
    });
    await panel.refreshIfChanged();
    expect(input("joyfox-rule-enabled").checked).toBe(false);
    expect(status()?.textContent).toContain("changed in another tab");
  });

  it("refuses a queued save when another tab changes the rule before it runs", async () => {
    const a = await accounts.createAccount({ joyClubAccountId: "a" });
    await panel.render();
    input("joyfox-rule-all-verified-on").checked = true;
    // Hold the account lock, so the save waits in the queue.
    let release: () => void = () => undefined;
    const held = withAccountLock(
      a.id,
      () => new Promise<void>((resolve) => (release = resolve)),
    );
    submit();
    // Meanwhile another tab saves, and this panel redraws from storage.
    await rules.saveGlobalRule(a.id, {
      schemaVersion: 1,
      audience: "all",
      enabled: false,
      defaultPlacement: "needs-review",
      root: { type: "group", match: "all", children: [] },
    });
    await panel.refreshIfChanged();
    release();
    await held;
    await settle(
      () => status()?.textContent?.includes("was not saved") ?? false,
    );
    expect(await rules.getGlobalRule(a.id)).toMatchObject({ enabled: false });
  });

  it("keeps the newest form when an older render fails late", async () => {
    await accounts.createAccount({ joyClubAccountId: "a" });
    let failFirst: () => void = () => undefined;
    let calls = 0;
    const flaky = {
      getActiveAccount: () => {
        calls += 1;
        return calls === 1
          ? new Promise<never>((_resolve, reject) => {
              failFirst = () => reject(new Error("slow failure"));
            })
          : accounts.getActiveAccount();
      },
    } as unknown as AccountService;
    panel = new RulePanel(root, rules, flaky);
    const first = panel.render();
    await panel.render();
    expect(root.querySelector("form")).not.toBeNull();
    failFirst();
    await first;
    expect(root.querySelector("form")).not.toBeNull();
    expect(root.textContent).not.toContain("could not read");
  });

  it("does not offer to edit a rule shape it cannot show", async () => {
    const account = await accounts.createAccount({ joyClubAccountId: "a" });
    await rules.saveGlobalRule(account.id, {
      schemaVersion: 1,
      audience: "woman",
      enabled: true,
      defaultPlacement: "quarantined",
      root: { type: "group", match: "all", children: [] },
    });
    await panel.render();
    expect(root.querySelector("form")).toBeNull();
    expect(root.textContent).toContain("cannot be edited here");
  });
});
