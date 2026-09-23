// @vitest-environment jsdom
import "../setup-indexeddb";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ActionLogService } from "../../src/actions/action-log-service";
import {
  runQuickIgnoreDelete,
  type ActionRecorder,
  type QuickActionDriver,
} from "../../src/actions/executor";
import {
  STALE_AFTER_MS,
  type ActionStep,
  type CurrentTarget,
} from "../../src/actions/ignore-delete";
import { registerActionHandlers } from "../../src/background/action-handlers";
import {
  liveQuickActionDriver,
  messageQuickActionClient,
  QUICK_ACTION_TEXT,
  QuickIgnoreDelete,
  type QuickActionClient,
} from "../../src/content/quick-action";
import type { MessageContract } from "../../src/messaging/protocol";
import { MessageRouter } from "../../src/messaging/router";
import { ACTION_REVISION_KEY } from "../../src/storage/action-revision";
import { repositories } from "../../src/storage/repositories";
import { MemorySettingsArea } from "../memory-settings";
import { freshDatabase } from "../setup-indexeddb";
import conversationHtml from "../fixtures/joyclub/conversation.html?raw";

const MEMBER = "1234567";
const CONVERSATION = "personal-1234567-7654321";
const TARGET = { memberId: MEMBER, conversationId: CONVERSATION };
const HERE: CurrentTarget = { page: "conversation", ...TARGET };
let active: string | undefined;
let clock: number;
let router: MessageRouter;
let client: QuickActionClient;

function backgroundRouter(): MessageRouter {
  const next = new MessageRouter();
  registerActionHandlers(next, {
    // One test clock for the background, so "later" can be simulated.
    actions: new ActionLogService(undefined, undefined, () =>
      new Date(clock).toISOString(),
    ),
    activeAccountId: () => Promise.resolve(active),
    now: () => clock,
  });
  return next;
}

beforeEach(async () => {
  await freshDatabase();
  active = "account-a";
  clock = Date.now();
  router = backgroundRouter();
  client = messageQuickActionClient((message) => router.route(message));
});

afterEach(() => {
  document.body.innerHTML = "";
});

/** A scripted stand-in for JoyClub. It records every click it receives. */
class FakeDriver implements QuickActionDriver {
  clicks: string[] = [];
  current: () => CurrentTarget = () => HERE;
  controls: Partial<Record<ActionStep, boolean>> = {};
  confirmation: Partial<Record<ActionStep, "shown" | "missing" | "none">> = {};
  verified: Partial<Record<ActionStep, boolean>> = {};
  afterClick?: (click: string) => void | Promise<void>;
  currentTarget(): CurrentTarget {
    return this.current();
  }
  hasControl(step: ActionStep): boolean {
    return this.controls[step] ?? true;
  }
  async request(step: ActionStep): Promise<void> {
    this.clicks.push(`request:${step}`);
    await this.afterClick?.(`request:${step}`);
  }
  async awaitConfirmation(step: ActionStep) {
    return this.confirmation[step] ?? "shown";
  }
  async confirm(step: ActionStep): Promise<void> {
    this.clicks.push(`confirm:${step}`);
    await this.afterClick?.(`confirm:${step}`);
  }
  async verify(step: ActionStep): Promise<boolean> {
    return this.verified[step] ?? true;
  }
}

const run = (
  driver: QuickActionDriver,
  recorder: ActionRecorder = client.recorder("account-a"),
  extra: Partial<Parameters<typeof runQuickIgnoreDelete>[0]> = {},
) =>
  runQuickIgnoreDelete({
    target: TARGET,
    driver,
    recorder,
    timeoutMs: 200,
    ...extra,
  });

/** The stored ActionLog steps, as `name` or `name:errorCode`. */
async function logged(account = "account-a"): Promise<string[][]> {
  const logs = await repositories.actionLogs.list(account);
  return logs.map((log) =>
    log.steps.map((step) =>
      step.errorCode ? `${step.name}:${step.errorCode}` : step.name,
    ),
  );
}

const FULL = [
  "Started",
  "IgnoreRequested",
  "IgnoreConfirmed",
  "DeleteRequested",
  "DeleteConfirmed",
  "Completed",
];

describe("M9 manual test matrix, synthetic (build plan Section 24)", () => {
  it("case 1: Ignore and Delete both succeed", async () => {
    const driver = new FakeDriver();
    const result = await run(driver);
    expect(driver.clicks).toEqual([
      "request:ignore",
      "confirm:ignore",
      "request:delete",
      "confirm:delete",
    ]);
    expect(await logged()).toEqual([FULL]);
    expect(result.report).toMatchObject({
      status: "completed",
      ignore: "done",
      delete: "done",
    });
    const [log] = await repositories.actionLogs.list("account-a");
    expect(log).toMatchObject({
      memberId: MEMBER,
      conversationId: CONVERSATION,
      action: "quick-ignore-delete",
    });
    // The member directory carries the member the log refers to.
    expect(
      (await repositories.joyClubMembers.list("account-a")).map((m) => m.id),
    ).toEqual([MEMBER]);
  });

  it("case 2: Ignore control missing, nothing is clicked", async () => {
    const driver = new FakeDriver();
    driver.controls.ignore = false;
    const result = await run(driver);
    expect(driver.clicks).toEqual([]);
    expect(await logged()).toEqual([["Started", "Failed:control-missing"]]);
    expect(result.report.lines).toContain("Nothing was changed on JoyClub.");
  });

  it("case 3: Ignore confirmation missing stops before any Delete", async () => {
    const driver = new FakeDriver();
    driver.confirmation.ignore = "missing";
    const result = await run(driver);
    expect(driver.clicks).toEqual(["request:ignore"]);
    expect(await logged()).toEqual([
      ["Started", "IgnoreRequested", "Failed:confirmation-missing"],
    ]);
    expect(result.report).toMatchObject({
      ignore: "unknown",
      delete: "not-done",
    });
    expect(result.report.lines).toContain(
      "JoyClub's confirmation for Ignore did not appear.",
    );
  });

  it("case 4: Ignore succeeds, Delete control missing: Ignore is kept and reported", async () => {
    const driver = new FakeDriver();
    driver.controls.delete = false;
    const result = await run(driver);
    expect(driver.clicks).toEqual(["request:ignore", "confirm:ignore"]);
    expect(await logged()).toEqual([
      [
        "Started",
        "IgnoreRequested",
        "IgnoreConfirmed",
        "Failed:control-missing",
      ],
    ]);
    expect(result.report).toMatchObject({ ignore: "done", delete: "not-done" });
    expect(result.report.lines).toEqual(
      expect.arrayContaining([
        "Ignore: done. JoyClub ignores this member.",
        "Delete: not done.",
        "JoyFox could not find JoyClub's Delete control.",
        "JoyFox did not undo anything.",
      ]),
    );
  });

  it("case 5: Delete confirmation fails, or JoyClub does not show success", async () => {
    const missing = new FakeDriver();
    missing.confirmation.delete = "missing";
    expect((await run(missing)).report.lines).toContain(
      "JoyClub's confirmation for Delete did not appear.",
    );
    const unverified = new FakeDriver();
    unverified.verified.delete = false;
    const report = (await run(unverified)).report;
    expect(report).toMatchObject({ ignore: "done", delete: "unknown" });
    expect(report.lines).toContain(
      "JoyClub did not show that Delete succeeded.",
    );
    expect(await logged()).toEqual(
      expect.arrayContaining([
        [
          "Started",
          "IgnoreRequested",
          "IgnoreConfirmed",
          "DeleteRequested",
          "Failed:confirmation-missing",
        ],
        [
          "Started",
          "IgnoreRequested",
          "IgnoreConfirmed",
          "DeleteRequested",
          "Failed:not-verified",
        ],
      ]),
    );
  });

  it("case 6: a step that never answers times out, and a page that goes away stops the run", async () => {
    const hanging = new FakeDriver();
    hanging.afterClick = (click) =>
      click === "request:ignore" ? new Promise(() => undefined) : undefined;
    const result = await run(hanging);
    expect(result.report.failure).toBe("timeout");
    expect(result.report.ignore).toBe("unknown");
    const gone = new FakeDriver();
    gone.afterClick = (click) => {
      if (click === "confirm:ignore") gone.current = () => ({ page: "other" });
    };
    const stopped = await run(gone);
    expect(stopped.report.failure).toBe("identity-unavailable");
    expect(gone.clicks).toEqual(["request:ignore", "confirm:ignore"]);
  });

  it("case 7: a closed tab leaves an interrupted log with the exact step reached", async () => {
    const recorder = client.recorder("account-a");
    const begun = await recorder.begin(TARGET);
    if (begun.status !== "started") throw new Error("not started");
    await recorder.record(begun.operationId, "IgnoreRequested");
    // The tab closes here. Later, the page asks for the member's last run.
    clock += STALE_AFTER_MS + 60_000;
    const answer = await client.latest(MEMBER);
    expect(answer).toMatchObject({
      status: "ok",
      report: { status: "interrupted", ignore: "unknown", delete: "not-done" },
    });
    // An interrupted run does not block a new one.
    const again = await client.recorder("account-a").begin(TARGET);
    expect(again.status).toBe("started");
  });

  it("case 8: member identity mismatch stops before the click", async () => {
    const driver = new FakeDriver();
    driver.current = () => ({ ...HERE, memberId: "5550001" });
    expect((await run(driver)).report.failure).toBe("member-mismatch");
    expect(driver.clicks).toEqual([]);
    // Also between Ignore and its confirmation.
    const mid = new FakeDriver();
    mid.afterClick = (click) => {
      if (click === "request:ignore")
        mid.current = () => ({ ...HERE, memberId: "5550001" });
    };
    expect((await run(mid)).report.failure).toBe("member-mismatch");
    expect(mid.clicks).toEqual(["request:ignore"]);
  });

  it("case 9: conversation identity mismatch stops before Delete", async () => {
    const driver = new FakeDriver();
    driver.afterClick = (click) => {
      if (click === "confirm:ignore")
        driver.current = () => ({
          ...HERE,
          conversationId: "personal-1234567-1111111",
        });
    };
    const result = await run(driver);
    expect(result.report.failure).toBe("conversation-mismatch");
    expect(result.report).toMatchObject({ ignore: "done", delete: "not-done" });
    expect(driver.clicks).not.toContain("request:delete");
  });

  it("case 10: markup that changes between steps stops the run", async () => {
    const driver = new FakeDriver();
    driver.afterClick = (click) => {
      if (click === "confirm:ignore")
        driver.current = () => ({ page: "conversation", memberId: MEMBER });
    };
    const result = await run(driver);
    expect(result.report.failure).toBe("identity-unavailable");
    expect(driver.clicks).not.toContain("request:delete");
  });

  it("case 11: the run continues after the background restarts", async () => {
    const first = client.recorder("account-a");
    let recorder: ActionRecorder = first;
    const driver = new FakeDriver();
    driver.afterClick = (click) => {
      if (click !== "confirm:ignore") return;
      // A new background: new services, no memory, the same database.
      const restarted = backgroundRouter();
      recorder = messageQuickActionClient((message) =>
        restarted.route(message),
      ).recorder("account-a");
    };
    const result = await run(driver, {
      begin: (target) => recorder.begin(target),
      record: (id, state, failure) => recorder.record(id, state, failure),
    });
    expect(result.report.status).toBe("completed");
    expect(await logged()).toEqual([FULL]);
  });

  it("case 12: another account activated mid-sequence stops before the next click", async () => {
    const driver = new FakeDriver();
    driver.afterClick = (click) => {
      if (click === "confirm:ignore") active = "account-b";
    };
    const result = await run(driver);
    expect(driver.clicks).toEqual(["request:ignore", "confirm:ignore"]);
    expect(result.report).toMatchObject({
      failure: "account-changed",
      ignore: "done",
      delete: "not-done",
    });
    // Account A's log stops where it could still write; B has nothing.
    expect(await logged("account-a")).toEqual([["Started", "IgnoreRequested"]]);
    expect(await logged("account-b")).toEqual([]);
  });

  it("never clicks when the step cannot be recorded first", async () => {
    const driver = new FakeDriver();
    const result = await run(driver, {
      begin: (target) => client.recorder("account-a").begin(target),
      record: () => Promise.reject(new Error("storage failed")),
    });
    expect(driver.clicks).toEqual([]);
    expect(result.report.failure).toBe("log-unavailable");
    expect(result.report.lines).toContain("Nothing was changed on JoyClub.");
  });

  it("checks identity again after storing, right before the click", async () => {
    const driver = new FakeDriver();
    const recorder = client.recorder("account-a");
    // The page switches member while IgnoreRequested is being stored.
    const result = await run(driver, {
      begin: (target) => recorder.begin(target),
      record: async (id, state, failure) => {
        const answer = await recorder.record(id, state, failure);
        if (state === "IgnoreRequested")
          driver.current = () => ({ ...HERE, memberId: "5550001" });
        return answer;
      },
    });
    expect(driver.clicks).toEqual([]);
    expect(result.report.failure).toBe("member-mismatch");
    // The log says the step was started, never less than happened.
    expect(await logged()).toEqual([
      ["Started", "IgnoreRequested", "Failed:member-mismatch"],
    ]);
  });

  it("stops before the click when the account changes while storing", async () => {
    let stop: "account-changed" | undefined;
    const driver = new FakeDriver();
    const recorder = client.recorder("account-a");
    const result = await run(
      driver,
      {
        begin: (target) => recorder.begin(target),
        record: async (id, state, failure) => {
          const answer = await recorder.record(id, state, failure);
          if (state === "DeleteRequested") stop = "account-changed";
          return answer;
        },
      },
      { stopReason: () => stop },
    );
    expect(driver.clicks).toEqual(["request:ignore", "confirm:ignore"]);
    expect(result.report.failure).toBe("account-changed");
  });

  it("contains a driver that throws, and closes the log", async () => {
    const driver = new FakeDriver();
    driver.afterClick = (click) => {
      if (click === "confirm:ignore")
        driver.current = () => {
          throw new Error("markup changed");
        };
    };
    const result = await run(driver);
    expect(result.report).toMatchObject({
      failure: "step-error",
      ignore: "done",
      delete: "not-done",
    });
    expect(await logged()).toEqual([
      ["Started", "IgnoreRequested", "IgnoreConfirmed", "Failed:step-error"],
    ]);
    const states: string[] = [];
    const noisy = await run(new FakeDriver(), undefined, {
      onState: (state) => {
        states.push(state);
        throw new Error("display failed");
      },
    });
    expect(noisy.report.status).toBe("completed");
    expect(states).toContain("Completed");
  });

  it("keeps Ignore as done on screen when its result cannot be stored", async () => {
    const recorder = client.recorder("account-a");
    let lost = true;
    const result = await run(new FakeDriver(), {
      begin: (target) => recorder.begin(target),
      record: (id, state, failure) => {
        if (state === "IgnoreConfirmed" && lost) {
          lost = false;
          return Promise.reject(new Error("port closed"));
        }
        return recorder.record(id, state, failure);
      },
    });
    expect(result.report).toMatchObject({ ignore: "done", delete: "not-done" });
    expect(result.report.lines).toContain(
      "JoyFox could not write to its action log, so it stopped before Delete.",
    );
    // The stored log reads "not confirmed", never "not done".
    const stored = await client.latest(MEMBER);
    expect(stored).toMatchObject({ report: { ignore: "unknown" } });
    if (stored.status !== "ok") throw new Error("no report");
    expect(stored.report.lines).toContain(
      "JoyFox could not write to its action log, so it stopped during Ignore.",
    );
  });

  it("does not click Delete once the page is the profile", async () => {
    const driver = new FakeDriver();
    driver.afterClick = (click) => {
      if (click === "confirm:ignore")
        driver.current = () => ({ page: "profile", memberId: MEMBER });
    };
    const result = await run(driver);
    expect(result.report.failure).toBe("identity-unavailable");
    expect(driver.clicks).not.toContain("request:delete");
  });

  it("refuses every step of a run that a newer run replaced", async () => {
    const driver = new FakeDriver();
    driver.afterClick = async (click) => {
      if (click !== "request:ignore") return;
      // This tab stalls past the interrupted threshold; another tab starts
      // a new run for the same member, which is allowed.
      clock += STALE_AFTER_MS + 60_000;
      const newer = await client.recorder("account-a").begin(TARGET);
      expect(newer.status).toBe("started");
    };
    const result = await run(driver);
    // The stalled run finishes the click it was in, then may not go on.
    expect(driver.clicks).toEqual(["request:ignore", "confirm:ignore"]);
    expect(result.report.failure).toBe("superseded");
    expect(result.report.lines).toContain(
      "A newer Ignore and Delete for this member started, so JoyFox stopped before Delete.",
    );
    const logs = await repositories.actionLogs.list("account-a");
    expect(logs.map((log) => log.steps.at(-1)?.name).sort()).toEqual([
      "IgnoreRequested",
      "Started",
    ]);
  });

  it("refuses a second run for a member while one is running", async () => {
    const recorder = client.recorder("account-a");
    await recorder.begin(TARGET);
    const second = await run(new FakeDriver());
    expect(second.status).toBe("busy");
    expect(await logged()).toHaveLength(1);
  });
});

describe("M9 ActionLog messages", () => {
  const send = <K extends keyof MessageContract>(
    type: K,
    payload: MessageContract[K]["request"],
  ) => router.route({ type, requestId: "r1", payload });

  it("refuses a transition the state machine does not allow", async () => {
    const begun = await client.recorder("account-a").begin(TARGET);
    if (begun.status !== "started") throw new Error("not started");
    const record = client.recorder("account-a").record;
    expect(await record(begun.operationId, "DeleteRequested")).toBe("invalid");
    expect(await record(begun.operationId, "Failed")).toBe("invalid");
    expect(await record(begun.operationId, "IgnoreRequested", "timeout")).toBe(
      "invalid",
    );
    expect(await record("action:unknown", "IgnoreRequested")).toBe(
      "unknown-operation",
    );
    expect(await logged()).toEqual([["Started"]]);
  });

  it("rejects malformed payloads and stores nothing", async () => {
    const rejected = { ok: false, error: { code: "HANDLER_FAILED" } };
    expect(
      await send("action.ignoreDelete.start", {
        accountId: "account-a",
        memberId: "Synthetic Name",
        conversationId: CONVERSATION,
      }),
    ).toMatchObject(rejected);
    expect(
      await send("action.ignoreDelete.start", {
        accountId: "account-a",
        memberId: MEMBER,
        conversationId: "conversation 1",
      }),
    ).toMatchObject(rejected);
    expect(
      await send("action.ignoreDelete.record", {
        accountId: "account-a",
        operationId: "x",
        state: "Deleted" as never,
      }),
    ).toMatchObject(rejected);
    expect(
      await send("action.ignoreDelete.record", {
        accountId: "account-a",
        operationId: "x",
        state: "Failed",
        failure: "oops" as never,
      }),
    ).toMatchObject(rejected);
    expect(await logged()).toEqual([]);
  });

  it("stores the conversation ID only as text", async () => {
    const log = {
      id: "action:synthetic",
      accountId: "account-a",
      action: "quick-ignore-delete",
      steps: [],
      createdAt: "2026-09-23T10:00:00.000Z",
      updatedAt: "2026-09-23T10:00:00.000Z",
    };
    await expect(
      repositories.actionLogs.put("account-a", {
        ...log,
        conversationId: 3 as never,
      }),
    ).rejects.toThrow(/conversationId/);
    await repositories.actionLogs.put("account-a", {
      ...log,
      conversationId: CONVERSATION,
    });
  });

  it("marks every stored transition, so other tabs refresh", async () => {
    const settings = new MemorySettingsArea();
    const marked = new MessageRouter();
    registerActionHandlers(marked, {
      actions: new ActionLogService(),
      activeAccountId: () => Promise.resolve(active),
      settings,
    });
    const recorder = messageQuickActionClient((message) =>
      marked.route(message),
    ).recorder("account-a");
    const revision = () => settings.items.get(ACTION_REVISION_KEY);
    const begun = await recorder.begin(TARGET);
    if (begun.status !== "started") throw new Error("not started");
    const afterStart = revision();
    expect(afterStart).toEqual(expect.any(String));
    await recorder.record(begun.operationId, "DeleteRequested");
    expect(revision()).toBe(afterStart);
    await recorder.record(begun.operationId, "IgnoreRequested");
    expect(revision()).not.toBe(afterStart);
  });

  it("returns the stored conversation and when the run last moved", async () => {
    const begun = await client.recorder("account-a").begin(TARGET);
    if (begun.status !== "started") throw new Error("not started");
    expect(await client.latest(MEMBER)).toMatchObject({
      status: "ok",
      conversationId: CONVERSATION,
      updatedAt: new Date(clock).toISOString(),
    });
  });

  it("answers no-account and none", async () => {
    expect(await client.latest(MEMBER)).toEqual({
      status: "none",
      accountId: "account-a",
    });
    active = undefined;
    expect(await client.latest(MEMBER)).toEqual({ status: "no-account" });
  });
});

describe("M9 button and notice", () => {
  const section = () =>
    document.querySelector<HTMLElement>('[data-joyfox-ui="quick-action"]');
  const runButton = () =>
    Array.from(section()?.querySelectorAll("button") ?? []).find(
      (node) => node.textContent === QUICK_ACTION_TEXT.button,
    );
  const notice = () => section()?.textContent ?? "";

  function openConversation(driver?: QuickActionDriver) {
    window.history.replaceState(
      null,
      "",
      `/clubmail/conversation/conversation-wrapper-${CONVERSATION}`,
    );
    document.body.innerHTML = conversationHtml;
    const quick = new QuickIgnoreDelete(document, client, () => driver);
    quick.update();
    return quick;
  }

  it("never appears without a live driver, which waits on F7", async () => {
    expect(liveQuickActionDriver()).toBeUndefined();
    openConversation(liveQuickActionDriver());
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(section()).toBeNull();
  });

  it("runs on one click and shows what was done", async () => {
    const driver = new FakeDriver();
    openConversation(driver);
    await vi.waitFor(() => expect(runButton()).toBeDefined());
    const header = document.querySelector(".cm-conversation-header")!;
    expect(header.nextElementSibling).toBe(section());
    expect(notice()).toContain("It never sends a message.");
    runButton()!.click();
    await vi.waitFor(() =>
      expect(notice()).toContain("Ignore and Delete finished."),
    );
    expect(driver.clicks).toHaveLength(4);
    expect(await logged()).toEqual([FULL]);
  });

  it("names the failed step and the next manual action", async () => {
    const driver = new FakeDriver();
    driver.controls.delete = false;
    openConversation(driver);
    await vi.waitFor(() => expect(runButton()).toBeDefined());
    runButton()!.click();
    await vi.waitFor(() =>
      expect(notice()).toContain(
        "JoyFox could not find JoyClub's Delete control.",
      ),
    );
    expect(notice()).toContain("Ignore: done.");
    expect(notice()).toContain("move it there yourself");
    const status = section()?.querySelector('[role="status"]');
    expect(status?.getAttribute("aria-live")).toBe("polite");
  });

  it("shows an interrupted earlier run from the ActionLog", async () => {
    const begun = await client.recorder("account-a").begin(TARGET);
    if (begun.status !== "started") throw new Error("not started");
    await client
      .recorder("account-a")
      .record(begun.operationId, "IgnoreRequested");
    clock += STALE_AFTER_MS + 60_000;
    openConversation(new FakeDriver());
    await vi.waitFor(() =>
      expect(notice()).toContain(QUICK_ACTION_TEXT.previous),
    );
    expect(notice()).toContain("was interrupted");
    expect(notice()).toContain("Ignore: not confirmed.");
  });

  it("ignores a second click while running", async () => {
    const driver = new FakeDriver();
    let release: () => void = () => undefined;
    driver.afterClick = (click) =>
      click === "request:ignore"
        ? new Promise<void>((resolve) => {
            release = resolve;
          })
        : undefined;
    openConversation(driver);
    await vi.waitFor(() => expect(runButton()).toBeDefined());
    runButton()!.click();
    await vi.waitFor(() => expect(driver.clicks).toEqual(["request:ignore"]));
    expect(runButton()?.getAttribute("aria-disabled")).toBe("true");
    runButton()!.click();
    release();
    await vi.waitFor(() =>
      expect(notice()).toContain("Ignore and Delete finished."),
    );
    expect(await logged()).toHaveLength(1);
  });

  it("stops before the next click when the account changes", async () => {
    const driver = new FakeDriver();
    let release: () => void = () => undefined;
    driver.afterClick = (click) =>
      click === "confirm:ignore"
        ? new Promise<void>((resolve) => {
            release = resolve;
          })
        : undefined;
    const quick = openConversation(driver);
    await vi.waitFor(() => expect(runButton()).toBeDefined());
    runButton()!.click();
    await vi.waitFor(() => expect(driver.clicks).toContain("confirm:ignore"));
    active = "account-b";
    quick.accountChanged();
    release();
    await vi.waitFor(() =>
      expect(notice()).toContain("The active JoyFox account changed"),
    );
    expect(driver.clicks).not.toContain("request:delete");
  });

  it("keeps one live region while the run moves", async () => {
    const driver = new FakeDriver();
    openConversation(driver);
    await vi.waitFor(() => expect(runButton()).toBeDefined());
    const region = section()?.querySelector('[role="status"]');
    runButton()!.click();
    await vi.waitFor(() =>
      expect(notice()).toContain("Ignore and Delete finished."),
    );
    expect(section()?.querySelector('[role="status"]')).toBe(region);
  });

  it("ties a run to its conversation and shows its result on the next one", async () => {
    const driver = new FakeDriver();
    let release: () => void = () => undefined;
    driver.afterClick = (click) =>
      click === "request:ignore"
        ? new Promise<void>((resolve) => {
            release = resolve;
          })
        : undefined;
    const quick = openConversation(driver);
    await vi.waitFor(() => expect(runButton()).toBeDefined());
    runButton()!.click();
    await vi.waitFor(() => expect(driver.clicks).toEqual(["request:ignore"]));
    // JoyClub routes to another member's conversation in place.
    window.history.replaceState(
      null,
      "",
      "/clubmail/conversation/conversation-wrapper-personal-5550001-7654321",
    );
    document
      .querySelector(".cm-conversation-header")!
      .setAttribute("href", "/profile/5550001.synthetic_four.html");
    driver.current = () => ({
      page: "conversation",
      memberId: "5550001",
      conversationId: "personal-5550001-7654321",
    });
    quick.update();
    await vi.waitFor(() =>
      expect(notice()).toContain(QUICK_ACTION_TEXT.otherRunning),
    );
    expect(runButton()?.getAttribute("aria-disabled")).toBe("true");
    release();
    await vi.waitFor(() =>
      expect(notice()).toContain(QUICK_ACTION_TEXT.otherResult),
    );
    expect(notice()).toContain("The page showed another member");
    expect(notice()).toContain("Ignore: not confirmed.");
    expect(driver.clicks).toEqual(["request:ignore"]);
    expect(runButton()?.getAttribute("aria-disabled")).toBe("false");
  });

  it("stops a run and stays hidden when the flag is turned off", async () => {
    const driver = new FakeDriver();
    let release: () => void = () => undefined;
    driver.afterClick = (click) =>
      click === "request:ignore"
        ? new Promise<void>((resolve) => {
            release = resolve;
          })
        : undefined;
    const quick = openConversation(driver);
    await vi.waitFor(() => expect(runButton()).toBeDefined());
    runButton()!.click();
    await vi.waitFor(() => expect(driver.clicks).toEqual(["request:ignore"]));
    quick.turnOff();
    expect(section()).toBeNull();
    release();
    await vi.waitFor(async () =>
      expect((await logged())[0]?.at(-1)).toBe("Failed:turned-off"),
    );
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(section()).toBeNull();
    expect(driver.clicks).toEqual(["request:ignore"]);
  });

  it("follows another tab's run, and says a busy click did nothing", async () => {
    const quick = openConversation(new FakeDriver());
    await vi.waitFor(() => expect(runButton()).toBeDefined());
    // Another tab starts a run for the same member.
    const other = client.recorder("account-a");
    const begun = await other.begin(TARGET);
    if (begun.status !== "started") throw new Error("not started");
    quick.invalidate();
    await vi.waitFor(() =>
      expect(runButton()?.getAttribute("aria-disabled")).toBe("true"),
    );
    // The other tab's run stops; the next revision event reloads the log.
    await other.record(begun.operationId, "Failed", "control-missing");
    quick.invalidate();
    await vi.waitFor(() =>
      expect(runButton()?.getAttribute("aria-disabled")).toBe("false"),
    );
    expect(notice()).toContain(QUICK_ACTION_TEXT.previous);
  });

  it("labels an earlier run from another conversation with the member", async () => {
    const begun = await client
      .recorder("account-a")
      .begin({ ...TARGET, conversationId: "personal-1234567-1111111" });
    if (begun.status !== "started") throw new Error("not started");
    await client
      .recorder("account-a")
      .record(begun.operationId, "Failed", "control-missing");
    openConversation(new FakeDriver());
    await vi.waitFor(() =>
      expect(notice()).toContain(QUICK_ACTION_TEXT.previousOther),
    );
    expect(notice()).not.toContain(QUICK_ACTION_TEXT.previous);
  });

  it("sets the stale timer once, from when the other run last moved", async () => {
    const quick = openConversation(new FakeDriver());
    await vi.waitFor(() => expect(runButton()).toBeDefined());
    // Another tab's run last moved 110 seconds ago.
    clock = Date.now() - (STALE_AFTER_MS - 10_000);
    const begun = await client.recorder("account-a").begin(TARGET);
    if (begun.status !== "started") throw new Error("not started");
    const timer = vi.spyOn(globalThis, "setTimeout");
    const staleTimers = () =>
      timer.mock.calls.filter(([, delay]) => (delay ?? 0) >= 5_000);
    quick.invalidate();
    await vi.waitFor(() =>
      expect(runButton()?.getAttribute("aria-disabled")).toBe("true"),
    );
    expect(staleTimers()).toHaveLength(1);
    const delay = staleTimers()[0]![1]!;
    expect(delay).toBeGreaterThan(5_000);
    expect(delay).toBeLessThan(15_000);
    // Page mutations redraw often; none may postpone the timer.
    for (let index = 0; index < 5; index += 1) quick.update();
    expect(staleTimers()).toHaveLength(1);
    timer.mockRestore();
  });

  it("shows nothing without an active account", async () => {
    active = undefined;
    openConversation(new FakeDriver());
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(section()).toBeNull();
  });
});
