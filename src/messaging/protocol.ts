import type { BeginAnswer, RecordAnswer } from "../actions/executor";
import type {
  ActionFailure,
  ActionState,
  OperationReport,
} from "../actions/ignore-delete";
import type { TriagePlacement } from "../domain/types";
import type { ProfileFacts } from "../qualification/facts";
import type {
  TriageRequestMember,
  TriageResponse,
  TrustResponse,
} from "../triage/triage-service";
import type { TrustOutcomeKind } from "../trust/trust-service";

/** What the composer picker needs of one template, and nothing else. */
export interface TemplateSummary {
  id: string;
  name: string;
  folder: string;
  body: string;
}

/**
 * One member's note and tags under the active account (M5). `accountId` is
 * the account they were read for; writes send it back.
 */
export type MemberNotesResponse =
  | { status: "no-account" }
  | {
      status: "ok";
      accountId: string;
      /** The stored note, or `null` when there is none. */
      note: string | null;
      tags: string[];
    };

export interface ExtensionMessage<T = unknown> {
  type: string;
  requestId: string;
  payload: T;
}
export interface MessageError {
  code: string;
  message: string;
}
export type ExtensionResponse<T = unknown> =
  | { requestId: string; ok: true; payload: T }
  | { requestId: string; ok: false; error: MessageError };

export interface MessageContract {
  "diagnostic.ping": {
    request: { value: string };
    response: { value: string };
  };
  "diagnostic.wake": {
    request: { accountId: string };
    response: { wakeCount: number };
  };
  /** Placements for the given senders under the active account's rule. */
  "triage.evaluate": {
    request: { members: TriageRequestMember[] };
    response: TriageResponse;
  };
  /** Store (or clear, with `null`) the user's placement for one sender. */
  "triage.setOverride": {
    request: {
      accountId: string;
      memberId: string;
      placement: TriagePlacement | null;
    };
    response: { done: boolean };
  };
  "trust.log": {
    request: { accountId: string; memberId: string; kind: TrustOutcomeKind };
    response: { done: boolean };
  };
  /** The trust score alone, for a page shown while no rule is on. */
  "trust.get": {
    request: { memberId: string; observed: Partial<ProfileFacts> };
    response: TrustResponse;
  };
  "trust.undo": {
    request: { accountId: string; memberId: string };
    response: { removed: boolean };
  };
  /** Cache the facts a profile page showed. Counts, codes and dates only. */
  "snapshot.capture": {
    request: {
      accountId: string;
      memberId: string;
      observed: Partial<ProfileFacts>;
    };
    response: { stored: boolean };
  };
  /**
   * The active account's message templates, for the composer picker (M10).
   * `accountId` is absent when no account is active.
   */
  "template.list": {
    request: Record<string, never>;
    response: { accountId?: string; templates: TemplateSummary[] };
  };
  "note.get": {
    request: { memberId: string };
    response: MemberNotesResponse;
  };
  /**
   * Save one member's note, or remove it with an empty body. `expectedBody`
   * is the note the editor was drawn from (`null`: none). A note changed
   * since is not overwritten: the answer is `conflict` with the stored text.
   * `refused` means the account is no longer active.
   */
  "note.save": {
    request: {
      accountId: string;
      memberId: string;
      body: string;
      expectedBody: string | null;
    };
    response:
      | { status: "saved" | "conflict"; current: string | null }
      | { status: "refused" };
  };
  "tag.add": {
    request: { accountId: string; memberId: string; label: string };
    response: { done: boolean };
  };
  "tag.remove": {
    request: { accountId: string; memberId: string; label: string };
    response: { done: boolean };
  };
  /**
   * M9: start a Quick Ignore and Delete operation. The content script runs
   * the steps; the background stores each transition in ActionLog.
   */
  "action.ignoreDelete.start": {
    request: { accountId: string; memberId: string; conversationId: string };
    response: BeginAnswer;
  };
  /** Store one transition; answered only once it is stored. */
  "action.ignoreDelete.record": {
    request: {
      accountId: string;
      operationId: string;
      state: ActionState;
      failure?: ActionFailure;
    };
    response: { status: RecordAnswer };
  };
  /** The newest operation for one member under the active account. */
  "action.ignoreDelete.latest": {
    request: { memberId: string };
    response:
      | { status: "no-account" }
      | { status: "none"; accountId: string }
      | {
          status: "ok";
          accountId: string;
          /** The conversation the run acted on, when it was stored. */
          conversationId?: string;
          /** When the run last moved: its last stored step. */
          updatedAt: string;
          report: OperationReport;
        };
  };
  /** Content scripts cannot open the options page themselves. */
  "options.open": {
    request: Record<string, never>;
    response: { done: boolean };
  };
}

export function createRequestId(): string {
  return crypto.randomUUID();
}
