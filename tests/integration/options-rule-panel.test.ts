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
