import type { ActionLogService } from "../actions/action-log-service";
import {
  ACTION_FAILURES,
  ACTION_STATES,
  reportOperation,
  STALE_AFTER_MS,
  STEP_ORDER,
  STEP_STATES,
  type ActionFailure,
  type ActionState,
  type ActionStep,
} from "../actions/ignore-delete";
import type { ActionLog } from "../domain/types";
import type { MessageRouter, RouteContext } from "../messaging/router";
import { bumpActionRevision } from "../storage/action-revision";
import type { SettingsArea } from "../storage/local-settings";
import {
  invalid,
  lockedWrite,
  memberId,
  type ActiveAccountSource,
} from "./handler-guards";

export interface ActionHandlerDeps extends ActiveAccountSource {
  actions: ActionLogService;
  now?: () => number;
  /** Where the action revision is set; `storage.local` by default. */
  settings?: SettingsArea;
  /**
   * Where hand-off markers are kept: `storage.session`, so they never reach
   * disk and end with the browser session. Without it, no run hands off.
   */
  session?: SettingsArea;
}

/** One marker per tab; a newer hand-off in the same tab replaces it. */
const HANDOFF_PREFIX = "joyfox.m9.handOff.";

interface HandOffMarker {
  accountId: string;
  operationId: string;
  next: ActionStep;
  /** When it was stored, in milliseconds. */
  at: number;
}

function tabId(context: RouteContext): number {
  if (typeof context.tabId !== "number") throw invalid("tab");
  return context.tabId;
}

/** A step that can follow a hand-off: any but the first. */
function nextStep(value: unknown): ActionStep {
  const index = STEP_ORDER.indexOf(value as ActionStep);
  if (index < 1) throw invalid("step");
  return value as ActionStep;
}

/** The stored step that must come right before `next` is requested. */
function stepBefore(next: ActionStep): ActionState {
  const previous = STEP_ORDER[STEP_ORDER.indexOf(next) - 1]!;
  return STEP_STATES[previous].confirmed;
}

function isMarker(value: unknown): value is HandOffMarker {
  const marker = value as Partial<HandOffMarker> | undefined;
  return (
    typeof marker?.accountId === "string" &&
    typeof marker.operationId === "string" &&
    typeof marker.at === "number" &&
    STEP_ORDER.indexOf(marker.next as ActionStep) > 0
  );
}

/** The opaque conversation ID from the conversation URL (02-conversation.md). */
const CONVERSATION_ID_PATTERN = /^personal-\d{1,20}-\d{1,20}$/;
const MAX_OPERATION_ID_LENGTH = 200;

function conversationId(value: unknown): string {
  if (typeof value !== "string" || !CONVERSATION_ID_PATTERN.test(value))
    throw invalid("conversation ID");
  return value;
}

function operationId(value: unknown): string {
  if (
    typeof value !== "string" ||
    value.length === 0 ||
    value.length > MAX_OPERATION_ID_LENGTH
  )
    throw invalid("operation ID");
  return value;
}

function state(value: unknown): ActionState {
  if (!ACTION_STATES.includes(value as ActionState)) throw invalid("state");
  return value as ActionState;
}

function failure(value: unknown): ActionFailure | undefined {
  if (value === undefined) return undefined;
  if (!ACTION_FAILURES.includes(value as ActionFailure))
    throw invalid("failure");
  return value as ActionFailure;
}

/**
 * Register the M9 ActionLog handlers. Every write names the account the
 * page's data came from and runs under that account's lock; it is refused
 * once that account is no longer active, so an operation stops at its next
 * step after an account switch (build plan Section 24, case 12).
 */
export function registerActionHandlers(
  router: MessageRouter,
  deps: ActionHandlerDeps,
): void {
  const now = deps.now ?? (() => Date.now());
  router.register("action.ignoreDelete.start", async (payload) => {
    const target = {
      memberId: memberId(payload?.memberId),
      conversationId: conversationId(payload?.conversationId),
    };
    const answer = await lockedWrite<
      Awaited<ReturnType<ActionLogService["begin"]>> | { status: "refused" }
    >(deps, payload?.accountId, { status: "refused" }, (accountId) =>
      deps.actions.begin(accountId, target),
    );
    if (answer.status === "started") await bumpActionRevision(deps.settings);
    return answer;
  });
  router.register("action.ignoreDelete.record", async (payload) => {
    const id = operationId(payload?.operationId);
    const next = state(payload?.state);
    const reason = failure(payload?.failure);
    const answer = await lockedWrite<{
      status: Awaited<ReturnType<ActionLogService["record"]>> | "refused";
    }>(deps, payload?.accountId, { status: "refused" }, async (accountId) => ({
      status: await deps.actions.record(accountId, id, next, reason),
    }));
    if (answer.status === "recorded") await bumpActionRevision(deps.settings);
    return answer;
  });
  /**
   * A run may continue only where it can be proven to be the same run: the
   * member's newest, not moved since the hand-off, not stale.
   */
  const handOffReady = async (
    accountId: string,
    operationId: string,
    next: ActionStep,
  ): Promise<ActionLog | undefined> => {
    const log = await deps.actions.find(accountId, operationId);
    if (!log?.memberId || !log.conversationId) return undefined;
    const newest = await deps.actions.latest(accountId, log.memberId);
    if (newest?.id !== log.id) return undefined;
    const last = log.steps.at(-1);
    if (last?.name !== stepBefore(next)) return undefined;
    const moved = Date.parse(last.at);
    return Number.isFinite(moved) && now() - moved <= STALE_AFTER_MS
      ? log
      : undefined;
  };
  router.register("action.ignoreDelete.handOff", async (payload, context) => {
    const tab = tabId(context);
    const id = operationId(payload?.operationId);
    const next = nextStep(payload?.next);
    const session = deps.session;
    if (!session) return { status: "refused" };
    return lockedWrite<{ status: "stored" | "refused" }>(
      deps,
      payload?.accountId,
      { status: "refused" },
      async (accountId) => {
        if (!(await handOffReady(accountId, id, next)))
          return { status: "refused" };
        const marker: HandOffMarker = {
          accountId,
          operationId: id,
          next,
          at: now(),
        };
        await session.set({ [`${HANDOFF_PREFIX}${tab}`]: marker });
        return { status: "stored" };
      },
    );
  });
  router.register("action.ignoreDelete.pending", async (_payload, context) => {
    const key = `${HANDOFF_PREFIX}${tabId(context)}`;
    const session = deps.session;
    if (!session) return { status: "none" };
    const stored = (await session.get([key]))[key];
    if (stored === undefined) return { status: "none" };
    // One-shot: a reload or a later page never continues the run again.
    await session.remove([key]);
    if (!isMarker(stored) || now() - stored.at > STALE_AFTER_MS)
      return { status: "none" };
    if ((await deps.activeAccountId()) !== stored.accountId)
      return { status: "none" };
    const log = await handOffReady(
      stored.accountId,
      stored.operationId,
      stored.next,
    );
    if (!log?.memberId || !log.conversationId) return { status: "none" };
    return {
      status: "ok",
      accountId: stored.accountId,
      operationId: log.id,
      memberId: log.memberId,
      conversationId: log.conversationId,
      next: stored.next,
      steps: log.steps,
    };
  });
  router.register("action.ignoreDelete.latest", async (payload) => {
    const id = memberId(payload?.memberId);
    const accountId = await deps.activeAccountId();
    if (!accountId) return { status: "no-account" };
    const log = await deps.actions.latest(accountId, id);
    if (!log) return { status: "none", accountId };
    return {
      status: "ok",
      accountId,
      ...(log.conversationId ? { conversationId: log.conversationId } : {}),
      updatedAt: log.steps.at(-1)?.at ?? log.updatedAt,
      report: reportOperation(log, now()),
    };
  });
}
