import { describe, expect, it } from "vitest";
import { texts } from "../i18n-text";
import {
  ACTION_STATES,
  canTransition,
  checkTarget,
  isTerminal,
  reportOperation,
  STALE_AFTER_MS,
  STARTED_STALE_AFTER_MS,
  type ActionState,
} from "../../src/actions/ignore-delete";

const T0 = Date.parse("2026-09-23T10:00:00.000Z");
const at = (offset = 0) => new Date(T0 + offset).toISOString();
const steps = (...names: Array<ActionState | [ActionState, string]>) =>
  names.map((name) =>
    Array.isArray(name)
      ? { name: name[0], ok: false, at: at(), errorCode: name[1] }
      : { name, ok: name !== "Failed", at: at() },
  );
const report = (logged: ReturnType<typeof steps>, now = T0) =>
  reportOperation({ steps: logged, updatedAt: at() }, now);

const TARGET = { memberId: "1234567", conversationId: "personal-1234567-1" };

describe("M9 state machine", () => {
  it("allows only the next step, or Failed from a state that is not terminal", () => {
    const order: ActionState[] = [
      "Started",
      "DeleteRequested",
      "DeleteConfirmed",
      "IgnoreRequested",
      "IgnoreConfirmed",
      "Completed",
    ];
    for (const from of ACTION_STATES)
      for (const to of ACTION_STATES) {
        const next = order[order.indexOf(from) + 1];
        const expected =
          !isTerminal(from) &&
          (to === "Failed" || (next !== undefined && to === next));
        expect(canTransition(from, to), `${from} -> ${to}`).toBe(expected);
      }
  });

  it("never lets a step be skipped: Ignore needs a confirmed Delete", () => {
    expect(canTransition("Started", "IgnoreRequested")).toBe(false);
    expect(canTransition("DeleteRequested", "IgnoreRequested")).toBe(false);
    expect(canTransition("DeleteConfirmed", "Completed")).toBe(false);
  });
});

describe("M9 identity invariant", () => {
  it("passes only when member and conversation match", () => {
    expect(
      checkTarget(TARGET, { page: "conversation", ...TARGET }),
    ).toBeUndefined();
    expect(
      checkTarget(TARGET, { page: "profile", memberId: TARGET.memberId }),
    ).toBeUndefined();
  });

  it("fails on another member or conversation", () => {
    expect(
      checkTarget(TARGET, {
        page: "conversation",
        memberId: "7654321",
        conversationId: TARGET.conversationId,
      }),
    ).toBe("member-mismatch");
    expect(
      checkTarget(TARGET, {
        page: "conversation",
        memberId: TARGET.memberId,
        conversationId: "personal-1234567-2",
      }),
    ).toBe("conversation-mismatch");
  });

  it("requires the conversation page for Delete and the profile for Ignore", () => {
    const profile = { page: "profile" as const, memberId: TARGET.memberId };
    const conversation = { page: "conversation" as const, ...TARGET };
    expect(checkTarget(TARGET, profile, "ignore")).toBeUndefined();
    expect(checkTarget(TARGET, profile, "delete")).toBe("identity-unavailable");
    expect(checkTarget(TARGET, conversation, "delete")).toBeUndefined();
    expect(checkTarget(TARGET, conversation, "ignore")).toBe(
      "identity-unavailable",
    );
  });

  it("fails when identity cannot be proven, never passes by default", () => {
    expect(checkTarget(TARGET, { page: "other" })).toBe("identity-unavailable");
    expect(checkTarget(TARGET, { page: "conversation" })).toBe(
      "identity-unavailable",
    );
    expect(
      checkTarget(TARGET, { page: "conversation", memberId: TARGET.memberId }),
    ).toBe("identity-unavailable");
    expect(checkTarget(TARGET, { page: "profile" })).toBe(
      "identity-unavailable",
    );
  });
});

describe("M9 report", () => {
  it("reports a completed run", () => {
    const result = report(
      steps(
        "Started",
        "DeleteRequested",
        "DeleteConfirmed",
        "IgnoreRequested",
        "IgnoreConfirmed",
        "Completed",
      ),
    );
    expect(result).toMatchObject({
      status: "completed",
      ignore: "done",
      delete: "done",
    });
    expect(texts(result.lines)[0]).toBe("Ignore and Delete finished.");
  });

  it("says nothing changed when Delete's control was missing", () => {
    const result = report(steps("Started", ["Failed", "control-missing"]));
    expect(result).toMatchObject({
      status: "failed",
      ignore: "not-done",
      delete: "not-done",
      failure: "control-missing",
    });
    expect(texts(result.lines)).toEqual([
      "Ignore and Delete stopped.",
      "JoyFox could not find JoyClub's Delete control.",
      "Delete: not done.",
      "Ignore: not done.",
      "Nothing was changed on JoyClub.",
      expect.stringMatching(/^Next: open the conversation/),
      expect.stringMatching(/^Next: open the member's profile/),
    ]);
  });

  it("keeps a done Delete and names Ignore as the failed step", () => {
    const result = report(
      steps("Started", "DeleteRequested", "DeleteConfirmed", [
        "Failed",
        "control-missing",
      ]),
    );
    expect(result).toMatchObject({ delete: "done", ignore: "not-done" });
    expect(texts(result.lines)).toContain(
      "JoyFox could not find JoyClub's Ignore control.",
    );
    expect(texts(result.lines)).toContain("JoyFox did not undo anything.");
    expect(texts(result.lines).join(" ")).not.toMatch(/move it there yourself/);
    expect(texts(result.lines).join(" ")).toMatch(/member's profile/);
  });

  it("reports a requested but unconfirmed step as not confirmed, never as not done", () => {
    const result = report(
      steps("Started", "DeleteRequested", ["Failed", "confirmation-missing"]),
    );
    expect(result.delete).toBe("unknown");
    expect(texts(result.lines)).toContain(
      "Delete: not confirmed. JoyFox started it but did not see JoyClub confirm it.",
    );
    expect(texts(result.lines)).toContain("JoyFox did not undo anything.");
  });

  it("reads a stalled run as interrupted, and a recent one as running", () => {
    const logged = steps("Started", "DeleteRequested");
    expect(report(logged, T0 + 1000).status).toBe("running");
    const stale = report(logged, T0 + STALE_AFTER_MS + 1);
    expect(stale.status).toBe("interrupted");
    expect(stale.delete).toBe("unknown");
    expect(texts(stale.lines)[0]).toMatch(/interrupted/);
  });

  it("reads a run still at its start as interrupted after the shorter wait", () => {
    const started = steps("Started");
    expect(report(started, T0 + STARTED_STALE_AFTER_MS).status).toBe("running");
    const stale = report(started, T0 + STARTED_STALE_AFTER_MS + 1);
    expect(stale.status).toBe("interrupted");
    expect(stale.delete).toBe("not-done");
    expect(texts(stale.lines)).toContain("Nothing was changed on JoyClub.");
    // Past its start, a run keeps the longer wait.
    expect(
      report(
        steps("Started", "DeleteRequested"),
        T0 + STARTED_STALE_AFTER_MS + 1,
      ).status,
    ).toBe("running");
  });

  it("never says a started step was not attempted when the log fails", () => {
    const lost = report(
      steps("Started", "DeleteRequested", ["Failed", "log-unavailable"]),
    );
    expect(texts(lost.lines)).toContain(
      "JoyFox could not write to its action log, so it stopped during Delete.",
    );
    expect(texts(lost.lines).join(" ")).not.toMatch(/did not attempt/);
    const before = report(steps("Started", ["Failed", "log-unavailable"]));
    expect(texts(before.lines)).toContain(
      "JoyFox could not write to its action log, so it stopped before Delete.",
    );
  });

  it("never claims a rollback", () => {
    for (const failure of [
      "not-verified",
      "timeout",
      "account-changed",
      "member-mismatch",
    ])
      for (const lines of [
        texts(
          report(steps("Started", "DeleteRequested", ["Failed", failure]))
            .lines,
        ),
        texts(
          report(
            steps(
              "Started",
              "DeleteRequested",
              "DeleteConfirmed",
              "IgnoreRequested",
              ["Failed", failure],
            ),
          ).lines,
        ),
      ])
        expect(lines.join(" ")).not.toMatch(/rolled back|restored|reverted/i);
  });
});
