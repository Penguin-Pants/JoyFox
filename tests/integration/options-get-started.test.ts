// @vitest-environment jsdom
import "../setup-indexeddb";
import { beforeEach, describe, expect, it } from "vitest";
import { AccountService } from "../../src/accounts/account-service";
import {
  GetStartedPanel,
  type SiteAccess,
} from "../../src/options/get-started";
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

const allow = () =>
  root.querySelector<HTMLButtonElement>(".joyfox-get-started__allow");
const status = () => root.querySelector(".joyfox-panel__status");

async function settle(until: () => boolean): Promise<void> {
  for (let attempt = 0; attempt < 500 && !until(); attempt += 1)
    await new Promise((resolve) => setTimeout(resolve, 0));
  if (!until()) throw new Error(`Never settled: ${root.textContent}`);
}

/**
 * A stand-in for `browser.permissions`: whether joyclub.de is allowed, what
 * the next request answers, and Firefox's change events.
 */
function fakeAccess(granted: boolean) {
  const listeners = {
    added: [] as Array<() => void>,
    removed: [] as Array<() => void>,
  };
  const state = {
    granted,
    answer: false,
    requests: [] as Array<{ origins: string[] }>,
  };
  const access: SiteAccess = {
    contains: async () => state.granted,
    request: (permissions) => {
      state.requests.push(permissions);
      if (state.answer) state.granted = true;
      return Promise.resolve(state.answer);
    },
    onAdded: { addListener: (listener) => listeners.added.push(listener) },
    onRemoved: { addListener: (listener) => listeners.removed.push(listener) },
  };
  const fire = (event: keyof typeof listeners) =>
    listeners[event].forEach((listener) => listener());
  return { access, state, fire };
}

/** A rule saved from empty boxes, as the "Open" preset leaves it. */
const openRule = (): ContactRuleDefinition => ({
  ...rule(true),
  root: {
    type: "group",
    match: "any",
    children: [{ type: "group", match: "all", children: [] }],
  },
});

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
        listAccounts: async () => [],
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

  it("says so when the setup cannot be read", async () => {
    const broken = new GetStartedPanel(
      root,
      {
        getActiveAccount: () => Promise.reject(new Error("storage")),
      } as unknown as AccountService,
      rules,
    );
    await broken.render();
    expect(root.querySelector("h2")?.textContent).toBe("Get started");
    expect(root.textContent).toContain(
      "JoyFox could not read its setup. Reload the page to try again.",
    );
    expect(root.querySelector("ol")).toBeNull();
  });

  it("asks to choose an account when accounts exist but none is active", async () => {
    const first = await accounts.createAccount({ joyClubAccountId: "a" });
    await accounts.createAccount({ joyClubAccountId: "b" });
    await accounts.deleteAccount(first.id);
    await panel.render();
    const item = root.querySelector("li")!;
    expect(item.textContent).toBe(
      "Choose the active account under Accounts. Not done yet.",
    );
    expect(item.querySelector("a")?.getAttribute("href")).toBe("#accounts");
  });

  it("keeps a rule without conditions done, and says what it means", async () => {
    const account = await accounts.createAccount({ joyClubAccountId: "a" });
    await rules.saveGlobalRule(account.id, openRule());
    await panel.render();
    expect(steps()[1]?.state).toBe(
      " Done: no conditions, so every sender qualifies.",
    );
    expect(root.querySelectorAll("li")[1]?.getAttribute("data-state")).toBe(
      "done",
    );
    expect(root.textContent).toContain("JoyFox is set up.");
    // Turned off, it reads as off, as before.
    await rules.saveGlobalRule(account.id, { ...openRule(), enabled: false });
    await panel.render();
    expect(steps()[1]?.state).toBe(" Saved, but turned off.");
  });
});

describe("site access (JoyFox on joyclub.de)", () => {
  async function setUp(granted: boolean) {
    const fake = fakeAccess(granted);
    const account = await accounts.createAccount({ joyClubAccountId: "a" });
    await rules.saveGlobalRule(account.id, rule(true));
    panel = new GetStartedPanel(root, accounts, rules, fake.access);
    await panel.render();
    return fake;
  }

  it("shows no step while Firefox allows JoyFox there", async () => {
    await setUp(true);
    expect(allow()).toBeNull();
    expect(root.querySelectorAll("li")).toHaveLength(3);
    expect(root.textContent).toContain("JoyFox is set up.");
  });

  it("asks first while Firefox blocks JoyFox there", async () => {
    await setUp(false);
    const items = root.querySelectorAll("li");
    expect(items).toHaveLength(4);
    expect(items[0]?.textContent).toBe(
      "Allow JoyFox to access joyclub.de. Access is off now, so JoyFox cannot work on JoyClub. Not done yet.Allow access to joyclub.de",
    );
    expect(allow()?.type).toBe("button");
    // Never "set up" while nothing can work on JoyClub.
    expect(root.textContent).not.toContain("JoyFox is set up");
    expect(root.textContent).toContain("Four steps, a few minutes.");
  });

  it("asks Firefox inside the click, and says when access stays off", async () => {
    const { state } = await setUp(false);
    allow()!.focus();
    allow()!.click();
    // Asked at once, in the click: Firefox shows its prompt only then.
    expect(state.requests).toEqual([{ origins: ["*://*.joyclub.de/*"] }]);
    await settle(() => status()?.getAttribute("role") === "alert");
    expect(status()?.textContent).toBe(
      "Access to joyclub.de is still off. JoyFox cannot work on JoyClub until you allow access here or in about:addons.",
    );
    expect(allow()).not.toBeNull();
    // Drawn again, with focus still on the button.
    expect(document.activeElement).toBe(allow());
  });

  it("asks Firefox once for a double click while its prompt is open", async () => {
    const { access, state } = await setUp(false);
    let answer: (granted: boolean) => void = () => undefined;
    access.request = (permissions) => {
      state.requests.push(permissions);
      return new Promise<boolean>((resolve) => (answer = resolve));
    };
    allow()!.click();
    allow()!.click();
    expect(state.requests).toHaveLength(1);
    answer(false);
    await settle(() => status()?.getAttribute("role") === "alert");
    // Asked again once the prompt closed.
    allow()!.click();
    expect(state.requests).toHaveLength(2);
  });

  it("drops the step once access is allowed", async () => {
    const { state } = await setUp(false);
    state.answer = true;
    allow()!.focus();
    allow()!.click();
    await settle(() => allow() === null);
    expect(status()?.textContent).toBe(
      "Access to joyclub.de is on. Reload any JoyClub tab that is open, so JoyFox can work there.",
    );
    expect(root.textContent).toContain("JoyFox is set up.");
    // The button is gone: focus moves to the next step's link.
    expect(document.activeElement).toBe(
      root.querySelector('a[href="#accounts"]'),
    );
  });

  it("follows access turned off or on in Firefox", async () => {
    const { state, fire } = await setUp(true);
    state.granted = false;
    fire("removed");
    await settle(() => allow() !== null);
    // A refusal stays until access is on after all (about:addons).
    allow()!.click();
    await settle(() => status()?.getAttribute("role") === "alert");
    state.granted = true;
    fire("added");
    await settle(() => allow() === null);
    expect(status()?.textContent).toBe("");
  });

  it("never blocks when access cannot be checked", async () => {
    const account = await accounts.createAccount({ joyClubAccountId: "a" });
    await rules.saveGlobalRule(account.id, rule(true));
    const failing: SiteAccess = {
      contains: () => Promise.reject(new Error("no")),
      request: () => Promise.reject(new Error("no")),
    };
    await new GetStartedPanel(root, accounts, rules, failing).render();
    expect(allow()).toBeNull();
    expect(root.textContent).toContain("JoyFox is set up.");
    // No permissions API at all (tests, other pages): the same.
    await new GetStartedPanel(root, accounts, rules, undefined).render();
    expect(allow()).toBeNull();
  });
});
