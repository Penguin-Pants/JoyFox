import type { BeginAnswer, RecordAnswer } from "../actions/executor";
import type {
  ActionFailure,
  ActionState,
  ActionStep,
  OperationReport,
} from "../actions/ignore-delete";
import type { ActionLog, TriagePlacement } from "../domain/types";
import type { Message } from "../i18n/message";
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
  /** "" for a template without a folder, shown as "General". */
  folder: string;
  body: string;
}

/** One tracked event or venue, as a page or the list filter needs it (V1-5). */
export interface ListingSummary {
  kind: "event" | "venue";
  eventId: string;
  title?: string;
  startLocal?: string;
  path?: string;
  venueId?: string;
  venueName?: string;
  note?: string;
  tags: string[];
  attendance:
    | "unknown"
    | "interested"
    | "attending"
    | "not-attending"
    | "attended";
  updatedAt: string;
}

/** What the search page needs of one saved search (V1-3). */
export interface SavedSearchSummary {
  id: string;
  name: string;
  url: string;
  filters: unknown;
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
    request: {
      accountId: string;
      memberId: string;
      conversationId: string;
      /** Epoch milliseconds; nothing is stored after it. */
      deadline?: number;
    };
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
          /** How long it may stay still while running (`staleAfterMs`). */
          staleAfterMs: number;
          report: OperationReport;
        };
  };
  /**
   * M9 Path B (ADR 0011): the next step needs another page. Stores a
   * one-shot marker for the sending tab, so only that tab continues the
   * run after it navigates. Refused unless the run is the member's newest
   * and its last stored step is the one before `next`.
   */
  "action.ignoreDelete.handOff": {
    request: {
      accountId: string;
      operationId: string;
      next: ActionStep;
      /** The profile page the tab is about to open; only it may resume. */
      profilePath: string;
    };
    response: { status: "stored" | "refused" };
  };
  /**
   * The sending tab did not reach the profile in time (ADR 0011). Removes
   * the tab's marker when it names this run, and closes the run as not
   * handed off. `none` when there was nothing of this run's to withdraw.
   */
  "action.ignoreDelete.withdraw": {
    request: { accountId: string; operationId: string };
    response: { status: "none" } | { status: "withdrawn"; lines: Message[] };
  };
  /**
   * A new page loaded in the sending tab. A hand-off marker waiting there
   * for another page is removed and its run closed as not handed off, so
   * the profile, visited later in the tab, never continues it. A marker
   * for this very page stays for `pending` to read.
   */
  "action.ignoreDelete.dropStale": {
    request: Record<string, never>;
    response: { status: "none" | "dropped" };
  };
  /**
   * The hand-off marker for the sending tab, if one is waiting. It is
   * removed as it is read, and answered only while the run is still the
   * member's newest, has not moved and is not stale.
   */
  "action.ignoreDelete.pending": {
    request: Record<string, never>;
    response:
      | { status: "none" }
      /** The account changed after Delete; the run was closed as such. */
      | { status: "stopped"; lines: Message[] }
      | {
          status: "ok";
          accountId: string;
          operationId: string;
          memberId: string;
          conversationId: string;
          next: ActionStep;
          steps: ActionLog["steps"];
        };
  };
  /**
   * V1-3: the active account's saved searches. `accountId` is absent when
   * no account is active.
   */
  "search.list": {
    request: Record<string, never>;
    response: { accountId?: string; searches: SavedSearchSummary[] };
  };
  /**
   * Save the search page's current address under a name. `refused` means
   * the account is no longer active; `no-match` that the address is not a
   * verified search address; `full` that the account has the most saved
   * searches allowed.
   */
  "search.save": {
    request: { accountId: string; name: string; url: string };
    response:
      | { status: "saved"; id: string }
      | { status: "refused" | "no-match" | "full" };
  };
  "search.delete": {
    request: { accountId: string; id: string };
    response: { status: "deleted" | "refused" };
  };
  /** V1-5: the user's notes on one event or venue, under the active account. */
  "listing.get": {
    request: { kind: "event" | "venue"; eventId: string };
    response:
      | { status: "no-account" }
      | { status: "ok"; accountId: string; listing: ListingSummary | null };
  };
  /** Every tracked event and venue of the active account, for the list filter. */
  "listing.list": {
    request: Record<string, never>;
    response: { accountId?: string; listings: ListingSummary[] };
  };
  /**
   * Save the user's notes on one listing, with the facts the page shows.
   * `expectedUpdatedAt` is the version the editor was drawn from (`null`:
   * none); a record changed since is not overwritten (`conflict`, with the
   * stored one). Empty notes remove the record (`removed`). `refused` means
   * the account is no longer active.
   */
  "listing.save": {
    request: {
      accountId: string;
      kind: "event" | "venue";
      eventId: string;
      note: string;
      tags: string[];
      attendance: ListingSummary["attendance"];
      facts: {
        title?: string;
        startLocal?: string;
        path?: string;
        venueId?: string;
        venueName?: string;
      };
      expectedUpdatedAt: string | null;
    };
    response:
      | { status: "saved"; listing: ListingSummary }
      | { status: "removed" }
      | { status: "conflict"; listing: ListingSummary | null }
      | { status: "refused" };
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
