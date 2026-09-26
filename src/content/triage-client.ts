import type { TriagePlacement } from "../domain/types";
import type {
  ExtensionMessage,
  ExtensionResponse,
} from "../messaging/protocol";
import { request, type MessageSender } from "../messaging/request";
import type { ProfileFacts } from "../qualification/facts";
import type {
  ProfileCaptureExtras,
  TriageRequestMember,
  TriageResponse,
  TrustResponse,
} from "../triage/triage-service";
import type { TrustOutcomeKind } from "../trust/trust-service";

/**
 * Everything the page features ask of the background. Content scripts run in
 * the page's origin, so the extension database is reachable only through
 * messages. Tests supply their own implementation.
 *
 * Writes name the account the page's data came from, taken from the last
 * answer. The background ignores a write whose account is no longer active.
 */
export interface TriageClient {
  evaluate(members: TriageRequestMember[]): Promise<TriageResponse>;
  setOverride(
    accountId: string,
    memberId: string,
    placement: TriagePlacement | null,
  ): Promise<void>;
  getTrust(
    memberId: string,
    observed: Partial<ProfileFacts>,
  ): Promise<TrustResponse>;
  logTrust(
    accountId: string,
    memberId: string,
    kind: TrustOutcomeKind,
  ): Promise<void>;
  undoTrust(accountId: string, memberId: string): Promise<void>;
  captureSnapshot(
    accountId: string,
    memberId: string,
    observed: Partial<ProfileFacts>,
    extras?: ProfileCaptureExtras,
  ): Promise<void>;
  openOptions(): Promise<void>;
}

export function messageTriageClient(sender: MessageSender): TriageClient {
  return {
    evaluate: (members) => request(sender, "triage.evaluate", { members }),
    async setOverride(accountId, memberId, placement) {
      await request(sender, "triage.setOverride", {
        accountId,
        memberId,
        placement,
      });
    },
    getTrust: (memberId, observed) =>
      request(sender, "trust.get", { memberId, observed }),
    async logTrust(accountId, memberId, kind) {
      await request(sender, "trust.log", { accountId, memberId, kind });
    },
    async undoTrust(accountId, memberId) {
      await request(sender, "trust.undo", { accountId, memberId });
    },
    async captureSnapshot(accountId, memberId, observed, extras = {}) {
      await request(sender, "snapshot.capture", {
        accountId,
        memberId,
        observed,
        ...extras,
      });
    },
    async openOptions() {
      await request(sender, "options.open", {});
    },
  };
}

export function runtimeTriageClient(): TriageClient {
  return messageTriageClient(
    (message: ExtensionMessage) =>
      browser.runtime.sendMessage(message) as Promise<ExtensionResponse>,
  );
}
