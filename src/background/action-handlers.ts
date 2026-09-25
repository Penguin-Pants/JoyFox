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
import type { MessageContract } from "../messaging/protocol";
import type { MessageRouter, RouteContext } from "../messaging/router";
import { withAccountLock } from "../storage/account-lock";
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
  /** The only page address that may resume the run. */
  profilePath: string;
  /** When it was stored, in milliseconds. */
  at: number;
}

/** The profile path of `memberId`, as `03-profile.md` records it. */
const PROFILE_PATH = /^\/profile\/(\d{1,20})\.[^/]+\.html$/;

function profilePath(value: unknown): string {
  if (typeof value !== "string" || !PROFILE_PATH.test(value))
    throw invalid("profile path");
  return value;
}

/** The conversation page's path (`02-conversation.md`). */
const CONVERSATION_PATH =
  /^\/clubmail\/conversation\/conversation-wrapper-(personal-\d{1,20}-\d{1,20})\/?$/;

/** The sending page's path, as the browser reports it. */
function senderPath(context: RouteContext): string | undefined {
  try {
    return context.url ? new URL(context.url).pathname : undefined;
  } catch {
    return undefined;
  }
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
    typeof marker.profilePath === "string" &&
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
    const path = profilePath(payload?.profilePath);
    const session = deps.session;
    if (!session) return { status: "refused" };
    return lockedWrite<{ status: "stored" | "refused" }>(
      deps,
      payload?.accountId,
      { status: "refused" },
      async (accountId) => {
        const log = await handOffReady(accountId, id, next);
        // The path must be the run's own member's profile, and the sender,
        // as the browser reports it, the run's own conversation page.
        if (
          !log ||
          PROFILE_PATH.exec(path)?.[1] !== log.memberId ||
          CONVERSATION_PATH.exec(senderPath(context) ?? "")?.[1] !==
            log.conversationId
        )
          return { status: "refused" };
        const marker: HandOffMarker = {
          accountId,
          operationId: id,
          next,
          profilePath: path,
          at: now(),
        };
        await session.set({ [`${HANDOFF_PREFIX}${tab}`]: marker });
        return { status: "stored" };
      },
    );
  });
  /**
   * The tab did not leave for the profile in time: the navigation was
   * cancelled, or never finished. The marker goes, so a later visit to the
   * profile in this tab never continues the run, and the run is closed as
   * not handed off, so its notice says at once what was and was not done.
   */
  router.register("action.ignoreDelete.withdraw", async (payload, context) => {
    const key = `${HANDOFF_PREFIX}${tabId(context)}`;
    const id = operationId(payload?.operationId);
    const session = deps.session;
    if (!session) return { status: "none" };
    const answer = await lockedWrite<
      MessageContract["action.ignoreDelete.withdraw"]["response"]
    >(deps, payload?.accountId, { status: "none" }, async (accountId) => {
      const stored = (await session.get([key]))[key];
      // Only this run's own marker; a newer run's marker in the tab stays.
      if (
        !isMarker(stored) ||
        stored.accountId !== accountId ||
        stored.operationId !== id
      )
        return { status: "none" };
      await session.remove([key]);
      if (!(await handOffReady(accountId, id, stored.next)))
        return { status: "none" };
      await deps.actions.record(accountId, id, "Failed", "handoff-failed");
      const closed = await deps.actions.find(accountId, id);
      return closed
        ? { status: "withdrawn", lines: reportOperation(closed, now()).lines }
        : { status: "none" };
    });
    if (answer.status === "withdrawn") await bumpActionRevision(deps.settings);
    return answer;
  });
  router.register("action.ignoreDelete.pending", async (_payload, context) => {
    const key = `${HANDOFF_PREFIX}${tabId(context)}`;
    const session = deps.session;
    if (!session) return { status: "none" };
    const stored = (await session.get([key]))[key];
    if (stored === undefined) return { status: "none" };
    // Decide first. If a read below fails (the background or the database is
    // restarting), the marker stays, so the page's retry can still use it.
    const answer = await readHandOff(stored, context);
    // One-shot: a reload or a later page never continues the run again.
    await session.remove([key]);
    if (answer.status === "stopped") await bumpActionRevision(deps.settings);
    return answer;
  });
  const readHandOff = async (
    stored: unknown,
    context: RouteContext,
  ): Promise<MessageContract["action.ignoreDelete.pending"]["response"]> => {
    if (!isMarker(stored) || now() - stored.at > STALE_AFTER_MS)
      return { status: "none" };
    // Only the profile the run went to, as the browser reports the sender.
    if (senderPath(context) !== stored.profilePath) return { status: "none" };
    if ((await deps.activeAccountId()) !== stored.accountId) {
      // The account changed after Delete: close the run where it stopped,
      // under its own account, so it never reads as still going, and say so.
      const closed = await withAccountLock(stored.accountId, async () => {
        if (
          !(await handOffReady(
            stored.accountId,
            stored.operationId,
            stored.next,
          ))
        )
          return undefined;
        await deps.actions.record(
          stored.accountId,
          stored.operationId,
          "Failed",
          "account-changed",
        );
        return deps.actions.find(stored.accountId, stored.operationId);
      });
      if (!closed) return { status: "none" };
      return {
        status: "stopped",
        lines: reportOperation(closed, now()).lines,
      };
    }
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
  };
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
