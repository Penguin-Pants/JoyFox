import type { ActionLogService } from "../actions/action-log-service";
import {
  ACTION_FAILURES,
  ACTION_STATES,
  reportOperation,
  type ActionFailure,
  type ActionState,
} from "../actions/ignore-delete";
import type { MessageRouter } from "../messaging/router";
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
  router.register("action.ignoreDelete.latest", async (payload) => {
    const id = memberId(payload?.memberId);
    const accountId = await deps.activeAccountId();
    if (!accountId) return { status: "no-account" };
    const log = await deps.actions.latest(accountId, id);
    return log
      ? { status: "ok", accountId, report: reportOperation(log, now()) }
      : { status: "none", accountId };
  });
}
