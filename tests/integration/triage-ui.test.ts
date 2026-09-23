// @vitest-environment jsdom
import "../setup-indexeddb";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  InboxTriage,
  PLACEMENT_ATTRIBUTE,
  VIEW_ATTRIBUTE,
} from "../../src/content/inbox-triage";
import { MemberPanel } from "../../src/content/member-panel";
import type { TriageClient } from "../../src/content/triage-client";
import type {
  ContactRuleDefinition,
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
function serviceClient(): TriageClient & { evaluations: number } {
  const client = {
    evaluations: 0,
    evaluate(members: Parameters<TriageClient["evaluate"]>[0]) {
      client.evaluations += 1;
      return triage.evaluate(activeAccount, members);
    },
    async setOverride(memberId: string, placement: never) {
      if (activeAccount)
        await triage.setOverride(activeAccount, memberId, placement);
    },
    getTrust: (memberId: string, observed: object) =>
      triage.trustFor(activeAccount, memberId, observed),
    async logTrust(memberId: string, kind: "positive") {
      if (activeAccount) await trust.logOutcome(activeAccount, memberId, kind);
    },
    async undoTrust(memberId: string) {
      if (activeAccount) await trust.undoLastOutcome(activeAccount, memberId);
    },
    async captureSnapshot(memberId: string, observed: object) {
      if (activeAccount)
        await triage.captureSnapshot(activeAccount, memberId, observed);
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
const buttonNamed = (root: ParentNode, text: string) => {
  const match = Array.from(root.querySelectorAll("button")).find((node) =>
    node.textContent?.startsWith(text),
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

describe("conversation and profile panel", () => {
  const panel = () => document.querySelector('[data-joyfox-ui="member-panel"]');

  it("shows the placement after the header link, never inside it", async () => {
    await rules.saveGlobalRule(ACCOUNT, knownRule());
    setPage(
      "/clubmail/conversation/conversation-wrapper-personal-1234567-7654321",
      conversationHtml,
    );
    new MemberPanel(document, serviceClient()).update("conversation");
    await vi.waitFor(() => expect(panel()).not.toBeNull());
    const header = document.querySelector(".cm-conversation-header")!;
    expect(header.nextElementSibling).toBe(panel());
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
      profileWordCount: 13,
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
