// @vitest-environment jsdom
import "../setup-indexeddb";
import { beforeEach, describe, expect, it } from "vitest";
import { AccountService } from "../../src/accounts/account-service";
import { GetStartedPanel } from "../../src/options/get-started";
import type { ContactRuleDefinition } from "../../src/rules/contact-rule";
import { RuleService } from "../../src/rules/rule-service";
import { repositories } from "../../src/storage/repositories";
import { MemorySettingsArea } from "../memory-settings";
import { freshDatabase } from "../setup-indexeddb";

let accounts: AccountService;
let rules: RuleService;
let root: HTMLElement;
let panel: GetStartedPanel;

const rule = (enabled: boolean): ContactRuleDefinition => ({
  schemaVersion: 1,
  audience: "all",
  enabled,
  defaultPlacement: "quarantined",
  root: {
    type: "group",
    match: "all",
    children: [
      { type: "condition", kind: "verified", whenUnknown: "needs-review" },
    ],
  },
});

beforeEach(async () => {
  await freshDatabase();
  const settings = new MemorySettingsArea();
  accounts = new AccountService(repositories.extensionAccounts, settings);
  rules = new RuleService(undefined, settings);
  document.body.replaceChildren();
  root = document.createElement("section");
  document.body.append(root);
  panel = new GetStartedPanel(root, accounts, rules);
});

/** Each step's text with its state, as the page shows it in words. */
const steps = () =>
  Array.from(root.querySelectorAll("li")).map((item) => ({
    state: item.querySelector(".joyfox-get-started__state")?.textContent ?? "",
  }));

describe("Get started checklist (build plan Section 28)", () => {
  it("lists all steps as not done on a cold install", async () => {
    await panel.render();
    expect(root.querySelector("h2")?.textContent).toBe("Get started");
    expect(root.getAttribute("aria-labelledby")).toBe(
      root.querySelector("h2")?.id,
    );
    expect(steps()).toEqual([
      { state: " Not done yet." },
      { state: " Not done yet." },
      { state: "" },
    ]);
    expect(root.textContent).not.toContain("JoyFox is set up");
    // The steps link to the tabs they name.
    expect(
      Array.from(root.querySelectorAll("a"), (a) => [
        a.textContent,
        a.getAttribute("href"),
      ]),
    ).toEqual([
      ["Accounts", "#accounts"],
      ["Contact rule", "#rule"],
    ]);
  });

  it("follows the account and the rule, in words", async () => {
    const account = await accounts.createAccount({
      joyClubAccountId: "synthetic-login",
    });
    await panel.render();
    expect(steps().map((step) => step.state)).toEqual([
      " Done.",
      " Not done yet.",
      "",
    ]);
    await rules.saveGlobalRule(account.id, rule(false));
    await panel.render();
    expect(steps()[1]?.state).toBe(" Saved, but turned off.");
    await rules.saveGlobalRule(account.id, rule(true));
    await panel.render();
    expect(steps()[1]?.state).toBe(" Done.");
    expect(root.textContent).toContain("JoyFox is set up.");
  });

  it("never draws a second copy", async () => {
    await panel.render();
    await panel.render();
    expect(root.querySelectorAll("h2")).toHaveLength(1);
    expect(root.querySelectorAll("ol")).toHaveLength(1);
  });

  it("keeps the newest render when an older one finishes late", async () => {
    let releaseFirst: () => void = () => undefined;
    let calls = 0;
    const slow = new GetStartedPanel(
      root,
      {
        getActiveAccount: async () => {
          calls += 1;
          if (calls === 1)
            await new Promise<void>((resolve) => {
              releaseFirst = resolve;
            });
          return calls === 1
            ? undefined
            : {
                id: "a",
                accountId: "a",
                joyClubAccountId: "x",
                createdAt: "2026-09-23T10:00:00.000Z",
                updatedAt: "2026-09-23T10:00:00.000Z",
              };
        },
      } as unknown as AccountService,
      { getGlobalRule: async () => undefined } as unknown as RuleService,
    );
    const first = slow.render();
    await slow.render();
    releaseFirst();
    await first;
    expect(steps()[0]?.state).toBe(" Done.");
  });
});
