// @vitest-environment jsdom
import "../setup-indexeddb";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  InboxTriage,
  inboxListShown,
  inboxListState,
  PLACEMENT_ATTRIBUTE,
  rowSlot,
  VIEW_ATTRIBUTE,
} from "../../src/content/inbox-triage";
import { MemberPanel } from "../../src/content/member-panel";
import {
  memberBar,
  unknownProfileFactsText,
} from "../../src/content/triage-ui";
import type { TriageClient } from "../../src/content/triage-client";
import type {
  ContactRuleDefinition,
  EvaluatedCondition,
  RuleCondition,
} from "../../src/rules/contact-rule";
import { RuleService } from "../../src/rules/rule-service";
import { repositories } from "../../src/storage/repositories";
import { TriageService } from "../../src/triage/triage-service";
import { TrustService } from "../../src/trust/trust-service";
import { MemorySettingsArea } from "../memory-settings";
import { freshDatabase } from "../setup-indexeddb";
import contentCss from "../../src/content/content.css?raw";
import conversationHtml from "../fixtures/joyclub/conversation.html?raw";
import inboxHtml from "../fixtures/joyclub/inbox.html?raw";
import profileHtml from "../fixtures/joyclub/profile.html?raw";

const ACCOUNT = "account-a";
const KNOWN = "1234567"; // fixture row 1, shield code 3
const VERIFIED = "98765432"; // fixture row 2, shield code 1

let settings: MemorySettingsArea;
let rules: RuleService;
let triage: TriageService;
let trust: TrustService;
let activeAccount: string | undefined;

const condition = (
  kind: RuleCondition["kind"],
  extra: Partial<RuleCondition> = {},
): RuleCondition => ({
  type: "condition",
  kind,
  whenUnknown: "needs-review",
  ...extra,
});

/** Qualify members you know personally; quarantine the rest. */
const knownRule = (
  extra: Partial<ContactRuleDefinition> = {},
): ContactRuleDefinition => ({
  schemaVersion: 1,
  audience: "all",
  enabled: true,
  defaultPlacement: "quarantined",
  root: {
    type: "group",
    match: "all",
    children: [condition("personallyKnown")],
  },
  ...extra,
});

/** A client backed by the real background services on a fake database. */
function serviceClient(): TriageClient & {
  evaluations: number;
  writes: string[];
} {
  const client = {
    evaluations: 0,
    evaluate(members: Parameters<TriageClient["evaluate"]>[0]) {
      client.evaluations += 1;
      return triage.evaluate(activeAccount, members);
    },
    // Writes behave like the background handlers: dropped unless the
    // account they name is still the active one.
    writes: [] as string[],
    async setOverride(accountId: string, memberId: string, placement: never) {
      if (accountId !== activeAccount) return;
      client.writes.push(`override:${accountId}`);
      await triage.setOverride(accountId, memberId, placement);
    },
    getTrust: (memberId: string, observed: object) =>
      triage.trustFor(activeAccount, memberId, observed),
    async logTrust(accountId: string, memberId: string, kind: "positive") {
      if (accountId !== activeAccount) return;
      client.writes.push(`log:${accountId}`);
      await trust.logOutcome(accountId, memberId, kind);
    },
    async undoTrust(accountId: string, memberId: string) {
      if (accountId !== activeAccount) return;
      await trust.undoLastOutcome(accountId, memberId);
    },
    async captureSnapshot(
      accountId: string,
      memberId: string,
      observed: object,
    ) {
      if (accountId !== activeAccount) return;
      client.writes.push(`capture:${accountId}`);
      await triage.captureSnapshot(accountId, memberId, observed);
    },
    openOptions: () => Promise.resolve(),
  };
  return client;
}

function setPage(path: string, html: string) {
  window.history.replaceState(null, "", path);
  document.body.innerHTML = html;
}

const list = () => document.querySelector(".cm-conversation-list")!;
const rows = () =>
  Array.from(document.querySelectorAll(".cm-conversation-list-item"));
const placements = () =>
  rows().map((row) => row.getAttribute(PLACEMENT_ATTRIBUTE));
const bar = () => document.querySelector('[data-joyfox-ui="triage-bar"]');
/** A button by the start of its text or its full accessible name. */
const buttonNamed = (root: ParentNode, text: string) => {
  const match = Array.from(root.querySelectorAll("button")).find(
    (node) =>
      node.textContent?.startsWith(text) ||
      node.getAttribute("aria-label") === text,
  );
  if (!match) throw new Error(`No button ${text}`);
  return match;
};

beforeEach(async () => {
  await freshDatabase();
  settings = new MemorySettingsArea();
  rules = new RuleService(undefined, settings);
  triage = new TriageService(
    undefined,
    undefined,
    undefined,
    undefined,
    undefined,
    undefined,
    settings,
  );
  trust = new TrustService(undefined, undefined, settings);
  activeAccount = ACCOUNT;
  const style = document.createElement("style");
  style.textContent = contentCss;
  document.head.replaceChildren(style);
});

afterEach(() => {
  document.body.innerHTML = "";
});

describe("M2 inbox triage", () => {
  it("labels and groups rows by the rule, without moving any row", async () => {
    await rules.saveGlobalRule(ACCOUNT, knownRule());
    setPage("/clubmail/", inboxHtml);
    const order = rows();
    const inbox = new InboxTriage(document, serviceClient());
    inbox.update();
    await vi.waitFor(() => expect(bar()).not.toBeNull());
    expect(bar()?.nextElementSibling).toBe(list());
    expect(list().getAttribute(VIEW_ATTRIBUTE)).toBe("default");
    // Known: qualified. Verified only: quarantined. No profile link: review.
    expect(placements()).toEqual(["qualified", "quarantined", "needs-review"]);
    expect(rows()).toEqual(order);
    expect(
      rows().map(
        (row) => row.querySelector('[data-joyfox-ui="badge"]')?.textContent,
      ),
    ).toEqual(["Qualified", "Quarantined", "Needs Review"]);
    expect(buttonNamed(bar()!, "Quarantined").textContent).toBe(
      "Quarantined (1)",
    );
  });

  it("hides Quarantined from the default view only, and each tab shows its group", async () => {
    await rules.saveGlobalRule(ACCOUNT, knownRule());
    setPage("/clubmail/", inboxHtml);
    const inbox = new InboxTriage(document, serviceClient());
    inbox.update();
    await vi.waitFor(() => expect(bar()).not.toBeNull());
    const visible = () =>
      rows().map((row) => getComputedStyle(row).display !== "none");
    expect(visible()).toEqual([true, false, true]);
    buttonNamed(bar()!, "Quarantined").click();
    expect(inbox.view).toBe("quarantined");
    expect(visible()).toEqual([false, true, false]);
    expect(
      buttonNamed(bar()!, "Quarantined").getAttribute("aria-pressed"),
    ).toBe("true");
    buttonNamed(bar()!, "Show all").click();
    expect(visible()).toEqual([true, true, true]);
  });

  it("hides each row's wrappers too, so a view's rows sit together", async () => {
    await rules.saveGlobalRule(ACCOUNT, knownRule());
    setPage("/clubmail/", inboxHtml);
    // Live structure (owner evidence, 2026-09-24): each row sits in two
    // plain divs inside a j-list, which keep their height when the row hides.
    const items = document.createElement("j-list");
    items.className = "cm-conversation-list__element";
    for (const row of rows()) {
      const outer = document.createElement("div");
      const inner = document.createElement("div");
      inner.className = "cm-conversation-list";
      inner.append(row);
      outer.append(inner);
      items.append(outer);
    }
    list().append(items);
    const original = document.body.innerHTML;
    const inbox = new InboxTriage(document, serviceClient());
    inbox.update();
    await vi.waitFor(() => expect(bar()).not.toBeNull());
    const shown = () =>
      Array.from(items.children).map(
        (slot) => getComputedStyle(slot).display !== "none",
      );
    expect(shown()).toEqual([true, false, true]);
    buttonNamed(bar()!, "Quarantined").click();
    expect(shown()).toEqual([false, true, false]);
    buttonNamed(bar()!, "Needs Review").click();
    expect(shown()).toEqual([false, false, true]);
    inbox.teardown();
    expect(document.body.innerHTML).toBe(original);
  });

  it("never takes the list, or a wrapper with other content, as a row's slot", () => {
    document.body.innerHTML =
      '<div id="list"><div id="only"><div id="row"></div></div></div>' +
      '<div id="list2"><div id="shared"><div id="row2"></div><span></span></div></div>';
    const at = (id: string) => document.getElementById(id)!;
    expect(rowSlot(at("row"), at("list"))).toBe(at("only"));
    expect(rowSlot(at("row2"), at("list2"))).toBe(at("row2"));
  });

  it("explains a placement and moves the sender at once when the user overrides it", async () => {
    await rules.saveGlobalRule(ACCOUNT, knownRule());
    setPage("/clubmail/", inboxHtml);
    const inbox = new InboxTriage(document, serviceClient());
    inbox.update();
    await vi.waitFor(() => expect(bar()).not.toBeNull());
    (
      rows()[1]?.querySelector('[data-joyfox-ui="badge"]') as HTMLElement
    ).click();
    const details = bar()!.querySelector(".joyfox-triage__details")!;
    expect(details.textContent).toContain("Why: Synthetic Two");
    expect(details.textContent).toContain(
      "You have not marked this member as personally known, which the rule requires.",
    );
    buttonNamed(details, "Move to Qualified").click();
    await vi.waitFor(() =>
      expect(placements()).toEqual(["qualified", "qualified", "needs-review"]),
    );
    expect(details.textContent).toContain("your manual choice");
    expect(details.textContent).toContain(
      "Your rule alone would place it in Quarantined.",
    );
    buttonNamed(details, "Use my rule again").click();
    await vi.waitFor(() => expect(placements()[1]).toBe("quarantined"));
  });

  it("settles: a repeated update changes nothing and injects nothing twice", async () => {
    await rules.saveGlobalRule(ACCOUNT, knownRule());
    setPage("/clubmail/", inboxHtml);
    const inbox = new InboxTriage(document, serviceClient());
    inbox.update();
    await vi.waitFor(() => expect(bar()).not.toBeNull());
    const observer = new MutationObserver(() => undefined);
    observer.observe(document.body, {
      subtree: true,
      childList: true,
      attributes: true,
      characterData: true,
    });
    inbox.update();
    inbox.update();
    expect(observer.takeRecords()).toEqual([]);
    observer.disconnect();
    expect(
      document.querySelectorAll('[data-joyfox-ui="triage-bar"]'),
    ).toHaveLength(1);
    expect(document.querySelectorAll('[data-joyfox-ui="badge"]')).toHaveLength(
      3,
    );
  });

  it("triages rows that load later", async () => {
    await rules.saveGlobalRule(ACCOUNT, knownRule());
    setPage("/clubmail/", inboxHtml);
    const client = serviceClient();
    const inbox = new InboxTriage(document, client);
    inbox.update();
    await vi.waitFor(() => expect(bar()).not.toBeNull());
    const added = rows()[0]!.cloneNode(true) as Element;
    added.querySelector('[data-joyfox-ui="badge"]')?.remove();
    added.removeAttribute(PLACEMENT_ATTRIBUTE);
    added
      .querySelector(".cm-conversation-list-item__avatar")!
      .setAttribute("href", "/profile/5550001.synthetic_four.html");
    added
      .querySelector("j-veri-icon")!
      .setAttribute("verification-status", "1");
    list().append(added);
    inbox.update();
    await vi.waitFor(() => expect(placements()[3]).toBe("quarantined"));
    expect(added.querySelectorAll('[data-joyfox-ui="badge"]')).toHaveLength(1);
  });

  it("teardown restores JoyClub's list exactly", async () => {
    await rules.saveGlobalRule(ACCOUNT, knownRule());
    setPage("/clubmail/", inboxHtml);
    const original = document.body.innerHTML;
    const inbox = new InboxTriage(document, serviceClient());
    inbox.update();
    await vi.waitFor(() => expect(bar()).not.toBeNull());
    buttonNamed(bar()!, "Quarantined").click();
    (
      rows()[1]?.querySelector('[data-joyfox-ui="badge"]') as HTMLElement
    ).click();
    inbox.teardown();
    expect(document.body.innerHTML).toBe(original);
    // A later visit starts without the old "Why" panel open.
    inbox.update();
    await vi.waitFor(() => expect(bar()).not.toBeNull());
    expect(
      bar()!.querySelector<HTMLElement>(".joyfox-triage__details")!.hidden,
    ).toBe(true);
  });

  it.each([
    ["no account", () => (activeAccount = undefined)],
    ["no rule", () => undefined],
    [
      "a disabled rule",
      () => rules.saveGlobalRule(ACCOUNT, knownRule({ enabled: false })),
    ],
  ])("changes nothing with %s", async (_label, arrange) => {
    await arrange();
    setPage("/clubmail/", inboxHtml);
    const original = document.body.innerHTML;
    const client = serviceClient();
    const inbox = new InboxTriage(document, client);
    inbox.update();
    await vi.waitFor(() => expect(client.evaluations).toBe(1));
    await new Promise((resolve) => setTimeout(resolve, 20));
    inbox.update();
    expect(document.body.innerHTML).toBe(original);
    // Off is remembered until something changes: no request per mutation.
    expect(client.evaluations).toBe(1);
  });

  it("shows the tab bar for an enabled rule on an empty inbox", async () => {
    await rules.saveGlobalRule(ACCOUNT, knownRule());
    setPage(
      "/clubmail/",
      '<div class="cm-conversation-list" aria-label="Synthetic list"></div>',
    );
    const inbox = new InboxTriage(document, serviceClient());
    inbox.update();
    await vi.waitFor(() => expect(bar()).not.toBeNull());
    expect(buttonNamed(bar()!, "Quarantined").textContent).toBe(
      "Quarantined (0)",
    );
  });

  it("removes the previous account's UI at once when the account changes", async () => {
    await rules.saveGlobalRule(ACCOUNT, knownRule());
    setPage("/clubmail/", inboxHtml);
    const original = document.body.innerHTML;
    const client = serviceClient();
    let release: () => void = () => undefined;
    const inbox = new InboxTriage(document, {
      ...client,
      // Hold the next answer, to look at the page while it is pending.
      evaluate: (members) =>
        client.evaluations === 0
          ? client.evaluate(members)
          : new Promise((resolve) => {
              release = () => void client.evaluate(members).then(resolve);
            }),
    });
    inbox.update();
    await vi.waitFor(() => expect(bar()).not.toBeNull());
    activeAccount = "account-b";
    inbox.accountChanged();
    expect(document.body.innerHTML).toBe(original);
    release();
    // Account B has no rule, so nothing comes back.
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(document.body.innerHTML).toBe(original);
  });

  it("asks again on a new day and on re-entering the inbox", async () => {
    await rules.saveGlobalRule(ACCOUNT, knownRule());
    setPage("/clubmail/", inboxHtml);
    const client = serviceClient();
    let now = new Date("2026-09-23T23:59:00.000Z");
    const inbox = new InboxTriage(document, client, () => now);
    inbox.update();
    await vi.waitFor(() => expect(bar()).not.toBeNull());
    const first = client.evaluations;
    inbox.update();
    expect(client.evaluations).toBe(first);
    // Past midnight UTC, an account-age condition may now pass.
    now = new Date("2026-09-24T00:01:00.000Z");
    inbox.update();
    await vi.waitFor(() => expect(client.evaluations).toBeGreaterThan(first));
    await vi.waitFor(() => expect(bar()).not.toBeNull());
    const second = client.evaluations;
    inbox.leave();
    inbox.update();
    await vi.waitFor(() => expect(client.evaluations).toBeGreaterThan(second));
    await vi.waitFor(() => expect(bar()).not.toBeNull());
    // Leave no active instance behind for the next test's page.
    inbox.leave();
  });

  it("stays on beside an open conversation while the list is shown", async () => {
    await rules.saveGlobalRule(ACCOUNT, knownRule());
    // JoyClub's split view: the list and the open conversation together.
    setPage(
      "/clubmail/conversation/conversation-wrapper-personal-1234567-7654321",
      inboxHtml + conversationHtml,
    );
    expect(inboxListShown(document)).toBe(true);
    const inbox = new InboxTriage(document, serviceClient());
    inbox.update();
    await vi.waitFor(() => expect(bar()).not.toBeNull());
    expect(placements()).toEqual(["qualified", "quarantined", "needs-review"]);
    // A list JoyClub keeps in the page but hides does not count.
    list().setAttribute("style", "display: none");
    expect(inboxListState(document)).toBe("hidden");
    // Any page without the list, such as a profile, is not triaged.
    setPage("/profile/1234567.synthetic_one.html", profileHtml);
    expect(inboxListState(document)).toBe("missing");
    inbox.leave();
  });

  it("follows the list, not the URL, after a reply changes the route", async () => {
    await rules.saveGlobalRule(ACCOUNT, knownRule());
    // After a reply the URL may match no known page, but the list is shown.
    setPage("/clubmail/some-unknown-route/", inboxHtml + conversationHtml);
    expect(inboxListShown(document)).toBe(true);
    const inbox = new InboxTriage(document, serviceClient());
    inbox.update();
    await vi.waitFor(() => expect(bar()).not.toBeNull());
    inbox.leave();
  });

  it("fails open when the background cannot answer", async () => {
    setPage("/clubmail/", inboxHtml);
    const original = document.body.innerHTML;
    const inbox = new InboxTriage(document, {
      ...serviceClient(),
      evaluate: () => Promise.reject(new Error("background asleep")),
    });
    inbox.update();
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(document.body.innerHTML).toBe(original);
  });

  it("re-evaluates the open inbox when the rule changes", async () => {
    await rules.saveGlobalRule(ACCOUNT, knownRule());
    setPage("/clubmail/", inboxHtml);
    const inbox = new InboxTriage(document, serviceClient());
    inbox.update();
    await vi.waitFor(() => expect(placements()[1]).toBe("quarantined"));
    await rules.saveGlobalRule(
      ACCOUNT,
      knownRule({ defaultPlacement: "needs-review" }),
    );
    inbox.invalidate();
    await vi.waitFor(() => expect(placements()[1]).toBe("needs-review"));
    await rules.saveGlobalRule(ACCOUNT, knownRule({ enabled: false }));
    inbox.invalidate();
    await vi.waitFor(() => expect(bar()).toBeNull());
    expect(placements()).toEqual([null, null, null]);
  });
});

describe("First message contains in the inbox (ADR 0013)", () => {
  it("sends each row's preview and places rows by the phrase", async () => {
    await rules.saveGlobalRule(ACCOUNT, {
      ...knownRule(),
      schemaVersion: 3,
      root: {
        type: "group",
        match: "all",
        children: [
          {
            type: "condition",
            kind: "firstMessageContains",
            text: "Preview TEXT",
            whenUnknown: "not-met",
          },
        ],
      },
    });
    setPage("/clubmail/", inboxHtml);
    const client = serviceClient();
    const sent: Array<string | undefined> = [];
    const evaluate = client.evaluate;
    client.evaluate = (members) => {
      sent.push(...members.map((member) => member.preview));
      return evaluate(members);
    };
    new InboxTriage(document, client).update();
    await vi.waitFor(() => expect(bar()).not.toBeNull());
    expect(sent).toEqual([
      "Synthetic preview text",
      "Another synthetic preview",
    ]);
    // Row 1 holds the phrase. Row 2 does not, and the rule counts that as
    // not met. Row 3 has no profile link, so it is never evaluated.
    expect(placements()).toEqual(["qualified", "quarantined", "needs-review"]);
  });
});

describe("conversation and profile panel", () => {
  const panel = () => document.querySelector('[data-joyfox-ui="member-panel"]');

  const CONVERSATION =
    "/clubmail/conversation/conversation-wrapper-personal-1234567-7654321";

  it("goes under JoyClub's header row, not into it, when the header is a row item", async () => {
    await rules.saveGlobalRule(ACCOUNT, knownRule());
    // The live header sits in a horizontal flex row with the menu buttons.
    setPage(
      CONVERSATION,
      `<div id="row" style="display: flex">${conversationHtml.split("<ul")[0]}</div><ul${conversationHtml.split("<ul")[1]}`,
    );
    new MemberPanel(document, serviceClient()).update("conversation");
    await vi.waitFor(() => expect(panel()).not.toBeNull());
    const row = document.querySelector("#row")!;
    expect(row.nextElementSibling).toBe(panel()?.parentElement);
    expect(row.contains(panel())).toBe(false);
  });

  it("stays after the header when the header's parent stacks vertically", async () => {
    await rules.saveGlobalRule(ACCOUNT, knownRule());
    setPage(
      CONVERSATION,
      `<div id="column" style="display: flex; flex-direction: column">${conversationHtml}</div>`,
    );
    new MemberPanel(document, serviceClient()).update("conversation");
    await vi.waitFor(() => expect(panel()).not.toBeNull());
    const header = document.querySelector(".cm-conversation-header")!;
    expect(header.nextElementSibling).toBe(panel()?.parentElement);
  });

  it("shows one slim bar with the details closed until asked for", async () => {
    await rules.saveGlobalRule(ACCOUNT, knownRule());
    setPage(CONVERSATION, conversationHtml);
    new MemberPanel(document, serviceClient()).update("conversation");
    await vi.waitFor(() => expect(panel()).not.toBeNull());
    const bar = panel()!.querySelector(".joyfox-bar")!;
    expect(bar.textContent).toContain("Placement: Qualified");
    expect(bar.textContent).toContain("Local trust score:");
    expect(buttonNamed(bar, "Log positive")).toBeDefined();
    const toggle = buttonNamed(bar, "Why and move")!;
    const drawer = () => panel()!.querySelector<HTMLElement>(".joyfox-drawer")!;
    expect(toggle.getAttribute("aria-expanded")).toBe("false");
    expect(drawer().hidden).toBe(true);
    expect(toggle.getAttribute("aria-controls")).toBe(drawer().id);
    toggle.click();
    expect(drawer().hidden).toBe(false);
    expect(buttonNamed(drawer(), "Move to Quarantined")).toBeDefined();
    // Logging an outcome redraws the bar; the open drawer stays open.
    buttonNamed(bar, "Log positive")!.click();
    await vi.waitFor(() =>
      expect(
        panel()?.querySelector('[aria-label="Undo last outcome"]'),
      ).not.toBeNull(),
    );
    expect(drawer().hidden).toBe(false);
    expect(
      buttonNamed(
        panel()!.querySelector(".joyfox-bar")!,
        "Why and move",
      )?.getAttribute("aria-expanded"),
    ).toBe("true");
  });

  it("closes the details again after the page is left", async () => {
    await rules.saveGlobalRule(ACCOUNT, knownRule());
    setPage(CONVERSATION, conversationHtml);
    const memberPanel = new MemberPanel(document, serviceClient());
    memberPanel.update("conversation");
    await vi.waitFor(() => expect(panel()).not.toBeNull());
    buttonNamed(
      panel()!.querySelector(".joyfox-bar")!,
      "Why and move",
    )!.click();
    memberPanel.leave();
    expect(panel()).toBeNull();
    memberPanel.update("conversation");
    await vi.waitFor(() => expect(panel()).not.toBeNull());
    expect(panel()!.querySelector<HTMLElement>(".joyfox-drawer")!.hidden).toBe(
      true,
    );
  });

  it("offers no details toggle when there are no details to show", () => {
    const [bar, ...rest] = memberBar(document, {
      ruleOff: "No contact rule is set.",
      actions: {},
      drawerOpen: false,
      onToggle: () => undefined,
    });
    expect(rest).toEqual([]);
    expect(bar!.querySelector("[aria-expanded]")).toBeNull();
  });

  it("keeps the member strip when the inbox is torn down", async () => {
    await rules.saveGlobalRule(ACCOUNT, knownRule());
    setPage(CONVERSATION, conversationHtml);
    new MemberPanel(document, serviceClient()).update("conversation");
    await vi.waitFor(() => expect(panel()).not.toBeNull());
    const shown = panel();
    new InboxTriage(document, serviceClient()).teardown();
    expect(panel()).toBe(shown);
    expect(shown?.isConnected).toBe(true);
  });

  it("shows the placement after the header link, never inside it", async () => {
    await rules.saveGlobalRule(ACCOUNT, knownRule());
    setPage(
      "/clubmail/conversation/conversation-wrapper-personal-1234567-7654321",
      conversationHtml,
    );
    new MemberPanel(document, serviceClient()).update("conversation");
    await vi.waitFor(() => expect(panel()).not.toBeNull());
    const header = document.querySelector(".cm-conversation-header")!;
    expect(header.nextElementSibling).toBe(panel()?.parentElement);
    expect(panel()?.parentElement?.getAttribute("data-joyfox-ui")).toBe(
      "member-strip",
    );
    expect(header.contains(panel())).toBe(false);
    expect(panel()?.textContent).toContain("Placement: Qualified");
  });

  it("M6: the trust score updates at once after an outcome is logged", async () => {
    await rules.saveGlobalRule(ACCOUNT, knownRule());
    setPage(
      "/clubmail/conversation/conversation-wrapper-personal-1234567-7654321",
      conversationHtml,
    );
    new MemberPanel(document, serviceClient()).update("conversation");
    await vi.waitFor(() => expect(panel()).not.toBeNull());
    // Personally known (+1) is already listed as a contribution.
    expect(panel()?.textContent).toContain("Local trust score: 1.");
    // Nothing is logged yet, so there is nothing to undo.
    expect(
      panel()?.querySelector('[aria-label="Undo last outcome"]'),
    ).toBeNull();
    buttonNamed(panel()!, "Log positive").click();
    await vi.waitFor(() =>
      expect(panel()?.textContent).toContain("Local trust score: 2."),
    );
    expect(panel()?.textContent).toContain(
      "+1: You logged 1 positive outcome.",
    );
    expect(panel()?.textContent).toContain("not a JoyClub or community rating");
    buttonNamed(panel()!, "Undo last outcome").click();
    await vi.waitFor(() =>
      expect(panel()?.textContent).toContain("Local trust score: 1."),
    );
  });

  it("removes the panel at once when the route switches to another member", async () => {
    await rules.saveGlobalRule(ACCOUNT, knownRule());
    setPage(
      "/clubmail/conversation/conversation-wrapper-personal-1234567-7654321",
      conversationHtml,
    );
    const client = serviceClient();
    const member = new MemberPanel(document, {
      ...client,
      // The second member's answer never arrives in this test.
      evaluate: (members) =>
        client.evaluations === 0
          ? client.evaluate(members)
          : new Promise(() => undefined),
    });
    member.update("conversation");
    await vi.waitFor(() => expect(panel()).not.toBeNull());
    // Same header element, new member and URL: a client-side route.
    window.history.replaceState(
      null,
      "",
      "/clubmail/conversation/conversation-wrapper-personal-5550001-7654321",
    );
    document
      .querySelector(".cm-conversation-header")!
      .setAttribute("href", "/profile/5550001.synthetic_four.html");
    member.update("conversation");
    expect(panel()).toBeNull();
  });

  it("keeps the new member's panel when the old member's load fails late", async () => {
    await rules.saveGlobalRule(ACCOUNT, knownRule());
    setPage(
      "/clubmail/conversation/conversation-wrapper-personal-1234567-7654321",
      conversationHtml,
    );
    const client = serviceClient();
    let failFirst: () => void = () => undefined;
    let calls = 0;
    const member = new MemberPanel(document, {
      ...client,
      evaluate: (members) => {
        calls += 1;
        return calls === 1
          ? new Promise((_resolve, reject) => {
              failFirst = () => reject(new Error("slow failure"));
            })
          : client.evaluate(members);
      },
    });
    member.update("conversation");
    // A client-side route to another member before the first answer.
    window.history.replaceState(
      null,
      "",
      "/clubmail/conversation/conversation-wrapper-personal-5550001-7654321",
    );
    document
      .querySelector(".cm-conversation-header")!
      .setAttribute("href", "/profile/5550001.synthetic_four.html");
    member.update("conversation");
    await vi.waitFor(() => expect(panel()).not.toBeNull());
    failFirst();
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(panel()?.getAttribute("data-member")).toBe("5550001");
  });

  it("does not bring a panel back after leaving, when its load ends late", async () => {
    await rules.saveGlobalRule(ACCOUNT, knownRule());
    setPage(
      "/clubmail/conversation/conversation-wrapper-personal-1234567-7654321",
      conversationHtml,
    );
    const client = serviceClient();
    let release: () => void = () => undefined;
    const member = new MemberPanel(document, {
      ...client,
      evaluate: async (members) => {
        await new Promise<void>((resolve) => (release = resolve));
        return client.evaluate(members);
      },
    });
    member.update("conversation");
    // The route moves on while the header is still in the page.
    member.leave();
    release();
    await new Promise((resolve) => setTimeout(resolve, 30));
    expect(panel()).toBeNull();
  });

  it("runs trust writes in click order, so undo removes the outcome just logged", async () => {
    await rules.saveGlobalRule(ACCOUNT, knownRule());
    await trust.logOutcome(ACCOUNT, KNOWN, "negative");
    setPage(
      "/clubmail/conversation/conversation-wrapper-personal-1234567-7654321",
      conversationHtml,
    );
    const client = serviceClient();
    let releaseLog: () => void = () => undefined;
    const member = new MemberPanel(document, {
      ...client,
      // The new log is slow to reach storage.
      logTrust: async (accountId, memberId, kind) => {
        await new Promise<void>((resolve) => (releaseLog = resolve));
        await client.logTrust(accountId, memberId, kind as "positive");
      },
    });
    member.update("conversation");
    await vi.waitFor(() => expect(panel()).not.toBeNull());
    buttonNamed(panel()!, "Log positive").click();
    buttonNamed(panel()!, "Undo last outcome").click();
    await new Promise((resolve) => setTimeout(resolve, 10));
    releaseLog();
    // Let both queued writes finish before looking.
    await new Promise((resolve) => setTimeout(resolve, 100));
    const kinds = (await repositories.trustSignals.list(ACCOUNT)).map(
      (signal) => signal.kind,
    );
    expect(kinds).toEqual(["negative"]);
  });

  it("shows trust without a rule, and says the rule is not set", async () => {
    setPage(
      "/clubmail/conversation/conversation-wrapper-personal-1234567-7654321",
      conversationHtml,
    );
    new MemberPanel(document, serviceClient()).update("conversation");
    await vi.waitFor(() => expect(panel()).not.toBeNull());
    expect(panel()?.textContent).toContain("No contact rule is set");
    expect(panel()?.textContent).not.toContain("Placement:");
    expect(panel()?.textContent).toContain("Local trust score: 1.");
  });

  it("shows nothing when the header belongs to another conversation", async () => {
    await rules.saveGlobalRule(ACCOUNT, knownRule());
    setPage(
      "/clubmail/conversation/conversation-wrapper-personal-5550001-7654321",
      conversationHtml,
    );
    const client = serviceClient();
    new MemberPanel(document, client).update("conversation");
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(panel()).toBeNull();
    expect(client.evaluations).toBe(0);
  });

  it("caches the profile's facts for later inbox triage", async () => {
    await rules.saveGlobalRule(ACCOUNT, {
      ...knownRule(),
      root: {
        type: "group",
        match: "all",
        children: [condition("minimumPhotos", { value: 3 })],
      },
    });
    setPage("/profile/1234567.synthetic_one.html", profileHtml);
    const member = new MemberPanel(document, serviceClient());
    member.update("profile");
    await vi.waitFor(() => expect(panel()).not.toBeNull());
    expect(panel()?.textContent).toContain("Placement: Qualified");
    const snapshots = await repositories.profileSnapshots.list(ACCOUNT);
    expect(snapshots).toHaveLength(1);
    expect(snapshots[0]).toMatchObject({
      memberId: KNOWN,
      photoCount: 12,
      profileWordCount: 8,
    });
    // A re-render on the same page does not store the facts again.
    member.update("profile");
    member.update("profile");
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(await repositories.profileSnapshots.list(ACCOUNT)).toHaveLength(1);

    // The inbox, which shows no photo count, now uses the cached one.
    setPage("/clubmail/", inboxHtml);
    const inbox = new InboxTriage(document, serviceClient());
    inbox.update();
    await vi.waitFor(() => expect(placements()[0]).toBe("qualified"));
    expect(placements()[1]).toBe("needs-review");
    expect(VERIFIED).toBe("98765432");
  });

  it("links to the profile while the rule needs facts only it shows", async () => {
    await rules.saveGlobalRule(ACCOUNT, {
      ...knownRule(),
      root: {
        type: "group",
        match: "all",
        children: [
          condition("minimumPhotos", { value: 3 }),
          condition("minimumProfileWords", { value: 5 }),
        ],
      },
    });
    setPage(CONVERSATION, conversationHtml);
    const client = serviceClient();
    new MemberPanel(document, client).update("conversation");
    await vi.waitFor(() => expect(panel()).not.toBeNull());
    const link = panel()!.querySelector<HTMLAnchorElement>(
      "a.joyfox-bar__profile",
    );
    expect(link?.textContent).toBe("Open profile");
    expect(link?.href).toBe(
      new URL("/profile/1234567.synthetic_one.html", window.location.href).href,
    );
    expect(panel()!.querySelector(".joyfox-bar")?.textContent).toContain(
      "The photo count and profile word count are unknown. Open the profile and JoyFox reads them.",
    );
    // Opening the profile is the user's own navigation: JoyFox loaded
    // nothing by itself, so no snapshot exists yet.
    expect(await repositories.profileSnapshots.list(ACCOUNT)).toHaveLength(0);

    // The user opens the profile; its facts are captured there.
    setPage("/profile/1234567.synthetic_one.html", profileHtml);
    new MemberPanel(document, serviceClient()).update("profile");
    await vi.waitFor(async () =>
      expect(await repositories.profileSnapshots.list(ACCOUNT)).toHaveLength(1),
    );

    // Back on the conversation the facts are known, so the link goes.
    setPage(CONVERSATION, conversationHtml);
    new MemberPanel(document, serviceClient()).update("conversation");
    await vi.waitFor(() =>
      expect(panel()?.textContent).toContain("Placement: Qualified"),
    );
    expect(panel()!.querySelector("a.joyfox-bar__profile")).toBeNull();
  });

  it("shows no profile link when the rule needs no profile-only fact", async () => {
    await rules.saveGlobalRule(ACCOUNT, knownRule());
    setPage(CONVERSATION, conversationHtml);
    new MemberPanel(document, serviceClient()).update("conversation");
    await vi.waitFor(() => expect(panel()).not.toBeNull());
    expect(panel()!.querySelector("a.joyfox-bar__profile")).toBeNull();
  });

  it("names every unknown profile fact in one sentence", () => {
    const unknown = (kind: EvaluatedCondition["kind"]): EvaluatedCondition => ({
      kind,
      state: "unknown",
      outcome: "needs-review",
      reason: "",
      source: "none",
    });
    expect(
      unknownProfileFactsText([
        unknown("minimumPhotos"),
        unknown("minimumProfileWords"),
        unknown("minimumAccountAgeDays"),
        // Not a profile fact: opening the profile does not help.
        unknown("minimumTrustScore"),
      ]),
    ).toBe(
      "The photo count, profile word count and account age are unknown. Open the profile and JoyFox reads them.",
    );
    expect(unknownProfileFactsText([unknown("minimumPhotos")])).toBe(
      "The photo count is unknown. Open the profile and JoyFox reads it.",
    );
    expect(
      unknownProfileFactsText([
        { ...unknown("minimumPhotos"), state: "pass", outcome: "met" },
      ]),
    ).toBeUndefined();
  });

  it("captures the profile again for a newly active account", async () => {
    await rules.saveGlobalRule(ACCOUNT, knownRule());
    setPage("/profile/1234567.synthetic_one.html", profileHtml);
    const member = new MemberPanel(document, serviceClient());
    member.update("profile");
    await vi.waitFor(() => expect(panel()).not.toBeNull());
    activeAccount = "account-b";
    member.accountChanged();
    expect(panel()).toBeNull();
    await vi.waitFor(async () =>
      expect(
        await repositories.profileSnapshots.list("account-b"),
      ).toHaveLength(1),
    );
  });

  it("stores snapshots in the order the page showed them", async () => {
    setPage("/profile/1234567.synthetic_one.html", profileHtml);
    const stored: Array<object> = [];
    let releaseFirst: () => void = () => undefined;
    let calls = 0;
    const client = serviceClient();
    const member = new MemberPanel(document, {
      ...client,
      // The first capture is slow; the second, fuller one is fast.
      captureSnapshot: async (_accountId, _memberId, observed) => {
        calls += 1;
        if (calls === 1)
          await new Promise<void>((resolve) => (releaseFirst = resolve));
        stored.push(observed);
      },
    });
    // First the page shows no photo count yet.
    document.querySelector(".amount-badge")!.remove();
    member.update("profile");
    await vi.waitFor(() => expect(calls).toBe(1));
    // Then the photo count renders, while the first capture is still slow.
    setPage("/profile/1234567.synthetic_one.html", profileHtml);
    member.update("profile");
    await new Promise((resolve) => setTimeout(resolve, 20));
    // The second waits for the first, however slow it is.
    expect(stored).toHaveLength(0);
    releaseFirst();
    await vi.waitFor(() => expect(stored).toHaveLength(2));
    expect(stored[0]).not.toHaveProperty("photoCount");
    expect(stored[1]).toHaveProperty("photoCount", 12);
  });

  it("never applies inbox triage after leaving the inbox, even on a late change", async () => {
    await rules.saveGlobalRule(ACCOUNT, knownRule());
    setPage("/clubmail/", inboxHtml);
    const original = document.body.innerHTML;
    const inbox = new InboxTriage(document, serviceClient());
    inbox.update();
    await vi.waitFor(() => expect(bar()).not.toBeNull());
    // A conversation route that keeps the inbox list in the page.
    inbox.leave();
    expect(document.body.innerHTML).toBe(original);
    inbox.invalidate();
    await new Promise((resolve) => setTimeout(resolve, 30));
    expect(document.body.innerHTML).toBe(original);
  });

  it("ties a capture to the account its answer came from", async () => {
    await rules.saveGlobalRule(ACCOUNT, knownRule());
    setPage("/profile/1234567.synthetic_one.html", profileHtml);
    const client = serviceClient();
    const member = new MemberPanel(document, client);
    member.update("profile");
    await vi.waitFor(() =>
      expect(client.writes).toContain("capture:account-a"),
    );
    expect(client.writes.every((write) => write.endsWith(":account-a"))).toBe(
      true,
    );
  });

  it("leave removes the panel", async () => {
    await rules.saveGlobalRule(ACCOUNT, knownRule());
    setPage("/profile/1234567.synthetic_one.html", profileHtml);
    const member = new MemberPanel(document, serviceClient());
    member.update("profile");
    await vi.waitFor(() => expect(panel()).not.toBeNull());
    member.leave();
    expect(panel()).toBeNull();
  });
});
