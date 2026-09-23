import { describe, expect, it } from "vitest";
import {
  ACTION_STATES,
  canTransition,
  checkTarget,
  isTerminal,
  reportOperation,
  STALE_AFTER_MS,
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
      "IgnoreRequested",
      "IgnoreConfirmed",
      "DeleteRequested",
      "DeleteConfirmed",
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

  it("never lets a step be skipped: Delete needs a confirmed Ignore", () => {
    expect(canTransition("Started", "DeleteRequested")).toBe(false);
    expect(canTransition("IgnoreRequested", "DeleteRequested")).toBe(false);
    expect(canTransition("IgnoreConfirmed", "Completed")).toBe(false);
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

  it("requires the conversation page before Delete", () => {
    const profile = { page: "profile" as const, memberId: TARGET.memberId };
    expect(checkTarget(TARGET, profile, "ignore")).toBeUndefined();
    expect(checkTarget(TARGET, profile, "delete")).toBe("identity-unavailable");
    expect(
      checkTarget(TARGET, { page: "conversation", ...TARGET }, "delete"),
    ).toBeUndefined();
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
        "IgnoreRequested",
        "IgnoreConfirmed",
        "DeleteRequested",
        "DeleteConfirmed",
        "Completed",
      ),
    );
    expect(result).toMatchObject({
      status: "completed",
      ignore: "done",
      delete: "done",
    });
    expect(result.lines[0]).toBe("Ignore and Delete finished.");
  });

  it("says nothing changed when Ignore's control was missing", () => {
    const result = report(steps("Started", ["Failed", "control-missing"]));
    expect(result).toMatchObject({
      status: "failed",
      ignore: "not-done",
      delete: "not-done",
      failure: "control-missing",
    });
    expect(result.lines).toEqual([
      "Ignore and Delete stopped.",
      "JoyFox could not find JoyClub's Ignore control.",
      "Ignore: not done.",
      "Delete: not done.",
      "Nothing was changed on JoyClub.",
      expect.stringMatching(/^Next: open the member's profile/),
      expect.stringMatching(/^Next: open the conversation/),
    ]);
  });

  it("keeps a done Ignore and names Delete as the failed step", () => {
    const result = report(
      steps("Started", "IgnoreRequested", "IgnoreConfirmed", [
        "Failed",
        "control-missing",
      ]),
    );
    expect(result).toMatchObject({ ignore: "done", delete: "not-done" });
    expect(result.lines).toContain(
      "JoyFox could not find JoyClub's Delete control.",
    );
    expect(result.lines).toContain("JoyFox did not undo anything.");
    expect(result.lines.join(" ")).not.toMatch(/member's profile/);
    expect(result.lines.join(" ")).toMatch(/move it there yourself/);
  });

  it("reports a requested but unconfirmed step as not confirmed, never as not done", () => {
    const result = report(
      steps("Started", "IgnoreRequested", ["Failed", "confirmation-missing"]),
    );
    expect(result.ignore).toBe("unknown");
    expect(result.lines).toContain(
      "Ignore: not confirmed. JoyFox started it but did not see JoyClub confirm it.",
    );
    expect(result.lines).toContain("JoyFox did not undo anything.");
  });

  it("reads a stalled run as interrupted, and a recent one as running", () => {
    const logged = steps("Started", "IgnoreRequested");
    expect(report(logged, T0 + 1000).status).toBe("running");
    const stale = report(logged, T0 + STALE_AFTER_MS + 1);
    expect(stale.status).toBe("interrupted");
    expect(stale.ignore).toBe("unknown");
    expect(stale.lines[0]).toMatch(/interrupted/);
  });

  it("never says a started step was not attempted when the log fails", () => {
    const lost = report(
      steps("Started", "IgnoreRequested", ["Failed", "log-unavailable"]),
    );
    expect(lost.lines).toContain(
      "JoyFox could not write to its action log, so it stopped during Ignore.",
    );
    expect(lost.lines.join(" ")).not.toMatch(/did not attempt/);
    const before = report(steps("Started", ["Failed", "log-unavailable"]));
    expect(before.lines).toContain(
      "JoyFox could not write to its action log, so it stopped before Ignore.",
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
        report(steps("Started", "IgnoreRequested", ["Failed", failure])).lines,
        report(
          steps(
            "Started",
            "IgnoreRequested",
            "IgnoreConfirmed",
            "DeleteRequested",
            ["Failed", failure],
          ),
        ).lines,
      ])
        expect(lines.join(" ")).not.toMatch(/rolled back|restored|reverted/i);
  });
});
