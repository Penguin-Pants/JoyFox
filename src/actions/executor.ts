import type { ActionLog } from "../domain/types";
import {
  checkTarget,
  reportOperation,
  STEP_STATES,
  STEP_TIMEOUT_MS,
  type ActionFailure,
  type ActionState,
  type ActionStep,
  type ActionTarget,
  type CurrentTarget,
  type OperationReport,
} from "./ignore-delete";

/**
 * The JoyClub side of M9, one method per kind of page action. The executor
 * decides when each is called; a driver only reads and clicks. No live
 * driver exists yet: where Ignore lives in JoyClub's UI is unverified (F7),
 * so only test drivers implement this.
 */
export interface QuickActionDriver {
  /** What the page shows now. Read fresh before every click. */
  currentTarget(): CurrentTarget;
  /** Whether the step's JoyClub control is on the page. Never clicks. */
  hasControl(step: ActionStep): boolean;
  /** Click the step's JoyClub control. */
  request(step: ActionStep): Promise<void>;
  /**
   * Wait for JoyClub's own confirmation for the step. `none` when JoyClub
   * asks for no confirmation for this step.
   */
  awaitConfirmation(step: ActionStep): Promise<"shown" | "missing" | "none">;
  /** Click JoyClub's confirmation. */
  confirm(step: ActionStep): Promise<void>;
  /** Whether JoyClub now shows that the step succeeded. */
  verify(step: ActionStep): Promise<boolean>;
}

export type BeginAnswer =
  | { status: "started"; operationId: string }
  | { status: "busy"; report: OperationReport }
  /** The account the page's data came from is no longer active. */
  | { status: "refused" };

export type RecordAnswer =
  | "recorded"
  | "refused"
  | "invalid"
  | "unknown-operation";

/** Where transitions are stored: the background's ActionLog, in the page. */
export interface ActionRecorder {
  begin(target: ActionTarget): Promise<BeginAnswer>;
  record(
    operationId: string,
    state: ActionState,
    failure?: ActionFailure,
  ): Promise<RecordAnswer>;
}

export interface ExecutionResult {
  /** `busy`: another run for this member is still going; nothing was done. */
  status: "finished" | "busy";
  operationId?: string;
  report: OperationReport;
}

export interface ExecutionOptions {
  target: ActionTarget;
  driver: QuickActionDriver;
  recorder: ActionRecorder;
  /** A reason to stop before the next click, such as an account switch. */
  stopReason?: () => ActionFailure | undefined;
  onState?: (state: ActionState) => void;
  timeoutMs?: number;
  now?: () => string;
}

class StepTimeout extends Error {}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  return Promise.race([
    promise,
    new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new StepTimeout()), ms);
    }),
  ]).finally(() => clearTimeout(timer));
}

const failureOf = (error: unknown): ActionFailure =>
  error instanceof StepTimeout ? "timeout" : "step-error";

/**
 * Run Quick Ignore and Delete once (build plan Section 16). The order per
 * step is fixed:
 *
 * 1. Check, without clicking, that the page shows the expected member and
 *    conversation and that the step's control is there.
 * 2. Record `…Requested` and wait until it is stored. If it cannot be
 *    stored, nothing is clicked.
 * 3. Click the control. Check identity again, then complete JoyClub's own
 *    confirmation if it asks for one.
 * 4. Check that JoyClub shows success, then record `…Confirmed`.
 *
 * Any failure stops at once. A completed step is kept and reported, never
 * undone. The report is built from the same steps the ActionLog holds; a
 * step JoyClub confirmed but the log could not store still shows as done.
 */
export async function runQuickIgnoreDelete(
  options: ExecutionOptions,
): Promise<ExecutionResult> {
  const { target, driver, recorder } = options;
  const timeout = options.timeoutMs ?? STEP_TIMEOUT_MS;
  const now = options.now ?? (() => new Date().toISOString());
  const steps: ActionLog["steps"] = [{ name: "Started", ok: true, at: now() }];
  const note = (state: ActionState, failure?: ActionFailure) => {
    steps.push({
      name: state,
      ok: state !== "Failed",
      at: now(),
      ...(failure ? { errorCode: failure } : {}),
    });
    try {
      options.onState?.(state);
    } catch {
      // A display callback must never stop or break the run.
    }
  };
  const report = () =>
    reportOperation({ steps, updatedAt: now() }, Date.parse(now()));

  let begun: BeginAnswer;
  try {
    begun = await withTimeout(recorder.begin(target), timeout);
  } catch {
    note("Failed", "log-unavailable");
    return { status: "finished", report: report() };
  }
  if (begun.status === "busy") return { status: "busy", report: begun.report };
  if (begun.status === "refused") {
    note("Failed", "account-changed");
    return { status: "finished", report: report() };
  }
  const operationId = begun.operationId;

  const store = async (
    state: ActionState,
  ): Promise<ActionFailure | undefined> => {
    try {
      const answer = await withTimeout(
        recorder.record(operationId, state),
        timeout,
      );
      if (answer === "recorded") return undefined;
      return answer === "refused" ? "account-changed" : "log-unavailable";
    } catch {
      return "log-unavailable";
    }
  };
  const stop = async (failure: ActionFailure): Promise<ExecutionResult> => {
    note("Failed", failure);
    // Best effort: when this cannot be stored, the log's last step stays
    // the one before, which later reads as interrupted, not as success.
    await withTimeout(
      recorder.record(operationId, "Failed", failure),
      timeout,
    ).catch(() => undefined);
    return { status: "finished", operationId, report: report() };
  };
  /**
   * Read fresh right before every click, with no wait in between: the stop
   * reason (an account switch), the page's identity and the step's control.
   * A driver that throws counts as a failure, never as a pass.
   */
  const guard = (step: ActionStep): ActionFailure | undefined => {
    try {
      return (
        options.stopReason?.() ??
        checkTarget(target, driver.currentTarget(), step)
      );
    } catch {
      return "step-error";
    }
  };
  const ready = (step: ActionStep): ActionFailure | undefined => {
    const failure = guard(step);
    if (failure) return failure;
    try {
      return driver.hasControl(step) ? undefined : "control-missing";
    } catch {
      return "step-error";
    }
  };
  const attempt = async (
    action: () => Promise<unknown>,
  ): Promise<ActionFailure | undefined> => {
    try {
      await withTimeout(action(), timeout);
      return undefined;
    } catch (error) {
      return failureOf(error);
    }
  };

  const runStep = async (
    step: ActionStep,
  ): Promise<ActionFailure | undefined> => {
    const { requested, confirmed } = STEP_STATES[step];
    const before = ready(step);
    if (before) return before;
    const unstored = await store(requested);
    if (unstored) return unstored;
    note(requested);
    // Storing is a round trip: the page or the account can change while it
    // runs, so everything is checked again right before the click. If that
    // stops the run, the log says the step was started, never less.
    const changed = ready(step);
    if (changed) return changed;
    const clicked = await attempt(() => driver.request(step));
    if (clicked) return clicked;
    let confirmation: "shown" | "missing" | "none" = "missing";
    const waited = await attempt(async () => {
      confirmation = await driver.awaitConfirmation(step);
    });
    if (waited) return waited;
    if (confirmation === "missing") return "confirmation-missing";
    if (confirmation === "shown") {
      const moved = guard(step);
      if (moved) return moved;
      const confirmedClick = await attempt(() => driver.confirm(step));
      if (confirmedClick) return confirmedClick;
    }
    let verified = false;
    const checked = await attempt(async () => {
      verified = await driver.verify(step);
    });
    if (checked) return checked;
    if (!verified) return "not-verified";
    // JoyClub confirmed it, so it counts as done even if storing fails.
    note(confirmed);
    return store(confirmed);
  };

  for (const step of ["ignore", "delete"] as const) {
    let failure: ActionFailure | undefined;
    try {
      failure = await runStep(step);
    } catch {
      // Defense in depth: no error may escape with the log left open.
      failure = "step-error";
    }
    if (failure) return stop(failure);
  }
  // Both steps are done on JoyClub. If the end cannot be stored, the log
  // later reads as interrupted with both steps done, which is still true.
  note("Completed");
  await store("Completed");
  return { status: "finished", operationId, report: report() };
}
