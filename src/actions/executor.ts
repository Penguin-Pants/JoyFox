import type { ActionLog } from "../domain/types";
import {
  checkTarget,
  reportOperation,
  STEP_ORDER,
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
 * driver exists yet: F7 shows Ignore is only on the profile page (Path B), so
 * the live driver waits on resume after navigation and on the conversation
 * page's Delete result. Only test drivers implement this.
 */
export interface QuickActionDriver {
  /** What the page shows now. Read fresh before every click. */
  currentTarget(): CurrentTarget;
  /** Whether the step's JoyClub control is on the page. Never clicks. */
  hasControl(step: ActionStep): boolean;
  /**
   * Whether the page can show the step's result afterwards. Never clicks.
   * A step that could not be checked is not started. Absent: always.
   */
  canVerify?(step: ActionStep): boolean;
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
  | { status: "refused" }
  /** The request reached the log after its deadline, so nothing was stored. */
  | { status: "expired" };

export type RecordAnswer =
  | "recorded"
  | "refused"
  | "invalid"
  | "unknown-operation"
  | "superseded";

/** Where transitions are stored: the background's ActionLog, in the page. */
export interface ActionRecorder {
  /**
   * `deadline` (epoch milliseconds) is when the caller stops waiting. The
   * log stores nothing after it, so a late answer never leaves a run that
   * reads as running with no tab behind it.
   */
  begin(target: ActionTarget, deadline?: number): Promise<BeginAnswer>;
  record(
    operationId: string,
    state: ActionState,
    failure?: ActionFailure,
  ): Promise<RecordAnswer>;
}

export interface ExecutionResult {
  /**
   * `busy`: another run for this member is still going; nothing was done.
   * `handed-off`: the next step needs another page. The hand-off marker is
   * stored and the run continues there through `resume`.
   */
  status: "finished" | "busy" | "handed-off";
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
  /**
   * Path B (ADR 0011): called when the next step's control is on another
   * page, after the previous step is confirmed and stored. It only stores
   * the hand-off marker. The caller navigates once the run returns
   * `handed-off`, never from here, so a late answer after a timeout never
   * moves the page. If it fails, the run stops there.
   */
  handOff?: (operationId: string, next: ActionStep) => Promise<void>;
  /**
   * Continue a handed-off run on the new page, from `from`, with the steps
   * already stored. No new operation is started.
   */
  resume?: {
    operationId: string;
    from: ActionStep;
    steps: ActionLog["steps"];
  };
}

/** The page each step's JoyClub control is on (F7, ADR 0011). */
const STEP_PAGE: Record<ActionStep, "conversation" | "profile"> = {
  delete: "conversation",
  ignore: "profile",
};

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
  const resume = options.resume;
  const steps: ActionLog["steps"] = resume
    ? [...resume.steps]
    : [{ name: "Started", ok: true, at: now() }];
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

  let operationId: string;
  if (resume) operationId = resume.operationId;
  else {
    let begun: BeginAnswer;
    try {
      const deadline = Date.parse(now()) + timeout;
      begun = await withTimeout(recorder.begin(target, deadline), timeout);
    } catch {
      note("Failed", "log-unavailable");
      return { status: "finished", report: report() };
    }
    if (begun.status === "busy")
      return { status: "busy", report: begun.report };
    if (begun.status === "refused") {
      note("Failed", "account-changed");
      return { status: "finished", report: report() };
    }
    if (begun.status === "expired") {
      // As a timeout: the log could not store the start in time.
      note("Failed", "log-unavailable");
      return { status: "finished", report: report() };
    }
    operationId = begun.operationId;
  }

  const store = async (
    state: ActionState,
  ): Promise<ActionFailure | undefined> => {
    try {
      const answer = await withTimeout(
        recorder.record(operationId, state),
        timeout,
      );
      if (answer === "recorded") return undefined;
      if (answer === "refused") return "account-changed";
      return answer === "superseded" ? "superseded" : "log-unavailable";
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
      if (!driver.hasControl(step)) return "control-missing";
      if (driver.canVerify && !driver.canVerify(step)) return "unverifiable";
      return undefined;
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

  const order = resume
    ? STEP_ORDER.slice(STEP_ORDER.indexOf(resume.from))
    : STEP_ORDER;
  for (const [index, step] of order.entries()) {
    // A later step whose control is on another page is handed off: the
    // caller stores the marker and navigates, and the new page resumes.
    if (index > 0 && options.handOff) {
      let page: string | undefined;
      try {
        page = driver.currentTarget().page;
      } catch {
        return stop("step-error");
      }
      if (page !== STEP_PAGE[step]) {
        // A stop reason (the flag turned off, an account switch) ends the
        // run here: no marker is stored and the page does not move.
        const stopped = options.stopReason?.();
        if (stopped) return stop(stopped);
        const handed = await attempt(() => options.handOff!(operationId, step));
        if (handed)
          return stop(handed === "timeout" ? "timeout" : "handoff-failed");
        // Stopped while the marker was stored: the page must not move. The
        // stored Failed step makes the marker unusable for any page.
        const late = options.stopReason?.();
        if (late) return stop(late);
        return { status: "handed-off", operationId, report: report() };
      }
    }
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
