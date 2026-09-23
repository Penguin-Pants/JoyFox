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
  /** Content scripts cannot open the options page themselves. */
  "options.open": {
    request: Record<string, never>;
    response: { done: boolean };
  };
}

export function createRequestId(): string {
  return crypto.randomUUID();
}
