import type { ActionLog } from "../domain/types";

/**
 * M9 Quick Ignore and Delete as an explicit state machine (build plan Section
 * 16). This module is pure: no DOM, no storage. It defines the states, the
 * allowed transitions, the identity invariant checked before every JoyClub
 * write, and the report shown to the user, all computed from ActionLog steps.
 */

/** `ActionLog.action` for this operation. */
export const QUICK_IGNORE_DELETE = "quick-ignore-delete";

/**
 * The order is Delete, then Ignore (owner decision, 2026-09-24, ADR 0011):
 * JoyClub offers Delete on the conversation page and Ignore only on the
 * sender's profile (F7, `live-evidence/10-ignore.md`), so the run starts
 * where the user reads the message and moves to the profile once.
 *
 * - `Started`: the operation exists and its target is fixed. Nothing was
 *   clicked yet.
 * - `DeleteRequested`, `IgnoreRequested`: recorded just before JoyFox clicks
 *   JoyClub's control. A crash after this point leaves the step's outcome
 *   unknown, never falsely "not done".
 * - `IgnoreConfirmed`, `DeleteConfirmed`: JoyClub's own confirmation was
 *   completed and JoyClub showed that the step succeeded.
 * - `Completed`, `Failed`: terminal. `Failed` carries the reason.
 */
export type ActionState =
  | "Started"
  | "DeleteRequested"
  | "DeleteConfirmed"
  | "IgnoreRequested"
  | "IgnoreConfirmed"
  | "Completed"
  | "Failed";

export const ACTION_STATES: readonly ActionState[] = [
  "Started",
  "DeleteRequested",
  "DeleteConfirmed",
  "IgnoreRequested",
  "IgnoreConfirmed",
  "Completed",
  "Failed",
];

const NEXT: Partial<Record<ActionState, ActionState>> = {
  Started: "DeleteRequested",
  DeleteRequested: "DeleteConfirmed",
  DeleteConfirmed: "IgnoreRequested",
  IgnoreRequested: "IgnoreConfirmed",
  IgnoreConfirmed: "Completed",
};

export const isTerminal = (state: ActionState) =>
  state === "Completed" || state === "Failed";

/** One step forward, or `Failed` from any state that is not terminal. */
export function canTransition(from: ActionState, to: ActionState): boolean {
  if (isTerminal(from)) return false;
  return to === "Failed" || NEXT[from] === to;
}

/** Why an operation stopped. Stored as the `Failed` step's `errorCode`. */
export type ActionFailure =
  /** The step's JoyClub control was not on the page. */
  | "control-missing"
  /** JoyClub's own confirmation for the step did not appear. */
  | "confirmation-missing"
  /** JoyClub did not show that the step succeeded. */
  | "not-verified"
  /**
   * The page gives no way to see the step's result, so it was not started:
   * a step that cannot be checked is never clicked.
   */
  | "unverifiable"
  | "member-mismatch"
  | "conversation-mismatch"
  /** The page no longer shows a member or conversation JoyFox can read. */
  | "identity-unavailable"
  | "account-changed"
  /** The experimental flag was turned off during the run. */
  | "turned-off"
  /** A newer run for the member started while this one was stalled. */
  | "superseded"
  /** The action log could not be written, so the run stopped. */
  | "log-unavailable"
  /** The run could not be handed to the next page (ADR 0011). */
  | "handoff-failed"
  | "timeout"
  | "step-error";

export const ACTION_FAILURES: readonly ActionFailure[] = [
  "control-missing",
  "confirmation-missing",
  "not-verified",
  "unverifiable",
  "member-mismatch",
  "conversation-mismatch",
  "identity-unavailable",
  "account-changed",
  "turned-off",
  "superseded",
  "log-unavailable",
  "handoff-failed",
  "timeout",
  "step-error",
];

export type ActionStep = "delete" | "ignore";

/** The steps in the order they run. */
export const STEP_ORDER: readonly ActionStep[] = ["delete", "ignore"];

export const STEP_STATES: Record<
  ActionStep,
  { requested: ActionState; confirmed: ActionState }
> = {
  ignore: { requested: "IgnoreRequested", confirmed: "IgnoreConfirmed" },
  delete: { requested: "DeleteRequested", confirmed: "DeleteConfirmed" },
};

/** The member and conversation an operation acts on, fixed at the start. */
export interface ActionTarget {
  memberId: string;
  conversationId: string;
}

/**
 * What the page shows right now. A field is absent when JoyFox cannot read
 * it, which is never treated as a match.
 */
export interface CurrentTarget {
  page: "conversation" | "profile" | "other";
  memberId?: string;
  conversationId?: string;
}

/**
 * The safety invariant (build plan Section 16): before every destructive
 * click the page must show the expected member, and on a conversation page
 * the expected conversation. Delete acts on the conversation, so it needs
 * the conversation page; Ignore is only on the profile page (F7). If
 * identity cannot be proven, the answer is a failure, never a pass.
 */
export function checkTarget(
  expected: ActionTarget,
  current: CurrentTarget,
  step?: ActionStep,
): ActionFailure | undefined {
  if (current.page === "other" || current.memberId === undefined)
    return "identity-unavailable";
  if (current.memberId !== expected.memberId) return "member-mismatch";
  if (step === "delete" && current.page !== "conversation")
    return "identity-unavailable";
  if (step === "ignore" && current.page !== "profile")
    return "identity-unavailable";
  if (current.page === "conversation") {
    if (current.conversationId === undefined) return "identity-unavailable";
    if (current.conversationId !== expected.conversationId)
      return "conversation-mismatch";
  }
  return undefined;
}

/**
 * A running operation that has not moved for this long is reported as
 * interrupted (the tab closed, the browser stopped). Each step waits at most
 * `STEP_TIMEOUT_MS`, so a live operation always moves sooner. Provisional,
 * like the step timeout: no document sets either value.
 */
export const STEP_TIMEOUT_MS = 15_000;
export const STALE_AFTER_MS = 120_000;

export type StepOutcome = "done" | "not-done" | "unknown";

export interface OperationReport {
  status: "running" | "completed" | "failed" | "interrupted";
  ignore: StepOutcome;
  delete: StepOutcome;
  failure?: ActionFailure;
  /** Plain sentences for the on-screen notice, in reading order. */
  lines: string[];
}

type LoggedStep = ActionLog["steps"][number];

function outcome(steps: readonly LoggedStep[], step: ActionStep): StepOutcome {
  const names = new Set(steps.map((item) => item.name));
  const states = STEP_STATES[step];
  if (names.has(states.confirmed)) return "done";
  if (names.has(states.requested)) return "unknown";
  return "not-done";
}

const STEP_NAME: Record<ActionStep, string> = {
  ignore: "Ignore",
  delete: "Delete",
};

/**
 * Why it stopped, naming the step that did not complete. `outcome` says
 * whether that step was started, so the text never claims it was not.
 */
function failureText(
  failure: ActionFailure,
  step: ActionStep,
  outcome: StepOutcome,
): string {
  const name = STEP_NAME[step];
  const where = outcome === "not-done" ? `before ${name}` : `during ${name}`;
  switch (failure) {
    case "control-missing":
      return `JoyFox could not find JoyClub's ${name} control.`;
    case "confirmation-missing":
      return `JoyClub's confirmation for ${name} did not appear.`;
    case "not-verified":
      return `JoyClub did not show that ${name} succeeded.`;
    case "unverifiable":
      return `JoyFox cannot see JoyClub's result for ${name} on this page, so it stopped ${where}.`;
    case "member-mismatch":
      return `The page showed another member, so JoyFox stopped ${where}.`;
    case "conversation-mismatch":
      return `The page showed another conversation, so JoyFox stopped ${where}.`;
    case "identity-unavailable":
      return `JoyFox could not confirm which member or conversation the page shows, so it stopped ${where}.`;
    case "account-changed":
      return `The active JoyFox account changed, so JoyFox stopped ${where}.`;
    case "turned-off":
      return `Ignore and Delete was turned off, so JoyFox stopped ${where}.`;
    case "superseded":
      return `A newer Ignore and Delete for this member started, so JoyFox stopped ${where}.`;
    case "log-unavailable":
      return `JoyFox could not write to its action log, so it stopped ${where}.`;
    case "handoff-failed":
      return `JoyFox could not move on to the member's profile, so it stopped ${where}.`;
    case "timeout":
      return `JoyClub did not respond in time during ${name}.`;
    case "step-error":
      return `An unexpected error stopped JoyFox ${where}.`;
  }
}

const STEP_TEXT: Record<ActionStep, Record<StepOutcome, string>> = {
  ignore: {
    done: "Ignore: done. JoyClub ignores this member.",
    "not-done": "Ignore: not done.",
    unknown:
      "Ignore: not confirmed. JoyFox started it but did not see JoyClub confirm it.",
  },
  delete: {
    done: "Delete: done. JoyClub moved the conversation to the trash.",
    "not-done": "Delete: not done.",
    unknown:
      "Delete: not confirmed. JoyFox started it but did not see JoyClub confirm it.",
  },
};

const NEXT_ACTION: Record<ActionStep, string> = {
  ignore:
    "Next: open the member's profile and check whether they are ignored. If not, ignore them there yourself.",
  delete:
    "Next: open the conversation and check whether it is in the trash. If not, move it there yourself with JoyClub's trash button.",
};

/**
 * The notice for one operation, from its ActionLog steps alone (PRD Section
 * 21.2). It states what was done, what was not, why it stopped and the next
 * manual action. It never claims a rollback: nothing is undone.
 */
export function reportOperation(
  log: Pick<ActionLog, "steps" | "updatedAt">,
  now: number,
): OperationReport {
  const steps = log.steps;
  const last = steps.at(-1);
  const lastState = last?.name as ActionState | undefined;
  const ignore = outcome(steps, "ignore");
  const remove = outcome(steps, "delete");
  const failure =
    lastState === "Failed" &&
    ACTION_FAILURES.includes(last?.errorCode as ActionFailure)
      ? (last?.errorCode as ActionFailure)
      : undefined;
  const lastAt = Date.parse(last?.at ?? log.updatedAt);
  const status: OperationReport["status"] =
    lastState === "Completed"
      ? "completed"
      : lastState === "Failed"
        ? "failed"
        : !Number.isFinite(lastAt) || now - lastAt > STALE_AFTER_MS
          ? "interrupted"
          : "running";
  const lines: string[] = [];
  if (status === "completed") {
    lines.push("Ignore and Delete finished.", STEP_TEXT.delete.done);
    lines.push(STEP_TEXT.ignore.done);
    return { status, ignore, delete: remove, lines };
  }
  if (status === "running") {
    lines.push("Ignore and Delete is running.");
    return { status, ignore, delete: remove, lines };
  }
  lines.push(
    status === "failed"
      ? "Ignore and Delete stopped."
      : "Ignore and Delete was interrupted, for example because the tab closed.",
  );
  if (failure) {
    // The step that did not complete: Delete runs first.
    const step = remove === "done" ? "ignore" : "delete";
    lines.push(failureText(failure, step, step === "ignore" ? ignore : remove));
  }
  lines.push(STEP_TEXT.delete[remove], STEP_TEXT.ignore[ignore]);
  lines.push(
    ignore === "not-done" && remove === "not-done"
      ? "Nothing was changed on JoyClub."
      : "JoyFox did not undo anything.",
  );
  if (remove !== "done") lines.push(NEXT_ACTION.delete);
  if (ignore !== "done") lines.push(NEXT_ACTION.ignore);
  return {
    status,
    ignore,
    delete: remove,
    ...(failure ? { failure } : {}),
    lines,
  };
}
