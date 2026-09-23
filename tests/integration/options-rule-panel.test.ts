// @vitest-environment jsdom
import "../setup-indexeddb";
import { beforeEach, describe, expect, it } from "vitest";
import { AccountService } from "../../src/accounts/account-service";
import { RulePanel } from "../../src/options/rule-panel";
import { RuleService } from "../../src/rules/rule-service";
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
