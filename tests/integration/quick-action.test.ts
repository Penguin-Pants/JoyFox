// @vitest-environment jsdom
import "../setup-indexeddb";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { texts } from "../i18n-text";
import { t } from "../../src/i18n/translator";
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
  profileUrl,
  QUICK_ACTION_TEXT,
  QuickIgnoreDelete,
  type QuickActionClient,
} from "../../src/content/quick-action";
import { JoyClubQuickActionDriver } from "../../src/content/quick-action-driver";
import type { MessageContract } from "../../src/messaging/protocol";
import { MessageRouter } from "../../src/messaging/router";
import { ACTION_REVISION_KEY } from "../../src/storage/action-revision";
import { repositories } from "../../src/storage/repositories";
import { MemorySettingsArea } from "../memory-settings";
import { freshDatabase } from "../setup-indexeddb";
import conversationHtml from "../fixtures/joyclub/conversation.html?raw";
import profileHtml from "../fixtures/joyclub/profile.html?raw";

const MEMBER = "1234567";
const CONVERSATION = "personal-1234567-7654321";
const TARGET = { memberId: MEMBER, conversationId: CONVERSATION };
const HERE: CurrentTarget = { page: "conversation", ...TARGET };
let active: string | undefined;
let clock: number;
let router: MessageRouter;
let client: QuickActionClient;
/** `storage.session`, shared by every background a test starts. */
let session: MemorySettingsArea;
/** The tab the test's content script runs in. */
const TAB = 7;

function backgroundRouter(): MessageRouter {
  const next = new MessageRouter();
  registerActionHandlers(next, {
    // One test clock for the background, so "later" can be simulated.
    actions: new ActionLogService(undefined, undefined, () =>
      new Date(clock).toISOString(),
    ),
    activeAccountId: () => Promise.resolve(active),
    now: () => clock,
    session,
  });
  return next;
}

/** A content script's client in one tab; the browser names the tab. */
const tabClient = (tabId = TAB, via = () => router) =>
  messageQuickActionClient((message) =>
    via().route(message, { tabId, url: window.location.href }),
  );

/** The run's conversation page, where a hand-off starts. */
const CONVERSATION_URL = `${window.location.origin}/clubmail/conversation/conversation-wrapper-${CONVERSATION}/`;

/** The same tab's client while it shows the run's conversation. */
const fromConversation = (tabId = TAB) =>
  messageQuickActionClient((message) =>
    router.route(message, { tabId, url: CONVERSATION_URL }),
  );

/** The run's member's profile, where a hand-off goes. */
const PROFILE_PATH = "/profile/1234567.synthetic_one.html";
const onProfilePage = () => window.history.replaceState(null, "", PROFILE_PATH);

beforeEach(async () => {
  await freshDatabase();
  active = "account-a";
  clock = Date.now();
  session = new MemorySettingsArea();
  router = backgroundRouter();
  client = tabClient();
});

afterEach(() => {
  document.body.innerHTML = "";
});

/** The sender's profile page, where Ignore is (F7, Path B). */
const PROFILE: CurrentTarget = { page: "profile", memberId: MEMBER };

/**
 * A scripted stand-in for JoyClub. It records every click it receives. It
 * starts on the conversation page and, once Delete is verified, shows the
 * sender's profile, as the live run does after its hand-off.
 */
class FakeDriver implements QuickActionDriver {
  clicks: string[] = [];
  page: "conversation" | "profile" = "conversation";
  current: () => CurrentTarget = () =>
    this.page === "conversation" ? HERE : PROFILE;
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
    const ok = this.verified[step] ?? true;
    if (step === "delete" && ok) this.page = "profile";
    return ok;
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
  "DeleteRequested",
  "DeleteConfirmed",
  "IgnoreRequested",
  "IgnoreConfirmed",
  "Completed",
];

const ALL_CLICKS = [
  "request:delete",
  "confirm:delete",
  "request:ignore",
  "confirm:ignore",
];

describe("M9 manual test matrix, synthetic (build plan Section 24)", () => {
  it("case 1: Delete and Ignore both succeed", async () => {
    const driver = new FakeDriver();
    const result = await run(driver);
    expect(driver.clicks).toEqual(ALL_CLICKS);
    expect(await logged()).toEqual([FULL]);
    expect(result.report).toMatchObject({
      status: "completed",
      ignore: "done",
      delete: "done",
    });
    expect(texts(result.report.lines)).toEqual([
      "Ignore and Delete finished.",
      "Delete: done. JoyClub moved the conversation to the trash.",
      "Ignore: done. JoyClub ignores this member.",
    ]);
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

  it("case 2: Delete control missing, nothing is clicked", async () => {
    const driver = new FakeDriver();
    driver.controls.delete = false;
    const result = await run(driver);
    expect(driver.clicks).toEqual([]);
    expect(await logged()).toEqual([["Started", "Failed:control-missing"]]);
    expect(texts(result.report.lines)).toContain(
      "Nothing was changed on JoyClub.",
    );
  });

  it("case 3: Delete confirmation missing stops before any Ignore", async () => {
    const driver = new FakeDriver();
    driver.confirmation.delete = "missing";
    const result = await run(driver);
    expect(driver.clicks).toEqual(["request:delete"]);
    expect(await logged()).toEqual([
      ["Started", "DeleteRequested", "Failed:confirmation-missing"],
    ]);
    expect(result.report).toMatchObject({
      delete: "unknown",
      ignore: "not-done",
    });
    expect(texts(result.report.lines)).toContain(
      "JoyClub's confirmation for Delete did not appear.",
    );
  });

  it("case 4: Delete succeeds, Ignore control missing: Delete is kept and reported", async () => {
    const driver = new FakeDriver();
    driver.controls.ignore = false;
    const result = await run(driver);
    expect(driver.clicks).toEqual(["request:delete", "confirm:delete"]);
    expect(await logged()).toEqual([
      [
        "Started",
        "DeleteRequested",
        "DeleteConfirmed",
        "Failed:control-missing",
      ],
    ]);
    expect(result.report).toMatchObject({ delete: "done", ignore: "not-done" });
    expect(texts(result.report.lines)).toEqual(
      expect.arrayContaining([
        "Delete: done. JoyClub moved the conversation to the trash.",
        "Ignore: not done.",
        "JoyFox could not find JoyClub's Ignore control.",
        "JoyFox did not undo anything.",
      ]),
    );
  });

  it("case 5: Ignore confirmation fails, or JoyClub does not show success", async () => {
    const missing = new FakeDriver();
    missing.confirmation.ignore = "missing";
    expect(texts((await run(missing)).report.lines)).toContain(
      "JoyClub's confirmation for Ignore did not appear.",
    );
    const unverified = new FakeDriver();
    unverified.verified.ignore = false;
    const report = (await run(unverified)).report;
    expect(report).toMatchObject({ delete: "done", ignore: "unknown" });
    expect(texts(report.lines)).toContain(
      "JoyClub did not show that Ignore succeeded.",
    );
    expect(await logged()).toEqual(
      expect.arrayContaining([
        [
          "Started",
          "DeleteRequested",
          "DeleteConfirmed",
          "IgnoreRequested",
          "Failed:confirmation-missing",
        ],
        [
          "Started",
          "DeleteRequested",
          "DeleteConfirmed",
          "IgnoreRequested",
          "Failed:not-verified",
        ],
      ]),
    );
  });

  it("case 6: a step that never answers times out, and a page that goes away stops the run", async () => {
    const hanging = new FakeDriver();
    hanging.afterClick = (click) =>
      click === "request:delete" ? new Promise(() => undefined) : undefined;
    const result = await run(hanging);
    expect(result.report.failure).toBe("timeout");
    expect(result.report.delete).toBe("unknown");
    const gone = new FakeDriver();
    gone.afterClick = (click) => {
      if (click === "request:delete") gone.current = () => ({ page: "other" });
    };
    const stopped = await run(gone);
    expect(stopped.report.failure).toBe("identity-unavailable");
    expect(gone.clicks).toEqual(["request:delete"]);
  });

  it("case 7: a closed tab leaves an interrupted log with the exact step reached", async () => {
    const recorder = client.recorder("account-a");
    const begun = await recorder.begin(TARGET);
    if (begun.status !== "started") throw new Error("not started");
    await recorder.record(begun.operationId, "DeleteRequested");
    // The tab closes here. Later, the page asks for the member's last run.
    clock += STALE_AFTER_MS + 60_000;
    const answer = await client.latest(MEMBER);
    expect(answer).toMatchObject({
      status: "ok",
      report: { status: "interrupted", delete: "unknown", ignore: "not-done" },
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
    // Also on the profile, before Ignore's confirmation.
    const mid = new FakeDriver();
    mid.afterClick = (click) => {
      if (click === "request:ignore")
        mid.current = () => ({ ...PROFILE, memberId: "5550001" });
    };
    expect((await run(mid)).report.failure).toBe("member-mismatch");
    expect(mid.clicks).toEqual([
      "request:delete",
      "confirm:delete",
      "request:ignore",
    ]);
  });

  it("case 9: conversation identity mismatch stops before Delete", async () => {
    const driver = new FakeDriver();
    driver.current = () => ({
      ...HERE,
      conversationId: "personal-1234567-1111111",
    });
    const result = await run(driver);
    expect(result.report.failure).toBe("conversation-mismatch");
    expect(result.report).toMatchObject({
      delete: "not-done",
      ignore: "not-done",
    });
    expect(driver.clicks).toEqual([]);
  });

  it("case 10: markup that changes between steps stops the run", async () => {
    const driver = new FakeDriver();
    driver.afterClick = (click) => {
      if (click === "confirm:delete")
        driver.current = () => ({ page: "profile" });
    };
    const result = await run(driver);
    expect(result.report.failure).toBe("identity-unavailable");
    expect(driver.clicks).not.toContain("request:ignore");
  });

  it("case 11: the run continues after the background restarts", async () => {
    const first = client.recorder("account-a");
    let recorder: ActionRecorder = first;
    const driver = new FakeDriver();
    driver.afterClick = (click) => {
      if (click !== "confirm:delete") return;
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
      if (click === "confirm:delete") active = "account-b";
    };
    const result = await run(driver);
    expect(driver.clicks).toEqual(["request:delete", "confirm:delete"]);
    expect(result.report).toMatchObject({
      failure: "account-changed",
      delete: "done",
      ignore: "not-done",
    });
    // Account A's log stops where it could still write; B has nothing.
    expect(await logged("account-a")).toEqual([["Started", "DeleteRequested"]]);
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
    expect(texts(result.report.lines)).toContain(
      "Nothing was changed on JoyClub.",
    );
  });

  it("checks identity again after storing, right before the click", async () => {
    const driver = new FakeDriver();
    const recorder = client.recorder("account-a");
    // The page switches member while DeleteRequested is being stored.
    const result = await run(driver, {
      begin: (target) => recorder.begin(target),
      record: async (id, state, failure) => {
        const answer = await recorder.record(id, state, failure);
        if (state === "DeleteRequested")
          driver.current = () => ({ ...HERE, memberId: "5550001" });
        return answer;
      },
    });
    expect(driver.clicks).toEqual([]);
    expect(result.report.failure).toBe("member-mismatch");
    // The log says the step was started, never less than happened.
    expect(await logged()).toEqual([
      ["Started", "DeleteRequested", "Failed:member-mismatch"],
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
          if (state === "IgnoreRequested") stop = "account-changed";
          return answer;
        },
      },
      { stopReason: () => stop },
    );
    expect(driver.clicks).toEqual(["request:delete", "confirm:delete"]);
    expect(result.report.failure).toBe("account-changed");
  });

  it("contains a driver that throws, and closes the log", async () => {
    const driver = new FakeDriver();
    driver.afterClick = (click) => {
      if (click === "confirm:delete")
        driver.current = () => {
          throw new Error("markup changed");
        };
    };
    const result = await run(driver);
    expect(result.report).toMatchObject({
      failure: "step-error",
      delete: "done",
      ignore: "not-done",
    });
    expect(await logged()).toEqual([
      ["Started", "DeleteRequested", "DeleteConfirmed", "Failed:step-error"],
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

  it("keeps Delete as done on screen when its result cannot be stored", async () => {
    const recorder = client.recorder("account-a");
    let lost = true;
    const result = await run(new FakeDriver(), {
      begin: (target) => recorder.begin(target),
      record: (id, state, failure) => {
        if (state === "DeleteConfirmed" && lost) {
          lost = false;
          return Promise.reject(new Error("port closed"));
        }
        return recorder.record(id, state, failure);
      },
    });
    expect(result.report).toMatchObject({ delete: "done", ignore: "not-done" });
    expect(texts(result.report.lines)).toContain(
      "JoyFox could not write to its action log, so it stopped before Ignore.",
    );
    // The stored log reads "not confirmed", never "not done".
    const stored = await client.latest(MEMBER);
    expect(stored).toMatchObject({ report: { delete: "unknown" } });
    if (stored.status !== "ok") throw new Error("no report");
    expect(texts(stored.report.lines)).toContain(
      "JoyFox could not write to its action log, so it stopped during Delete.",
    );
  });

  it("never clicks Ignore on the conversation page, nor Delete on the profile", async () => {
    const stays = new FakeDriver();
    // The page does not move to the profile after Delete.
    stays.current = () => HERE;
    const result = await run(stays);
    expect(result.report.failure).toBe("identity-unavailable");
    expect(stays.clicks).not.toContain("request:ignore");
    const onProfile = new FakeDriver();
    onProfile.current = () => PROFILE;
    expect((await run(onProfile)).report.failure).toBe("identity-unavailable");
    expect(onProfile.clicks).toEqual([]);
  });

  it("refuses every step of a run that a newer run replaced", async () => {
    const driver = new FakeDriver();
    driver.afterClick = async (click) => {
      if (click !== "request:delete") return;
      // This tab stalls past the interrupted threshold; another tab starts
      // a new run for the same member, which is allowed.
      clock += STALE_AFTER_MS + 60_000;
      const newer = await client.recorder("account-a").begin(TARGET);
      expect(newer.status).toBe("started");
    };
    const result = await run(driver);
    // The stalled run finishes the click it was in, then may not go on.
    expect(driver.clicks).toEqual(["request:delete", "confirm:delete"]);
    expect(result.report.failure).toBe("superseded");
    expect(texts(result.report.lines)).toContain(
      "A newer Ignore and Delete for this member started, so JoyFox stopped before Ignore.",
    );
    const logs = await repositories.actionLogs.list("account-a");
    expect(logs.map((log) => log.steps.at(-1)?.name).sort()).toEqual([
      "DeleteRequested",
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

describe("M9 hand-off to the profile page (ADR 0011)", () => {
  it("hands off after Delete, and the profile page finishes the run", async () => {
    const driver = new FakeDriver();
    driver.current = () => HERE;
    const handed: string[] = [];
    const first = await run(driver, undefined, {
      handOff: async (operationId, next) => {
        handed.push(`${operationId}:${next}`);
      },
    });
    expect(first.status).toBe("handed-off");
    expect(driver.clicks).toEqual(["request:delete", "confirm:delete"]);
    expect(handed).toEqual([`${first.operationId}:ignore`]);
    expect(await logged()).toEqual([
      ["Started", "DeleteRequested", "DeleteConfirmed"],
    ]);
    // The new page: the profile, resuming from Ignore.
    const [log] = await repositories.actionLogs.list("account-a");
    const profile = new FakeDriver();
    profile.current = () => PROFILE;
    const second = await run(profile, undefined, {
      resume: {
        operationId: first.operationId!,
        from: "ignore",
        steps: log!.steps,
      },
    });
    expect(profile.clicks).toEqual(["request:ignore", "confirm:ignore"]);
    expect(second.report.status).toBe("completed");
    expect(await logged()).toEqual([FULL]);
  });

  it("stops when the hand-off cannot be stored, so no page continues it", async () => {
    const driver = new FakeDriver();
    driver.current = () => HERE;
    const result = await run(driver, undefined, {
      handOff: () => Promise.reject(new Error("session storage failed")),
    });
    expect(result.status).toBe("finished");
    expect(result.report).toMatchObject({
      failure: "handoff-failed",
      delete: "done",
      ignore: "not-done",
    });
    expect(texts(result.report.lines)).toContain(
      "JoyFox could not move on to the member's profile, so it stopped before Ignore.",
    );
    expect(await logged()).toEqual([
      [
        "Started",
        "DeleteRequested",
        "DeleteConfirmed",
        "Failed:handoff-failed",
      ],
    ]);
  });

  it("does not hand off once the flag is off or the account changed", async () => {
    let stop: "turned-off" | undefined;
    const driver = new FakeDriver();
    driver.current = () => HERE;
    driver.afterClick = (click) => {
      if (click === "confirm:delete") stop = "turned-off";
    };
    let handed = false;
    const result = await run(driver, undefined, {
      stopReason: () => stop,
      handOff: async () => {
        handed = true;
      },
    });
    expect(handed).toBe(false);
    expect(result.report.failure).toBe("turned-off");
  });

  it("does not move on when the flag is turned off while the hand-off is stored", async () => {
    let stop: "turned-off" | undefined;
    const driver = new FakeDriver();
    driver.current = () => HERE;
    const result = await run(driver, undefined, {
      stopReason: () => stop,
      handOff: async () => {
        stop = "turned-off";
      },
    });
    expect(result.status).toBe("finished");
    expect(result.report.failure).toBe("turned-off");
  });

  it("reports a hand-off that never answers as a timeout", async () => {
    const driver = new FakeDriver();
    driver.current = () => HERE;
    const result = await run(driver, undefined, {
      handOff: () => new Promise(() => undefined),
    });
    expect(result.status).toBe("finished");
    expect(result.report.failure).toBe("timeout");
  });

  it("does not hand off when the next step's page is already shown", async () => {
    const driver = new FakeDriver();
    let handed = false;
    const result = await run(driver, undefined, {
      handOff: async () => {
        handed = true;
      },
    });
    expect(handed).toBe(false);
    expect(result.report.status).toBe("completed");
  });

  it("refuses to resume on another member's profile", async () => {
    const driver = new FakeDriver();
    driver.current = () => HERE;
    const first = await run(driver, undefined, { handOff: async () => {} });
    const [log] = await repositories.actionLogs.list("account-a");
    const other = new FakeDriver();
    other.current = () => ({ page: "profile", memberId: "5550001" });
    const result = await run(other, undefined, {
      resume: {
        operationId: first.operationId!,
        from: "ignore",
        steps: log!.steps,
      },
    });
    expect(result.report.failure).toBe("member-mismatch");
    expect(other.clicks).toEqual([]);
  });
});

describe("M9 hand-off messages (ADR 0011)", () => {
  // The tab reads its marker from the profile the run went to.
  beforeEach(onProfilePage);

  /** A run stopped right after Delete, as the conversation page leaves it. */
  async function afterDelete(): Promise<string> {
    const recorder = client.recorder("account-a");
    const begun = await recorder.begin(TARGET);
    if (begun.status !== "started") throw new Error("not started");
    await recorder.record(begun.operationId, "DeleteRequested");
    await recorder.record(begun.operationId, "DeleteConfirmed");
    return begun.operationId;
  }

  it("gives the marker to the same tab once, with the stored steps", async () => {
    const id = await afterDelete();
    await fromConversation().handOff("account-a", id, "ignore", PROFILE_PATH);
    // Another tab gets nothing.
    expect(await tabClient(8).pending()).toEqual({ status: "none" });
    const answer = await client.pending();
    expect(answer).toMatchObject({
      status: "ok",
      accountId: "account-a",
      operationId: id,
      memberId: MEMBER,
      conversationId: CONVERSATION,
      next: "ignore",
    });
    if (answer.status !== "ok") throw new Error("no marker");
    expect(answer.steps.map((step) => step.name)).toEqual([
      "Started",
      "DeleteRequested",
      "DeleteConfirmed",
    ]);
    // One-shot: a reload does not continue the run again.
    expect(await client.pending()).toEqual({ status: "none" });
  });

  it("survives a background restart, since the marker is in storage.session", async () => {
    const id = await afterDelete();
    await fromConversation().handOff("account-a", id, "ignore", PROFILE_PATH);
    const restarted = backgroundRouter();
    expect(await tabClient(TAB, () => restarted).pending()).toMatchObject({
      status: "ok",
      operationId: id,
    });
  });

  it("keeps the marker when a read fails, so a retry still finds it", async () => {
    const id = await afterDelete();
    await fromConversation().handOff("account-a", id, "ignore", PROFILE_PATH);
    // A background whose database read fails once, as during a restart.
    let fail = true;
    const actions = new ActionLogService(undefined, undefined, () =>
      new Date(clock).toISOString(),
    );
    const find = actions.find.bind(actions);
    actions.find = (accountId, operationId) => {
      if (fail) {
        fail = false;
        return Promise.reject(new Error("database closing"));
      }
      return find(accountId, operationId);
    };
    const flaky = new MessageRouter();
    registerActionHandlers(flaky, {
      actions,
      activeAccountId: () => Promise.resolve(active),
      now: () => clock,
      session,
    });
    const page = tabClient(TAB, () => flaky);
    await expect(page.pending()).rejects.toThrow();
    expect(await page.pending()).toMatchObject({
      status: "ok",
      operationId: id,
    });
  });

  it("refuses a hand-off before Delete is confirmed, or for an old run", async () => {
    const recorder = client.recorder("account-a");
    const begun = await recorder.begin(TARGET);
    if (begun.status !== "started") throw new Error("not started");
    await recorder.record(begun.operationId, "DeleteRequested");
    await expect(
      fromConversation().handOff(
        "account-a",
        begun.operationId,
        "ignore",
        PROFILE_PATH,
      ),
    ).rejects.toThrow();
    await recorder.record(begun.operationId, "DeleteConfirmed");
    // A newer run for the member replaces this one.
    clock += STALE_AFTER_MS + 60_000;
    await recorder.begin(TARGET);
    await expect(
      fromConversation().handOff(
        "account-a",
        begun.operationId,
        "ignore",
        PROFILE_PATH,
      ),
    ).rejects.toThrow();
    expect(session.items.size).toBe(0);
  });

  it("drops a marker that is stale, moved, or from another account", async () => {
    const id = await afterDelete();
    await fromConversation().handOff("account-a", id, "ignore", PROFILE_PATH);
    clock += STALE_AFTER_MS + 1;
    expect(await client.pending()).toEqual({ status: "none" });

    clock = Date.now();
    await freshDatabase();
    const moved = await afterDelete();
    await fromConversation().handOff(
      "account-a",
      moved,
      "ignore",
      PROFILE_PATH,
    );
    await client.recorder("account-a").record(moved, "IgnoreRequested");
    expect(await client.pending()).toEqual({ status: "none" });

    await freshDatabase();
    const switched = await afterDelete();
    await fromConversation().handOff(
      "account-a",
      switched,
      "ignore",
      PROFILE_PATH,
    );
    active = "account-b";
    // Closed under account A, and said, never left as still going.
    const stopped = await client.pending();
    expect(stopped).toMatchObject({ status: "stopped" });
    if (stopped.status !== "stopped") throw new Error("not stopped");
    expect(texts(stopped.lines)).toContain(
      "The active JoyFox account changed, so JoyFox stopped before Ignore.",
    );
    expect(texts(stopped.lines)).toContain(
      "Delete: done. JoyClub moved the conversation to the trash.",
    );
    expect((await logged("account-a")).at(-1)?.at(-1)).toBe(
      "Failed:account-changed",
    );
    expect(await logged("account-b")).toEqual([]);
  });

  it("hands off only from the run's own conversation page", async () => {
    const id = await afterDelete();
    const at = (url: string) =>
      messageQuickActionClient((message) =>
        router.route(message, { tabId: TAB, url }),
      ).handOff("account-a", id, "ignore", PROFILE_PATH);
    const origin = window.location.origin;
    // The profile itself, the inbox, another conversation, no address.
    await expect(at(`${origin}${PROFILE_PATH}`)).rejects.toThrow();
    await expect(at(`${origin}/clubmail/`)).rejects.toThrow();
    await expect(
      at(
        `${origin}/clubmail/conversation/conversation-wrapper-personal-1234567-5550001/`,
      ),
    ).rejects.toThrow();
    await expect(
      messageQuickActionClient((message) =>
        router.route(message, { tabId: TAB }),
      ).handOff("account-a", id, "ignore", PROFILE_PATH),
    ).rejects.toThrow();
    expect(session.items.size).toBe(0);
    // The run's own conversation, with or without the closing slash.
    await at(
      `${origin}/clubmail/conversation/conversation-wrapper-${CONVERSATION}`,
    );
    expect(session.items.size).toBe(1);
  });

  it("withdraws only this run's marker in this tab, and closes the run", async () => {
    const id = await afterDelete();
    await fromConversation().handOff("account-a", id, "ignore", PROFILE_PATH);
    // Another tab, or another run, withdraws nothing.
    expect(await fromConversation(8).withdraw("account-a", id)).toEqual({
      status: "none",
    });
    expect(
      await fromConversation().withdraw("account-a", "action:other"),
    ).toEqual({ status: "none" });
    expect(session.items.size).toBe(1);
    const answer = await fromConversation().withdraw("account-a", id);
    expect(answer.status).toBe("withdrawn");
    if (answer.status !== "withdrawn") throw new Error("not withdrawn");
    expect(texts(answer.lines)).toContain(
      "JoyFox could not move on to the member's profile, so it stopped before Ignore.",
    );
    expect(texts(answer.lines)).toContain(
      "Delete: done. JoyClub moved the conversation to the trash.",
    );
    expect(await logged()).toEqual([
      [
        "Started",
        "DeleteRequested",
        "DeleteConfirmed",
        "Failed:handoff-failed",
      ],
    ]);
    // The profile, visited later in the tab, continues nothing.
    expect(session.items.size).toBe(0);
    expect(await client.pending()).toEqual({ status: "none" });
  });

  it("withdraws nothing once the profile has read the marker", async () => {
    const id = await afterDelete();
    await fromConversation().handOff("account-a", id, "ignore", PROFILE_PATH);
    expect(await client.pending()).toMatchObject({ status: "ok" });
    expect(await fromConversation().withdraw("account-a", id)).toEqual({
      status: "none",
    });
    expect(await logged()).toEqual([
      ["Started", "DeleteRequested", "DeleteConfirmed"],
    ]);
  });

  it("leaves the marker to the profile after an account switch", async () => {
    const id = await afterDelete();
    await fromConversation().handOff("account-a", id, "ignore", PROFILE_PATH);
    active = "account-b";
    expect(await fromConversation().withdraw("account-a", id)).toEqual({
      status: "none",
    });
    // The profile closes the run as an account change, as before.
    expect(await client.pending()).toMatchObject({ status: "stopped" });
    expect((await logged("account-a")).at(-1)?.at(-1)).toBe(
      "Failed:account-changed",
    );
  });

  it("refuses a message without a tab, and a first step as the next", async () => {
    const id = await afterDelete();
    const noTab = messageQuickActionClient((message) => router.route(message));
    await expect(
      noTab.handOff("account-a", id, "ignore", PROFILE_PATH),
    ).rejects.toThrow();
    await expect(noTab.pending()).rejects.toThrow();
    await expect(
      fromConversation().handOff("account-a", id, "delete", PROFILE_PATH),
    ).rejects.toThrow();
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
    expect(await record(begun.operationId, "IgnoreRequested")).toBe("invalid");
    expect(await record(begun.operationId, "Failed")).toBe("invalid");
    expect(await record(begun.operationId, "DeleteRequested", "timeout")).toBe(
      "invalid",
    );
    expect(await record("action:unknown", "DeleteRequested")).toBe(
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
    await recorder.record(begun.operationId, "IgnoreRequested");
    expect(revision()).toBe(afterStart);
    await recorder.record(begun.operationId, "DeleteRequested");
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
      (node) => node.textContent === t(QUICK_ACTION_TEXT.button),
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

  it("has a live driver now, and never appears without one", async () => {
    expect(liveQuickActionDriver()).toBeInstanceOf(JoyClubQuickActionDriver);
    openConversation(undefined);
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(section()).toBeNull();
  });

  it("hands off to the sender's profile after Delete, and the profile finishes", async () => {
    const driver = new FakeDriver();
    // The live page stays on the conversation until JoyFox navigates.
    driver.current = () => HERE;
    const visited: string[] = [];
    window.history.replaceState(
      null,
      "",
      `/clubmail/conversation/conversation-wrapper-${CONVERSATION}`,
    );
    document.body.innerHTML = conversationHtml;
    const quick = new QuickIgnoreDelete(
      document,
      client,
      () => driver,
      (url) => visited.push(url),
    );
    quick.update();
    await vi.waitFor(() => expect(runButton()).toBeDefined());
    runButton()!.click();
    // The page moves only once the run returns "handed-off".
    await vi.waitFor(() => expect(visited).toHaveLength(1));
    await vi.waitFor(() =>
      expect(notice()).toContain(t(QUICK_ACTION_TEXT.handedOff)),
    );
    expect(visited).toEqual([
      `${window.location.origin}/profile/1234567.synthetic_one.html`,
    ]);
    expect(driver.clicks).toEqual(["request:delete", "confirm:delete"]);

    // The tab loads the profile; the conversation page goes, and a new
    // content script starts there.
    window.dispatchEvent(new Event("pagehide"));
    window.history.replaceState(
      null,
      "",
      "/profile/1234567.synthetic_one.html",
    );
    document.body.innerHTML = profileHtml;
    const onProfile = new FakeDriver();
    onProfile.current = () => PROFILE;
    const resumed = new QuickIgnoreDelete(document, client, () => onProfile);
    resumed.updateProfile();
    await vi.waitFor(() =>
      expect(notice()).toContain("Ignore and Delete finished."),
    );
    expect(notice()).toContain(t(QUICK_ACTION_TEXT.resumed));
    expect(onProfile.clicks).toEqual(["request:ignore", "confirm:ignore"]);
    expect(await logged()).toEqual([FULL]);
    // No button on the profile, and a reload does not run it again.
    expect(runButton()).toBeUndefined();
    const again = new FakeDriver();
    again.current = () => PROFILE;
    new QuickIgnoreDelete(document, client, () => again).updateProfile();
    await new Promise((resolve) => setTimeout(resolve, 30));
    expect(again.clicks).toEqual([]);
  });

  /** A conversation page whose navigation to the profile is a stub. */
  function conversationPage(driver: QuickActionDriver, visited: string[]) {
    window.history.replaceState(
      null,
      "",
      `/clubmail/conversation/conversation-wrapper-${CONVERSATION}`,
    );
    document.body.innerHTML = conversationHtml;
    const quick = new QuickIgnoreDelete(
      document,
      client,
      () => driver,
      (url) => visited.push(url),
      () => Date.now(),
      60,
    );
    quick.update();
    return quick;
  }

  it("withdraws the hand-off when the page is not left for the profile", async () => {
    const driver = new FakeDriver();
    driver.current = () => HERE;
    const visited: string[] = [];
    conversationPage(driver, visited);
    await vi.waitFor(() => expect(runButton()).toBeDefined());
    runButton()!.click();
    await vi.waitFor(() => expect(visited).toHaveLength(1));
    // The navigation is cancelled: this page stays, and says what was done.
    await vi.waitFor(() =>
      expect(notice()).toContain(
        "JoyFox could not move on to the member's profile, so it stopped before Ignore.",
      ),
    );
    expect(notice()).toContain(
      "Delete: done. JoyClub moved the conversation to the trash.",
    );
    expect((await logged())[0]?.at(-1)).toBe("Failed:handoff-failed");
    expect(session.items.size).toBe(0);
    // A later visit to the profile in this tab continues nothing.
    onProfilePage();
    document.body.innerHTML = profileHtml;
    const later = new FakeDriver();
    later.current = () => PROFILE;
    new QuickIgnoreDelete(document, client, () => later).updateProfile();
    await new Promise((resolve) => setTimeout(resolve, 30));
    expect(later.clicks).toEqual([]);
  });

  it("keeps the hand-off once the page is left for the profile", async () => {
    const driver = new FakeDriver();
    driver.current = () => HERE;
    const visited: string[] = [];
    conversationPage(driver, visited);
    await vi.waitFor(() => expect(runButton()).toBeDefined());
    runButton()!.click();
    await vi.waitFor(() => expect(visited).toHaveLength(1));
    // The browser unloads the page on its way to the profile.
    window.dispatchEvent(new Event("pagehide"));
    await new Promise((resolve) => setTimeout(resolve, 120));
    expect(session.items.size).toBe(1);
    expect((await logged())[0]?.at(-1)).toBe("DeleteConfirmed");
    onProfilePage();
    document.body.innerHTML = profileHtml;
    const onProfile = new FakeDriver();
    onProfile.current = () => PROFILE;
    new QuickIgnoreDelete(document, client, () => onProfile).updateProfile();
    await vi.waitFor(async () =>
      expect((await logged())[0]?.at(-1)).toBe("Completed"),
    );
    expect(onProfile.clicks).toEqual(["request:ignore", "confirm:ignore"]);
  });

  it("starts nothing when the member's profile address is unknown", async () => {
    const driver = new FakeDriver();
    openConversation(driver);
    await vi.waitFor(() => expect(runButton()).toBeDefined());
    // The header's link no longer names the member's profile.
    document
      .querySelector(".cm-conversation-header")!
      .setAttribute("href", "https://example.invalid/profile/1234567.x.html");
    runButton()!.click();
    await vi.waitFor(() =>
      expect(notice()).toContain(t(QUICK_ACTION_TEXT.noProfile)),
    );
    expect(driver.clicks).toEqual([]);
    expect(await logged()).toEqual([]);
  });

  it("drops a waiting hand-off when the flag is off, so it never runs later", async () => {
    const recorder = client.recorder("account-a");
    const begun = await recorder.begin(TARGET);
    if (begun.status !== "started") throw new Error("not started");
    await recorder.record(begun.operationId, "DeleteRequested");
    await recorder.record(begun.operationId, "DeleteConfirmed");
    await fromConversation().handOff(
      "account-a",
      begun.operationId,
      "ignore",
      PROFILE_PATH,
    );
    onProfilePage();
    document.body.innerHTML = profileHtml;
    const driver = new FakeDriver();
    driver.current = () => PROFILE;
    // The profile loads with the flag off.
    const off = new QuickIgnoreDelete(document, client, () => driver);
    off.turnOff();
    await vi.waitFor(async () =>
      expect((await logged())[0]?.at(-1)).toBe("Failed:turned-off"),
    );
    // Turned on again: nothing is left to continue.
    const on = new QuickIgnoreDelete(document, client, () => driver);
    on.updateProfile();
    await new Promise((resolve) => setTimeout(resolve, 30));
    expect(driver.clicks).toEqual([]);
  });

  it("closes a hand-off already read when the flag is turned off", async () => {
    const recorder = client.recorder("account-a");
    const begun = await recorder.begin(TARGET);
    if (begun.status !== "started") throw new Error("not started");
    await recorder.record(begun.operationId, "DeleteRequested");
    await recorder.record(begun.operationId, "DeleteConfirmed");
    await fromConversation().handOff(
      "account-a",
      begun.operationId,
      "ignore",
      PROFILE_PATH,
    );
    onProfilePage();
    document.body.innerHTML = profileHtml;
    // The profile menu is not there yet, so the run waits after reading.
    const driver = new FakeDriver();
    driver.current = () => PROFILE;
    driver.controls.ignore = false;
    const quick = new QuickIgnoreDelete(document, client, () => driver);
    quick.updateProfile();
    // Let the page read (and so remove) its marker.
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(await client.pending()).toEqual({ status: "none" });
    quick.turnOff();
    await vi.waitFor(async () =>
      expect((await logged())[0]?.at(-1)).toBe("Failed:turned-off"),
    );
    expect(driver.clicks).toEqual([]);
  });

  it("asks again when reading the hand-off fails once", async () => {
    const recorder = client.recorder("account-a");
    const begun = await recorder.begin(TARGET);
    if (begun.status !== "started") throw new Error("not started");
    await recorder.record(begun.operationId, "DeleteRequested");
    await recorder.record(begun.operationId, "DeleteConfirmed");
    await fromConversation().handOff(
      "account-a",
      begun.operationId,
      "ignore",
      PROFILE_PATH,
    );
    onProfilePage();
    document.body.innerHTML = profileHtml;
    let failures = 1;
    const flaky: QuickActionClient = {
      ...client,
      pending: () =>
        failures-- > 0
          ? Promise.reject(new Error("background restarting"))
          : client.pending(),
    };
    const driver = new FakeDriver();
    driver.current = () => PROFILE;
    new QuickIgnoreDelete(document, flaky, () => driver).updateProfile();
    await vi.waitFor(
      () => expect(driver.clicks).toEqual(["request:ignore", "confirm:ignore"]),
      { timeout: 3000 },
    );
    // Let the run store its last steps before the next test starts.
    await vi.waitFor(async () =>
      expect((await logged())[0]?.at(-1)).toBe("Completed"),
    );
  });

  it("shows a hand-off stopped by an account switch on the profile", async () => {
    const recorder = client.recorder("account-a");
    const begun = await recorder.begin(TARGET);
    if (begun.status !== "started") throw new Error("not started");
    await recorder.record(begun.operationId, "DeleteRequested");
    await recorder.record(begun.operationId, "DeleteConfirmed");
    await fromConversation().handOff(
      "account-a",
      begun.operationId,
      "ignore",
      PROFILE_PATH,
    );
    active = "account-b";
    onProfilePage();
    document.body.innerHTML = profileHtml;
    const driver = new FakeDriver();
    driver.current = () => PROFILE;
    new QuickIgnoreDelete(document, client, () => driver).updateProfile();
    await vi.waitFor(() =>
      expect(notice()).toContain("The active JoyFox account changed"),
    );
    expect(driver.clicks).toEqual([]);
  });

  it("reads the hand-off only on the profile it named", async () => {
    const recorder = client.recorder("account-a");
    const begun = await recorder.begin(TARGET);
    if (begun.status !== "started") throw new Error("not started");
    await recorder.record(begun.operationId, "DeleteRequested");
    await recorder.record(begun.operationId, "DeleteConfirmed");
    await fromConversation().handOff(
      "account-a",
      begun.operationId,
      "ignore",
      PROFILE_PATH,
    );
    window.history.replaceState(null, "", "/clubmail/");
    expect(await client.pending()).toEqual({ status: "none" });
  });

  it("does not continue a hand-off on another member's profile", async () => {
    const recorder = client.recorder("account-a");
    const begun = await recorder.begin(TARGET);
    if (begun.status !== "started") throw new Error("not started");
    await recorder.record(begun.operationId, "DeleteRequested");
    await recorder.record(begun.operationId, "DeleteConfirmed");
    await fromConversation().handOff(
      "account-a",
      begun.operationId,
      "ignore",
      PROFILE_PATH,
    );
    window.history.replaceState(null, "", "/profile/5550001.synthetic.html");
    document.body.innerHTML = profileHtml;
    const other = new FakeDriver();
    other.current = () => ({ page: "profile", memberId: "5550001" });
    new QuickIgnoreDelete(document, client, () => other).updateProfile();
    await new Promise((resolve) => setTimeout(resolve, 30));
    expect(other.clicks).toEqual([]);
    expect(section()).toBeNull();
  });

  it("goes only to the run's member on this site", () => {
    const header = document.createElement("a");
    const at = (href: string) => {
      header.setAttribute("href", href);
      return profileUrl(header, MEMBER);
    };
    expect(at("/profile/1234567.synthetic_one.html")).toBe(
      `${window.location.origin}/profile/1234567.synthetic_one.html`,
    );
    expect(at("/profile/5550001.synthetic.html")).toBeUndefined();
    expect(
      at("https://example.invalid/profile/1234567.x.html"),
    ).toBeUndefined();
    expect(at("/clubmail/")).toBeUndefined();
  });

  it("runs on one click and shows what was done", async () => {
    const driver = new FakeDriver();
    openConversation(driver);
    await vi.waitFor(() => expect(runButton()).toBeDefined());
    const header = document.querySelector(".cm-conversation-header")!;
    expect(header.nextElementSibling).toBe(section()?.parentElement);
    expect(section()?.parentElement?.getAttribute("data-joyfox-ui")).toBe(
      "member-strip",
    );
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
    driver.controls.ignore = false;
    openConversation(driver);
    await vi.waitFor(() => expect(runButton()).toBeDefined());
    runButton()!.click();
    await vi.waitFor(() =>
      expect(notice()).toContain(
        "JoyFox could not find JoyClub's Ignore control.",
      ),
    );
    expect(notice()).toContain("Delete: done.");
    expect(notice()).toContain("ignore them there yourself");
    const status = section()?.querySelector('[role="status"]');
    expect(status?.getAttribute("aria-live")).toBe("polite");
  });

  it("shows an interrupted earlier run from the ActionLog", async () => {
    const begun = await client.recorder("account-a").begin(TARGET);
    if (begun.status !== "started") throw new Error("not started");
    await client
      .recorder("account-a")
      .record(begun.operationId, "DeleteRequested");
    clock += STALE_AFTER_MS + 60_000;
    openConversation(new FakeDriver());
    await vi.waitFor(() =>
      expect(notice()).toContain(t(QUICK_ACTION_TEXT.previous)),
    );
    expect(notice()).toContain("was interrupted");
    expect(notice()).toContain("Delete: not confirmed.");
  });

  it("ignores a second click while running", async () => {
    const driver = new FakeDriver();
    let release: () => void = () => undefined;
    driver.afterClick = (click) =>
      click === "request:delete"
        ? new Promise<void>((resolve) => {
            release = resolve;
          })
        : undefined;
    openConversation(driver);
    await vi.waitFor(() => expect(runButton()).toBeDefined());
    runButton()!.click();
    await vi.waitFor(() => expect(driver.clicks).toEqual(["request:delete"]));
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
      click === "confirm:delete"
        ? new Promise<void>((resolve) => {
            release = resolve;
          })
        : undefined;
    const quick = openConversation(driver);
    await vi.waitFor(() => expect(runButton()).toBeDefined());
    runButton()!.click();
    await vi.waitFor(() => expect(driver.clicks).toContain("confirm:delete"));
    active = "account-b";
    quick.accountChanged();
    release();
    await vi.waitFor(() =>
      expect(notice()).toContain("The active JoyFox account changed"),
    );
    expect(driver.clicks).not.toContain("request:ignore");
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
      click === "request:delete"
        ? new Promise<void>((resolve) => {
            release = resolve;
          })
        : undefined;
    const quick = openConversation(driver);
    await vi.waitFor(() => expect(runButton()).toBeDefined());
    runButton()!.click();
    await vi.waitFor(() => expect(driver.clicks).toEqual(["request:delete"]));
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
      expect(notice()).toContain(t(QUICK_ACTION_TEXT.otherRunning)),
    );
    expect(runButton()?.getAttribute("aria-disabled")).toBe("true");
    release();
    await vi.waitFor(() =>
      expect(notice()).toContain(t(QUICK_ACTION_TEXT.otherResult)),
    );
    expect(notice()).toContain("The page showed another member");
    expect(notice()).toContain("Delete: not confirmed.");
    expect(driver.clicks).toEqual(["request:delete"]);
    expect(runButton()?.getAttribute("aria-disabled")).toBe("false");
  });

  it("stops a run and stays hidden when the flag is turned off", async () => {
    const driver = new FakeDriver();
    let release: () => void = () => undefined;
    driver.afterClick = (click) =>
      click === "request:delete"
        ? new Promise<void>((resolve) => {
            release = resolve;
          })
        : undefined;
    const quick = openConversation(driver);
    await vi.waitFor(() => expect(runButton()).toBeDefined());
    runButton()!.click();
    await vi.waitFor(() => expect(driver.clicks).toEqual(["request:delete"]));
    quick.turnOff();
    expect(section()).toBeNull();
    release();
    await vi.waitFor(async () =>
      expect((await logged())[0]?.at(-1)).toBe("Failed:turned-off"),
    );
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(section()).toBeNull();
    expect(driver.clicks).toEqual(["request:delete"]);
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
    expect(notice()).toContain(t(QUICK_ACTION_TEXT.previous));
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
      expect(notice()).toContain(t(QUICK_ACTION_TEXT.previousOther)),
    );
    expect(notice()).not.toContain(t(QUICK_ACTION_TEXT.previous));
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
