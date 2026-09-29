import type { ActionLog } from "../domain/types";
import { ExtensionError } from "../errors";
import { registerMember } from "../storage/member-directory";
import {
  ActionLogRepository,
  JoyClubMemberRepository,
} from "../storage/repositories";
import {
  canTransition,
  isQuickAction,
  QUICK_IGNORE_DELETE,
  reportOperation,
  type ActionFailure,
  type ActionState,
  type ActionTarget,
  type OperationReport,
  type QuickAction,
} from "./ignore-delete";

export type BeginResult =
  | { status: "started"; operationId: string }
  /** Another operation for this member is still running. */
  | { status: "busy"; report: OperationReport };

export type RecordResult =
  | "recorded"
  | "invalid"
  | "unknown-operation"
  /** A newer run for the member started; this one may not continue. */
  | "superseded";

function requireAccountId(accountId: string): void {
  if (accountId.trim().length === 0)
    throw new ExtensionError(
      "IdentityMismatch",
      "An action needs an explicit active account",
    );
}

/** Newest first by instant, then by ID, which carries a sequence. */
const newestFirst = (a: ActionLog, b: ActionLog) =>
  Date.parse(b.createdAt) - Date.parse(a.createdAt) || b.id.localeCompare(a.id);

/**
 * The M9 ActionLog, for Quick Ignore and Delete and for Delete alone. Every transition is appended and stored at once, before
 * the caller may act on it, so the log always shows how far an operation got
 * (build plan Section 16). A transition the state machine does not allow is
 * refused, so the log can never describe an impossible sequence. The caller
 * holds the account lock.
 */
export class ActionLogService {
  #sequence = 0;

  constructor(
    private readonly logs = new ActionLogRepository(),
    private readonly members = new JoyClubMemberRepository(),
    private readonly now: () => string = () => new Date().toISOString(),
    private readonly newId: () => string = () => crypto.randomUUID(),
  ) {}

  /**
   * Start an operation, unless one for the same member is still running (in
   * another tab, for example), whichever action it is: only one trash run
   * at a time. One that stopped moving counts as interrupted and does not
   * block a new start.
   */
  async begin(
    accountId: string,
    target: ActionTarget,
    action: QuickAction = QUICK_IGNORE_DELETE,
  ): Promise<BeginResult> {
    requireAccountId(accountId);
    const previous = await this.latest(accountId, target.memberId);
    const at = this.now();
    if (previous) {
      const report = reportOperation(previous, Date.parse(at));
      if (report.status === "running") return { status: "busy", report };
    }
    this.#sequence += 1;
    const operationId = `action:${at}:${String(this.#sequence).padStart(6, "0")}:${this.newId()}`;
    await registerMember(this.members, accountId, target.memberId, at);
    await this.logs.put(accountId, {
      id: operationId,
      accountId,
      memberId: target.memberId,
      conversationId: target.conversationId,
      action,
      steps: [{ name: "Started", ok: true, at }],
      createdAt: at,
      updatedAt: at,
    });
    return { status: "started", operationId };
  }

  /**
   * Append one transition. `Failed` needs a reason and no other state may
   * carry one. Only the member's newest run may move: a run that read as
   * interrupted (its tab was suspended, for example) and was replaced by a
   * newer one is refused if its tab resumes, so two runs never act on one
   * member at once.
   */
  async record(
    accountId: string,
    operationId: string,
    state: ActionState,
    failure?: ActionFailure,
  ): Promise<RecordResult> {
    requireAccountId(accountId);
    const log = await this.logs.get(accountId, operationId);
    if (!log || !isQuickAction(log.action)) return "unknown-operation";
    const last = log.steps.at(-1)?.name as ActionState | undefined;
    if (!last || !canTransition(last, state, log.action)) return "invalid";
    if ((state === "Failed") !== (failure !== undefined)) return "invalid";
    if (log.memberId) {
      const newest = await this.latest(accountId, log.memberId);
      if (newest && newest.id !== log.id) return "superseded";
    }
    const at = this.now();
    await this.logs.put(accountId, {
      ...log,
      steps: [
        ...log.steps,
        {
          name: state,
          ok: state !== "Failed",
          at,
          ...(failure ? { errorCode: failure } : {}),
        },
      ],
      updatedAt: at,
    });
    return "recorded";
  }

  /** One operation by ID, or `undefined` when it is not a quick action. */
  async find(
    accountId: string,
    operationId: string,
  ): Promise<ActionLog | undefined> {
    requireAccountId(accountId);
    const log = await this.logs.get(accountId, operationId);
    return isQuickAction(log?.action) ? log : undefined;
  }

  /**
   * The newest operation for one member, Quick Ignore and Delete or Delete
   * alone: both act on the member's conversation, so a newer one of either
   * replaces an older one.
   */
  async latest(
    accountId: string,
    memberId: string,
  ): Promise<ActionLog | undefined> {
    requireAccountId(accountId);
    const logs = await this.logs.list(accountId);
    return logs
      .filter((log) => isQuickAction(log.action) && log.memberId === memberId)
      .sort(newestFirst)[0];
  }
}
