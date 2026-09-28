// @vitest-environment jsdom
import "../setup-indexeddb";
import { beforeEach, describe, expect, it } from "vitest";
import { AccountService } from "../../src/accounts/account-service";
import { setLocale } from "../../src/i18n/translator";
import { confirmTiming } from "../../src/options/confirm";
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
  // A confirming click right after arming counts; one test sets it back.
  confirmTiming.graceMs = 0;
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
/** The panel's status line: the first one, under the note. */
const status = () => root.querySelector(".joyfox-panel__status");
const deleteAll = () =>
  root.querySelector<HTMLButtonElement>(".joyfox-rule__delete-all")!;
/** The prompt line right under "Delete whole contact rule". */
const deleteLine = () => deleteAll().nextElementSibling;
/** The note under a field's row, as `aria-describedby` names it. */
const noteOf = (field: HTMLElement) =>
  root.querySelector(`#${field.getAttribute("aria-describedby")}`);

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
    // Saved in place: the same form stays, and the delete button appears.
    expect(input("joyfox-rule-all-personallyKnown-on")).toBe(box);
    expect(root.textContent).toContain("A rule is saved");
    expect(root.querySelector(".joyfox-rule__delete-all")).not.toBeNull();
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
        root.querySelector(".joyfox-rule__delete-all") !== null &&
        (status()?.textContent?.startsWith("Rule saved") ?? false),
    );
    // The second save runs after the first, and can take longer under load.
    // A change that was lost never arrives, so the check still fails then.
    let kinds = kindsOf((await rules.getGlobalRule(account.id))?.root);
    for (let attempt = 0; attempt < 200 && kinds.length < 2; attempt += 1) {
      await new Promise((resolve) => setTimeout(resolve, 5));
      kinds = kindsOf((await rules.getGlobalRule(account.id))?.root);
    }
    expect(second.checked).toBe(true);
    expect(kinds).toEqual(["verified", "personallyKnown"]);
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

  it("can turn triage off and delete the rule on a second click", async () => {
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
    // The first click only arms, in place: focus stays on the button.
    const button = deleteAll();
    button.focus();
    button.click();
    expect(button.textContent).toBe("Confirm delete");
    expect(document.activeElement).toBe(button);
    expect(deleteLine()?.textContent).toBe(
      "Click again to delete the whole contact rule. JoyFox then stops sorting the inbox for this account.",
    );
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(await rules.getGlobalRule(account.id)).toBeDefined();
    button.click();
    await settle(
      () => status()?.textContent?.startsWith("Contact rule deleted") ?? false,
    );
    expect(await rules.getGlobalRule(account.id)).toBeUndefined();
    // The button is gone; focus goes to the form's first control.
    expect(root.querySelector(".joyfox-rule__delete-all")).toBeNull();
    expect(document.activeElement).toBe(input("joyfox-rule-enabled"));
  });

  it("brings the delete result into view at the top of the form", async () => {
    const account = await accounts.createAccount({ joyClubAccountId: "a" });
    await rules.saveGlobalRule(account.id, {
      schemaVersion: 1,
      audience: "all",
      enabled: true,
      defaultPlacement: "quarantined",
      root: { type: "group", match: "all", children: [] },
    });
    await panel.render();
    const scrolled: Element[] = [];
    const proto = Element.prototype as { scrollIntoView?: unknown };
    const before = proto.scrollIntoView;
    proto.scrollIntoView = function (this: Element) {
      scrolled.push(this);
    };
    try {
      const button = deleteAll();
      button.click();
      button.click();
      await settle(
        () =>
          status()?.textContent?.startsWith("Contact rule deleted") ?? false,
      );
      expect(scrolled).toContain(status());
    } finally {
      proto.scrollIntoView = before;
    }
  });

  it("never deletes the rule on a double-click", async () => {
    confirmTiming.graceMs = 500;
    const account = await accounts.createAccount({ joyClubAccountId: "a" });
    await rules.saveGlobalRule(account.id, {
      schemaVersion: 1,
      audience: "all",
      enabled: true,
      defaultPlacement: "quarantined",
      root: { type: "group", match: "all", children: [] },
    });
    await panel.render();
    const button = deleteAll();
    // A double-click: the first click arms, its second one is ignored.
    button.dispatchEvent(new MouseEvent("click", { detail: 1 }));
    button.dispatchEvent(new MouseEvent("click", { detail: 2 }));
    // A fast single click inside the grace period is ignored too.
    button.dispatchEvent(new MouseEvent("click", { detail: 1 }));
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(button.textContent).toBe("Confirm delete");
    expect(await rules.getGlobalRule(account.id)).toBeDefined();
    // After the grace period, a single click confirms.
    confirmTiming.graceMs = 0;
    button.dispatchEvent(new MouseEvent("click", { detail: 1 }));
    await settle(
      () => status()?.textContent?.startsWith("Contact rule deleted") ?? false,
    );
    expect(await rules.getGlobalRule(account.id)).toBeUndefined();
  });

  it("disarms the delete when another action comes first", async () => {
    const account = await accounts.createAccount({ joyClubAccountId: "a" });
    await panel.render();
    const box = input("joyfox-rule-all-verified-on");
    box.checked = true;
    change(box);
    await settle(() => root.querySelector(".joyfox-rule__delete-all") !== null);
    deleteAll().click();
    expect(deleteAll().textContent).toBe("Confirm delete");
    // Another change disarms it and takes the prompt away.
    const other = input("joyfox-rule-all-personallyKnown-on");
    other.checked = true;
    change(other);
    expect(deleteAll().textContent).toBe("Delete whole contact rule");
    expect(deleteLine()?.textContent).toBe("");
    // So does a click on another button.
    deleteAll().click();
    root.querySelector<HTMLButtonElement>('[data-view="advanced"]')!.click();
    expect(deleteAll().textContent).toBe("Delete whole contact rule");
    // A click on the disarmed button arms it again; nothing was deleted.
    deleteAll().click();
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(await rules.getGlobalRule(account.id)).toBeDefined();
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
    deleteAll().click();
    deleteAll().click();
    await settle(() => status()?.getAttribute("data-kind") === "error");
    expect(status()?.textContent).toContain("The rule was not deleted");
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
    deleteAll().click();
    deleteAll().click();
    await settle(
      () => status()?.textContent?.startsWith("Contact rule deleted") ?? false,
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
    // The other tab deletes the rule and finishes.
    const otherDelete = otherRoot.querySelector<HTMLButtonElement>(
      ".joyfox-rule__delete-all",
    )!;
    otherDelete.click();
    otherDelete.click();
    await settle(
      () =>
        otherRoot
          .querySelector(".joyfox-panel__status")
          ?.textContent?.startsWith("Contact rule deleted") ?? false,
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

describe("advanced rule editor (ADR 0012)", () => {
  const button = (view: string) =>
    root.querySelector<HTMLButtonElement>(`[data-view="${view}"]`)!;
  const ruleSets = () =>
    Array.from(root.querySelectorAll<HTMLElement>("[data-rule]"));
  const saved = () => status()?.textContent?.startsWith("Rule saved") ?? false;
  async function addCondition(rule: HTMLElement, kind: string) {
    status()!.textContent = "";
    const add = rule.querySelector<HTMLSelectElement>(
      ".joyfox-rule__add-condition",
    )!;
    add.value = kind;
    change(add);
    await settle(saved);
  }

  it("builds the owner's rule: personally known, or verified with photos and days", async () => {
    const account = await accounts.createAccount({ joyClubAccountId: "a" });
    await panel.render();
    expect(button("simple").getAttribute("aria-pressed")).toBe("true");
    button("advanced").click();
    expect(button("advanced").getAttribute("aria-pressed")).toBe("true");
    expect(ruleSets()).toHaveLength(1);
    await addCondition(ruleSets()[0]!, "personallyKnown");
    root.querySelector<HTMLButtonElement>(".joyfox-rule__add-rule")!.click();
    expect(ruleSets()).toHaveLength(2);
    expect(root.querySelector(".joyfox-rule__joiner")?.textContent).toBe("OR");
    // The parts of the rule are groups, so "rule" means only the whole.
    expect(ruleSets()[1]!.textContent).toContain("Group 2: met if");
    expect(root.querySelector(".joyfox-rule__add-rule")?.textContent).toBe(
      "+ Add group",
    );
    expect(root.querySelector(".joyfox-rule__rule-count")?.textContent).toBe(
      "2 of 10 groups",
    );
    await addCondition(ruleSets()[1]!, "verified");
    await addCondition(ruleSets()[1]!, "minimumAccountAgeDays");
    await addCondition(ruleSets()[1]!, "minimumPhotos");
    const photos = ruleSets()[1]!.querySelector<HTMLInputElement>(
      '[data-kind="minimumPhotos"] input[type=number]',
    )!;
    expect(photos.value).toBe("3");
    // A condition already in the rule is not offered again.
    const offered = Array.from(
      ruleSets()[1]!.querySelectorAll<HTMLOptionElement>(
        ".joyfox-rule__add-condition option",
      ),
      (option) => option.value,
    );
    expect(offered).not.toContain("verified");
    const stored = await rules.getGlobalRule(account.id);
    expect(stored?.schemaVersion).toBe(1);
    expect(stored?.root).toEqual({
      type: "group",
      match: "any",
      children: [
        {
          type: "group",
          match: "all",
          children: [
            {
              type: "condition",
              kind: "personallyKnown",
              whenUnknown: "needs-review",
            },
          ],
        },
        {
          type: "group",
          match: "all",
          children: [
            {
              type: "condition",
              kind: "verified",
              whenUnknown: "needs-review",
            },
            {
              type: "condition",
              kind: "minimumPhotos",
              value: 3,
              whenUnknown: "needs-review",
            },
            {
              type: "condition",
              kind: "minimumAccountAgeDays",
              value: 180,
              whenUnknown: "needs-review",
            },
          ],
        },
      ],
    });
    // The rule fits two boxes, so Simple stays offered.
    expect(button("simple").disabled).toBe(false);
    // A new page opens it in the advanced editor again.
    const again = new RulePanel(root, rules, accounts);
    await again.render();
    expect(button("advanced").getAttribute("aria-pressed")).toBe("true");
    expect(ruleSets()).toHaveLength(2);
  });

  it("saves not as version 2 and then offers no Simple view", async () => {
    const account = await accounts.createAccount({ joyClubAccountId: "a" });
    await panel.render();
    button("advanced").click();
    await addCondition(ruleSets()[0]!, "minimumPhotos");
    status()!.textContent = "";
    const not = root.querySelector<HTMLInputElement>(".joyfox-rule__negate")!;
    not.checked = true;
    change(not);
    await settle(saved);
    expect(not.parentElement?.classList).toContain("joyfox-rule__not--on");
    const stored = await rules.getGlobalRule(account.id);
    expect(stored?.schemaVersion).toBe(2);
    expect(JSON.stringify(stored?.root)).toContain('"negate":true');
    expect(button("simple").disabled).toBe(true);
    expect(root.querySelector("#joyfox-rule-simple-why")?.textContent).toMatch(
      /not/,
    );
  });

  it("combines groups with ALL and removes a group on a second click", async () => {
    const account = await accounts.createAccount({ joyClubAccountId: "a" });
    await panel.render();
    button("advanced").click();
    await addCondition(ruleSets()[0]!, "verified");
    root.querySelector<HTMLButtonElement>(".joyfox-rule__add-rule")!.click();
    await addCondition(ruleSets()[1]!, "personallyKnown");
    status()!.textContent = "";
    const top = select("joyfox-rule-top-match");
    top.value = "all";
    change(top);
    await settle(saved);
    expect(root.querySelector(".joyfox-rule__joiner")?.textContent).toBe("AND");
    expect((await rules.getGlobalRule(account.id))?.root.match).toBe("all");
    expect(button("simple").disabled).toBe(true);
    status()!.textContent = "";
    // A group with conditions only arms on the first click, in place.
    const remove = ruleSets()[0]!.querySelector<HTMLButtonElement>(
      ".joyfox-rule__remove-rule",
    )!;
    remove.focus();
    remove.click();
    expect(ruleSets()).toHaveLength(2);
    expect(remove.textContent).toBe("Confirm removal");
    expect(remove.getAttribute("aria-label")).toBe(
      "Confirm removal of group 1",
    );
    expect(document.activeElement).toBe(remove);
    expect(ruleSets()[0]!.textContent).toContain(
      "Click again to remove group 1 and its conditions.",
    );
    remove.click();
    await settle(saved);
    expect(ruleSets()).toHaveLength(1);
    expect(ruleSets()[0]!.textContent).toContain("Group 1: met if");
    // Focus moves on to adding a group, not to the page.
    expect(document.activeElement).toBe(
      root.querySelector(".joyfox-rule__add-rule"),
    );
    expect(kindsOf((await rules.getGlobalRule(account.id))?.root)).toEqual([
      "personallyKnown",
    ]);
    // The last rule cannot be removed.
    expect(
      root.querySelector<HTMLButtonElement>(".joyfox-rule__remove-rule")!
        .disabled,
    ).toBe(true);
    expect(button("simple").disabled).toBe(false);
  });

  it("switches back to two boxes with the same meaning", async () => {
    await accounts.createAccount({ joyClubAccountId: "a" });
    await panel.render();
    input("joyfox-rule-all-verified-on").checked = true;
    input("joyfox-rule-any-personallyKnown-on").checked = true;
    button("advanced").click();
    expect(ruleSets()).toHaveLength(2);
    button("simple").click();
    expect(input("joyfox-rule-all-verified-on").checked).toBe(true);
    expect(input("joyfox-rule-any-personallyKnown-on").checked).toBe(true);
  });

  it("offers to delete the whole rule after the first save from Advanced", async () => {
    await accounts.createAccount({ joyClubAccountId: "a" });
    await panel.render();
    button("advanced").click();
    expect(root.querySelector(".joyfox-rule__delete-all")).toBeNull();
    await addCondition(ruleSets()[0]!, "verified");
    expect(root.querySelector(".joyfox-rule__delete-all")).not.toBeNull();
  });

  it("stops at ten rules", async () => {
    await accounts.createAccount({ joyClubAccountId: "a" });
    await panel.render();
    button("advanced").click();
    const add = root.querySelector<HTMLButtonElement>(
      ".joyfox-rule__add-rule",
    )!;
    for (let i = 1; i < 10; i += 1) add.click();
    expect(ruleSets()).toHaveLength(10);
    expect(add.disabled).toBe(true);
  });

  it("removes a group without conditions at once, and disarms on another click", async () => {
    await accounts.createAccount({ joyClubAccountId: "a" });
    await panel.render();
    button("advanced").click();
    await addCondition(ruleSets()[0]!, "verified");
    const addGroup = root.querySelector<HTMLButtonElement>(
      ".joyfox-rule__add-rule",
    )!;
    addGroup.click();
    const removeFirst = () =>
      ruleSets()[0]!.querySelector<HTMLButtonElement>(
        ".joyfox-rule__remove-rule",
      )!;
    removeFirst().click();
    expect(removeFirst().textContent).toBe("Confirm removal");
    // Another click (here: adding a group) puts the button back.
    addGroup.click();
    expect(ruleSets()).toHaveLength(3);
    expect(removeFirst().textContent).toBe("Remove group");
    expect(removeFirst().getAttribute("aria-label")).toBe("Remove group 1");
    expect(ruleSets()[0]!.textContent).not.toContain("Click again");
    // The empty third group goes on one click.
    ruleSets()[2]!
      .querySelector<HTMLButtonElement>(".joyfox-rule__remove-rule")!
      .click();
    expect(ruleSets()).toHaveLength(2);
    // Group 1's prompt line is no condition: without its one condition,
    // the group reads as empty and goes on one click too.
    status()!.textContent = "";
    ruleSets()[0]!
      .querySelector<HTMLButtonElement>(".joyfox-rule__remove-condition")!
      .click();
    await settle(saved);
    expect(
      ruleSets()[0]!.querySelector<HTMLElement>(".joyfox-rule__empty")!.hidden,
    ).toBe(false);
    removeFirst().click();
    expect(ruleSets()).toHaveLength(1);
  });

  it('says that "Not flagged as template spam" is never checked yet', async () => {
    await accounts.createAccount({ joyClubAccountId: "a" });
    await panel.render();
    button("advanced").click();
    await addCondition(ruleSets()[0]!, "notTemplateSpam");
    const row = root.querySelector<HTMLElement>(
      '[data-kind="notTemplateSpam"]',
    )!;
    expect(row.querySelector(".joyfox-rule__name")?.textContent).toBe(
      "Not flagged as template spam (not checked yet: always unknown)",
    );
    expect(
      noteOf(row.querySelector(".joyfox-rule__unknown")!)?.textContent,
    ).toBe("(not checked yet: always unknown)");
  });
});

describe("First message contains (ADR 0013)", () => {
  const saved = () => status()?.textContent?.startsWith("Rule saved") ?? false;

  it("saves the typed word, phrase or emoji from the Simple editor", async () => {
    const account = await accounts.createAccount({ joyClubAccountId: "a" });
    await panel.render();
    const box = input("joyfox-rule-all-firstMessageContains-on");
    box.checked = true;
    change(box);
    const text = input("joyfox-rule-all-firstMessageContains-text");
    expect(text.type).toBe("text");
    expect(text.maxLength).toBe(100);
    text.value = "  Blue heron 🦊 ";
    change(text);
    await settle(saved);
    const stored = await rules.getGlobalRule(account.id);
    expect(stored?.schemaVersion).toBe(3);
    expect(JSON.stringify(stored?.root)).toContain(
      '"kind":"firstMessageContains","text":"Blue heron 🦊"',
    );
    // A new page shows the stored text.
    await new RulePanel(root, rules, accounts).render();
    expect(input("joyfox-rule-all-firstMessageContains-text").value).toBe(
      "Blue heron 🦊",
    );
  });

  it("waits for the text of a ticked condition and saves the other changes", async () => {
    const account = await accounts.createAccount({ joyClubAccountId: "a" });
    await panel.render();
    const box = input("joyfox-rule-all-firstMessageContains-on");
    const text = input("joyfox-rule-all-firstMessageContains-text");
    expect(text.disabled).toBe(true);
    box.checked = true;
    change(box);
    // No save and no error: focus goes to the field, with a hint.
    expect(document.activeElement).toBe(text);
    expect(text.disabled).toBe(false);
    expect(noteOf(text)?.textContent).toBe(
      "Type a word, phrase or emoji to use this condition.",
    );
    expect(text.hasAttribute("aria-invalid")).toBe(false);
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(status()?.textContent ?? "").toBe("");
    expect(await rules.getGlobalRule(account.id)).toBeUndefined();
    // Another change saves without it, and the hint stays.
    const verified = input("joyfox-rule-all-verified-on");
    verified.checked = true;
    change(verified);
    await settle(saved);
    expect(kindsOf((await rules.getGlobalRule(account.id))?.root)).toEqual([
      "verified",
    ]);
    expect(noteOf(text)?.textContent).toContain("Type a word");
    // Once text is typed, the hint goes and the condition is saved.
    text.value = "Hallo";
    text.dispatchEvent(new Event("input", { bubbles: true }));
    expect(text.hasAttribute("aria-describedby")).toBe(false);
    status()!.textContent = "";
    change(text);
    await settle(saved);
    expect(kindsOf((await rules.getGlobalRule(account.id))?.root)).toEqual([
      "verified",
      "firstMessageContains",
    ]);
  });

  it("refuses a text that is too long and marks the field", async () => {
    const account = await accounts.createAccount({ joyClubAccountId: "a" });
    await panel.render();
    const box = input("joyfox-rule-all-firstMessageContains-on");
    box.checked = true;
    change(box);
    const text = input("joyfox-rule-all-firstMessageContains-text");
    text.value = "x".repeat(101);
    submit();
    await settle(() => status()?.getAttribute("role") === "alert");
    expect(status()?.textContent).toContain("Enter a word, phrase or emoji");
    expect(text.getAttribute("aria-invalid")).toBe("true");
    expect(noteOf(text)?.textContent).toBe(
      "Enter a word, phrase or emoji of up to 100 characters.",
    );
    expect(await rules.getGlobalRule(account.id)).toBeUndefined();
  });

  it("adds the condition in the Advanced editor and saves once text is entered", async () => {
    const account = await accounts.createAccount({ joyClubAccountId: "a" });
    await panel.render();
    root.querySelector<HTMLButtonElement>('[data-view="advanced"]')!.click();
    const add = root.querySelector<HTMLSelectElement>(
      ".joyfox-rule__add-condition",
    )!;
    add.value = "firstMessageContains";
    change(add);
    const text = root.querySelector<HTMLInputElement>(
      '[data-kind="firstMessageContains"] .joyfox-rule__text',
    )!;
    expect(document.activeElement).toBe(text);
    // Adding it alone saves nothing and shows no error.
    expect(status()?.textContent ?? "").toBe("");
    text.value = "🦊";
    change(text);
    await settle(saved);
    expect(
      JSON.stringify((await rules.getGlobalRule(account.id))?.root),
    ).toContain('"text":"🦊"');
  });
});

describe("rule presets (V1-11, ADR 0016)", () => {
  const preset = () => select("joyfox-rule-preset");
  const apply = () =>
    root.querySelector<HTMLButtonElement>(".joyfox-rule__preset-apply")!;
  const applied = () =>
    status()?.textContent?.includes("applied and saved") ?? false;

  function choose(id: string) {
    preset().value = id;
    change(preset());
  }

  it("fills the Simple editor with High-trust members and saves it", async () => {
    const account = await accounts.createAccount({ joyClubAccountId: "a" });
    await panel.render();
    expect(apply().disabled).toBe(true);
    choose("highTrust");
    expect(apply().disabled).toBe(false);
    expect(root.textContent).toContain(
      "verified by JoyClub, with at least 3 photos, at least 50 words of profile text and an account at least 180 days old",
    );
    // Choosing alone saves nothing.
    expect(await rules.getGlobalRule(account.id)).toBeUndefined();
    apply().click();
    await settle(applied);
    expect(status()?.textContent).toContain(
      'Preset "High-trust members" applied and saved',
    );
    const stored = await rules.getGlobalRule(account.id);
    // The Simple editor's shape: the ALL box is the root's first group.
    expect(stored?.root.children).toHaveLength(1);
    expect(stored?.root.children[0]).toEqual({
      type: "group",
      match: "all",
      children: [
        { type: "condition", kind: "verified", whenUnknown: "needs-review" },
        {
          type: "condition",
          kind: "minimumPhotos",
          value: 3,
          whenUnknown: "needs-review",
        },
        {
          type: "condition",
          kind: "minimumProfileWords",
          value: 50,
          whenUnknown: "needs-review",
        },
        {
          type: "condition",
          kind: "minimumAccountAgeDays",
          value: 180,
          whenUnknown: "needs-review",
        },
      ],
    });
    expect(input("joyfox-rule-all-verified-on").checked).toBe(true);
    expect(input("joyfox-rule-all-minimumAccountAgeDays-value").value).toBe(
      "180",
    );
    expect(input("joyfox-rule-all-minimumTrustScore-on").checked).toBe(false);
    // The choice resets, so it never claims to describe an edited rule.
    expect(preset().value).toBe("");
    expect(apply().disabled).toBe(true);
  });

  it("lets the user edit the preset like any other rule", async () => {
    const account = await accounts.createAccount({ joyClubAccountId: "a" });
    await panel.render();
    choose("complete");
    apply().click();
    await settle(applied);
    status()!.textContent = "";
    const photos = input("joyfox-rule-all-minimumPhotos-value");
    photos.value = "5";
    change(photos);
    await settle(
      () => status()?.textContent?.startsWith("Rule saved") ?? false,
    );
    expect(
      JSON.stringify((await rules.getGlobalRule(account.id))?.root),
    ).toContain('"kind":"minimumPhotos","value":5');
  });

  it("keeps the on switch and the failing placement", async () => {
    const account = await accounts.createAccount({ joyClubAccountId: "a" });
    await panel.render();
    input("joyfox-rule-enabled").checked = false;
    select("joyfox-rule-placement").value = "needs-review";
    choose("verified");
    apply().click();
    await settle(applied);
    expect(await rules.getGlobalRule(account.id)).toMatchObject({
      enabled: false,
      defaultPlacement: "needs-review",
    });
    expect(kindsOf((await rules.getGlobalRule(account.id))?.root)).toEqual([
      "verified",
    ]);
  });

  it("asks before it replaces conditions already shown", async () => {
    const account = await accounts.createAccount({ joyClubAccountId: "a" });
    await rules.saveGlobalRule(account.id, {
      schemaVersion: 1,
      audience: "all",
      enabled: true,
      defaultPlacement: "quarantined",
      root: {
        type: "group",
        match: "all",
        children: [
          { type: "condition", kind: "personallyKnown", whenUnknown: "met" },
        ],
      },
    });
    const before = await rules.getGlobalRule(account.id);
    await panel.render();
    choose("open");
    apply().click();
    expect(apply().textContent).toBe("Replace conditions");
    const prompt = () =>
      root.querySelector(".joyfox-rule__presets .joyfox-rule__prompt");
    expect(prompt()?.textContent).toContain(
      "The preset replaces every condition below",
    );
    expect(await rules.getGlobalRule(account.id)).toEqual(before);
    // Another choice asks again, and the prompt goes with the armed state.
    choose("verified");
    expect(apply().textContent).toBe("Apply preset");
    expect(prompt()?.textContent).toBe("");
    apply().click();
    expect(apply().textContent).toBe("Replace conditions");
    apply().click();
    await settle(applied);
    expect(kindsOf((await rules.getGlobalRule(account.id))?.root)).toEqual([
      "verified",
    ]);
  });

  it("replaces an Advanced rule and shows the Simple editor", async () => {
    const account = await accounts.createAccount({ joyClubAccountId: "a" });
    await panel.render();
    root.querySelector<HTMLButtonElement>('[data-view="advanced"]')!.click();
    const add = root.querySelector<HTMLSelectElement>(
      ".joyfox-rule__add-condition",
    )!;
    add.value = "verified";
    change(add);
    await settle(
      () => status()?.textContent?.startsWith("Rule saved") ?? false,
    );
    root
      .querySelector<HTMLInputElement>(
        '[data-kind="verified"] .joyfox-rule__negate',
      )!
      .click();
    choose("complete");
    apply().click();
    apply().click();
    await settle(applied);
    expect(root.querySelector("[data-rule]")).toBeNull();
    expect(input("joyfox-rule-all-minimumPhotos-on").checked).toBe(true);
    expect(kindsOf((await rules.getGlobalRule(account.id))?.root)).toEqual([
      "minimumPhotos",
      "minimumProfileWords",
    ]);
  });

  it("saves Open and Custom with no conditions, each with its own message", async () => {
    const account = await accounts.createAccount({ joyClubAccountId: "a" });
    await panel.render();
    choose("open");
    apply().click();
    await settle(applied);
    expect(status()?.textContent).toContain("every sender qualifies");
    expect(kindsOf((await rules.getGlobalRule(account.id))?.root)).toEqual([]);
    choose("custom");
    apply().click();
    await settle(
      () =>
        status()?.textContent?.startsWith("All conditions cleared") ?? false,
    );
    expect(kindsOf((await rules.getGlobalRule(account.id))?.root)).toEqual([]);
    expect(document.activeElement).toBe(input("joyfox-rule-all-verified-on"));
  });

  it("does not save a preset from a form drawn for another account", async () => {
    const first = await accounts.createAccount({ joyClubAccountId: "a" });
    const second = await accounts.createAccount({ joyClubAccountId: "b" });
    await panel.render();
    await accounts.setActiveAccount(second.id);
    choose("verified");
    apply().click();
    await settle(() => status()?.getAttribute("data-kind") === "error");
    expect(status()?.textContent).toContain("The active account changed");
    expect(await rules.getGlobalRule(first.id)).toBeUndefined();
    expect(await rules.getGlobalRule(second.id)).toBeUndefined();
  });

  it("never applies a preset on a double-click", async () => {
    confirmTiming.graceMs = 500;
    const account = await accounts.createAccount({ joyClubAccountId: "a" });
    await panel.render();
    const box = input("joyfox-rule-all-personallyKnown-on");
    box.checked = true;
    change(box);
    await settle(
      () => status()?.textContent?.startsWith("Rule saved") ?? false,
    );
    choose("verified");
    // The first click arms; the second click of the double-click, and a
    // fast single click, are ignored.
    apply().dispatchEvent(new MouseEvent("click", { detail: 1 }));
    apply().dispatchEvent(new MouseEvent("click", { detail: 2 }));
    apply().dispatchEvent(new MouseEvent("click", { detail: 1 }));
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(apply().textContent).toBe("Replace conditions");
    expect(kindsOf((await rules.getGlobalRule(account.id))?.root)).toEqual([
      "personallyKnown",
    ]);
    confirmTiming.graceMs = 0;
    apply().dispatchEvent(new MouseEvent("click", { detail: 1 }));
    await settle(applied);
    expect(kindsOf((await rules.getGlobalRule(account.id))?.root)).toEqual([
      "verified",
    ]);
  });
});

describe("rule form feedback (UX audit)", () => {
  const saved = () => status()?.textContent?.startsWith("Rule saved") ?? false;

  it("shows the status under the note, and how saving works before the fields", async () => {
    await accounts.createAccount({ joyClubAccountId: "a" });
    await panel.render();
    const form = root.querySelector("form")!;
    // Note, status, then the form: a result shows where the form starts.
    expect(form.previousElementSibling).toBe(status());
    expect(status()?.previousElementSibling?.textContent).toContain(
      "No rule is saved",
    );
    expect(form.firstElementChild?.textContent).toContain(
      "Changes are saved automatically",
    );
    // The same live region stays after a save.
    const node = status();
    const box = input("joyfox-rule-all-verified-on");
    box.checked = true;
    change(box);
    await settle(saved);
    expect(status()).toBe(node);
    expect(form.previousElementSibling).toBe(node);
  });

  it("fills a ticked number with the default and saves it", async () => {
    const account = await accounts.createAccount({ joyClubAccountId: "a" });
    await panel.render();
    for (const [kind, value] of [
      ["minimumPhotos", "3"],
      ["minimumProfileWords", "50"],
      ["minimumAccountAgeDays", "180"],
      ["minimumTrustScore", "1"],
    ] as const) {
      const field = input(`joyfox-rule-all-${kind}-value`);
      expect(field.value).toBe("");
      const box = input(`joyfox-rule-all-${kind}-on`);
      box.checked = true;
      status()!.textContent = "";
      change(box);
      // No alert: the field has the Advanced editor's default, and focus.
      expect(field.value).toBe(value);
      expect(document.activeElement).toBe(field);
      await settle(saved);
      expect(status()?.getAttribute("role")).toBe("status");
    }
    expect(
      JSON.stringify((await rules.getGlobalRule(account.id))?.root),
    ).toContain('"kind":"minimumTrustScore","value":1');
    // Ticked again, a row keeps the value it had.
    const box = input("joyfox-rule-all-minimumPhotos-on");
    const photos = input("joyfox-rule-all-minimumPhotos-value");
    photos.value = "8";
    change(photos);
    await settle(saved);
    box.checked = false;
    change(box);
    box.checked = true;
    change(box);
    expect(photos.value).toBe("8");
  });

  it("marks a number it refuses next to the field, until the value is valid", async () => {
    const account = await accounts.createAccount({ joyClubAccountId: "a" });
    await panel.render();
    const box = input("joyfox-rule-all-minimumPhotos-on");
    box.checked = true;
    change(box);
    await settle(saved);
    const field = input("joyfox-rule-all-minimumPhotos-value");
    field.value = "-5";
    change(field);
    await settle(() => status()?.getAttribute("role") === "alert");
    // The existing error stays, and the field says what is wrong.
    expect(status()?.textContent).toBe(
      'Enter a whole number from 0 to 100,000 for "Minimum photos". The rule was not saved.',
    );
    expect(field.getAttribute("aria-invalid")).toBe("true");
    const note = noteOf(field)!;
    expect(note.textContent).toBe("Enter a whole number from 0 to 100,000.");
    expect(note.getAttribute("data-note")).toBe("error");
    // In the same row, after the row's fields.
    expect(note.parentElement).toBe(field.parentElement);
    expect(note.parentElement?.lastElementChild).toBe(note);
    // Typing a valid value clears both marks at once.
    field.value = "4";
    field.dispatchEvent(new Event("input", { bubbles: true }));
    expect(field.hasAttribute("aria-invalid")).toBe(false);
    expect(field.hasAttribute("aria-describedby")).toBe(false);
    expect(note.isConnected).toBe(false);
    change(field);
    await settle(saved);
    expect(
      JSON.stringify((await rules.getGlobalRule(account.id))?.root),
    ).toContain('"kind":"minimumPhotos","value":4');
  });

  it("shows a field's note again after a language change", async () => {
    await accounts.createAccount({ joyClubAccountId: "a" });
    await panel.render();
    const box = input("joyfox-rule-all-minimumPhotos-on");
    box.checked = true;
    change(box);
    await settle(saved);
    const field = input("joyfox-rule-all-minimumPhotos-value");
    field.value = "-1";
    change(field);
    await settle(() => status()?.getAttribute("role") === "alert");
    setLocale("de");
    try {
      await panel.localeChanged();
      const again = input("joyfox-rule-all-minimumPhotos-value");
      expect(again).not.toBe(field);
      expect(again.value).toBe("-1");
      expect(again.getAttribute("aria-invalid")).toBe("true");
      expect(noteOf(again)?.textContent).toBe(
        "Gib eine ganze Zahl von 0 bis 100.000 ein.",
      );
      // A field without a note gets none.
      expect(
        input("joyfox-rule-any-minimumPhotos-value").hasAttribute(
          "aria-describedby",
        ),
      ).toBe(false);
    } finally {
      setLocale("en");
    }
  });

  it("turns off the fields of an unticked row", async () => {
    const account = await accounts.createAccount({ joyClubAccountId: "a" });
    await panel.render();
    const box = input("joyfox-rule-any-minimumAccountAgeDays-on");
    const fields = () => [
      input("joyfox-rule-any-minimumAccountAgeDays-value"),
      select("joyfox-rule-any-minimumAccountAgeDays-unknown"),
    ];
    expect(fields().map((field) => field.disabled)).toEqual([true, true]);
    box.checked = true;
    change(box);
    expect(fields().map((field) => field.disabled)).toEqual([false, false]);
    await settle(saved);
    status()!.textContent = "";
    box.checked = false;
    change(box);
    expect(fields().map((field) => field.disabled)).toEqual([true, true]);
    await settle(saved);
    // A stored rule draws its ticked rows on, the others off.
    await rules.saveGlobalRule(account.id, {
      schemaVersion: 1,
      audience: "all",
      enabled: true,
      defaultPlacement: "quarantined",
      root: {
        type: "group",
        match: "any",
        children: [
          {
            type: "group",
            match: "all",
            children: [
              {
                type: "condition",
                kind: "minimumAccountAgeDays",
                value: 30,
                whenUnknown: "met",
              },
            ],
          },
        ],
      },
    });
    await new RulePanel(root, rules, accounts).render();
    expect(input("joyfox-rule-all-minimumAccountAgeDays-value").disabled).toBe(
      false,
    );
    expect(fields().map((field) => field.disabled)).toEqual([true, true]);
  });

  it("says when a rule without conditions lets every sender through", async () => {
    const account = await accounts.createAccount({ joyClubAccountId: "a" });
    await panel.render();
    const placement = select("joyfox-rule-placement");
    placement.value = "needs-review";
    change(placement);
    await settle(saved);
    expect(status()?.textContent).toBe(
      "Rule saved. It has no conditions yet, so every sender qualifies.",
    );
    expect(kindsOf((await rules.getGlobalRule(account.id))?.root)).toEqual([]);
    // With a condition, the plain message.
    const box = input("joyfox-rule-all-verified-on");
    box.checked = true;
    change(box);
    await settle(
      () =>
        status()?.textContent ===
        "Rule saved. Open JoyClub tabs update at once.",
    );
  });

  it('says that "Not flagged as template spam" is never checked yet', async () => {
    await accounts.createAccount({ joyClubAccountId: "a" });
    await panel.render();
    const box = input("joyfox-rule-all-notTemplateSpam-on");
    expect(box.labels?.[0]?.textContent).toBe(
      "Not flagged as template spam (not checked yet: always unknown)",
    );
    expect(
      noteOf(select("joyfox-rule-all-notTemplateSpam-unknown"))?.textContent,
    ).toBe("(not checked yet: always unknown)");
    // Only that row.
    expect(input("joyfox-rule-all-verified-on").labels?.[0]?.textContent).toBe(
      "Verified by JoyClub",
    );
  });

  it("clears the status when the active account changes", async () => {
    await accounts.createAccount({ joyClubAccountId: "a" });
    const b = await accounts.createAccount({ joyClubAccountId: "b" });
    await panel.render();
    const box = input("joyfox-rule-all-verified-on");
    box.checked = true;
    change(box);
    await settle(saved);
    await accounts.setActiveAccount(b.id);
    await panel.render();
    // B has no rule: "Rule saved." would contradict the note.
    expect(root.textContent).toContain("No rule is saved");
    expect(status()?.textContent).toBe("");
  });

  it("keeps the status when the same account is drawn again", async () => {
    const account = await accounts.createAccount({ joyClubAccountId: "a" });
    await panel.render();
    await rules.saveGlobalRule(account.id, {
      schemaVersion: 1,
      audience: "all",
      enabled: false,
      defaultPlacement: "quarantined",
      root: { type: "group", match: "all", children: [] },
    });
    await panel.refreshIfChanged();
    expect(status()?.textContent).toContain("changed in another tab");
    await panel.render();
    expect(status()?.textContent).toContain("changed in another tab");
  });

  it("says how to go on when the rule cannot be read or saved", async () => {
    const account = await accounts.createAccount({ joyClubAccountId: "a" });
    const unreadable = {
      getGlobalRule: () => Promise.reject(new Error("read")),
    } as unknown as RuleService;
    await new RulePanel(root, unreadable, accounts).render();
    expect(root.textContent).toBe(
      "JoyFox could not read the contact rule. No rule was changed. Reload the page to try again.",
    );
    const unsaved = {
      getGlobalRule: (id: string) => rules.getGlobalRule(id),
      saveGlobalRule: () => Promise.reject(new Error("write")),
    } as unknown as RuleService;
    await new RulePanel(root, unsaved, accounts).render();
    const box = input("joyfox-rule-all-verified-on");
    box.checked = true;
    change(box);
    await settle(() => status()?.getAttribute("role") === "alert");
    expect(status()?.textContent).toBe(
      "JoyFox could not save the rule. Nothing was changed. Change the field again, or reload the page to see the saved rule.",
    );
    expect(await rules.getGlobalRule(account.id)).toBeUndefined();
  });

  it("shows a failed delete under the button", async () => {
    const account = await accounts.createAccount({ joyClubAccountId: "a" });
    await rules.saveGlobalRule(account.id, {
      schemaVersion: 1,
      audience: "all",
      enabled: true,
      defaultPlacement: "quarantined",
      root: { type: "group", match: "all", children: [] },
    });
    const undeletable = {
      getGlobalRule: (id: string) => rules.getGlobalRule(id),
      deleteGlobalRule: () => Promise.reject(new Error("write")),
    } as unknown as RuleService;
    await new RulePanel(root, undeletable, accounts).render();
    deleteAll().click();
    deleteAll().click();
    await settle(() => deleteLine()?.getAttribute("role") === "alert");
    expect(deleteLine()?.textContent).toBe(
      "JoyFox could not delete the rule. Nothing was changed.",
    );
    expect(deleteAll().textContent).toBe("Delete whole contact rule");
    expect(await rules.getGlobalRule(account.id)).toBeDefined();
  });
});
