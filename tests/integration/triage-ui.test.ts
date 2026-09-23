// @vitest-environment jsdom
import "../setup-indexeddb";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  InboxTriage,
  inboxListShown,
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
    expect(inboxListShown("conversation", document)).toBe(true);
    const inbox = new InboxTriage(document, serviceClient());
    inbox.update();
    await vi.waitFor(() => expect(bar()).not.toBeNull());
    expect(placements()).toEqual(["qualified", "quarantined", "needs-review"]);
    // A list JoyClub keeps in the page but hides does not count.
    list().setAttribute("style", "display: none");
    expect(inboxListShown("conversation", document)).toBe(false);
    expect(inboxListShown("inbox", document)).toBe(true);
    expect(inboxListShown("profile", document)).toBe(false);
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
    // Nothing is logged yet, so there is nothing to undo.
    expect(panel()?.textContent).not.toContain("Undo last outcome");
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
