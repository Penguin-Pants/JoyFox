import type { TriagePlacement } from "../domain/types";
import type {
  ExtensionMessage,
  ExtensionResponse,
} from "../messaging/protocol";
import { request, type MessageSender } from "../messaging/request";
import type { ProfileFacts } from "../qualification/facts";
import type {
  TriageRequestMember,
  TriageResponse,
  TrustResponse,
} from "../triage/triage-service";
import type { TrustOutcomeKind } from "../trust/trust-service";

/**
 * Everything the page features ask of the background. Content scripts run in
 * the page's origin, so the extension database is reachable only through
 * messages. Tests supply their own implementation.
 */
export interface TriageClient {
  evaluate(members: TriageRequestMember[]): Promise<TriageResponse>;
  setOverride(
    memberId: string,
    placement: TriagePlacement | null,
  ): Promise<void>;
  getTrust(
    memberId: string,
    observed: Partial<ProfileFacts>,
  ): Promise<TrustResponse>;
  logTrust(memberId: string, kind: TrustOutcomeKind): Promise<void>;
  undoTrust(memberId: string): Promise<void>;
  captureSnapshot(
    memberId: string,
    observed: Partial<ProfileFacts>,
  ): Promise<void>;
  openOptions(): Promise<void>;
}

export function messageTriageClient(sender: MessageSender): TriageClient {
  return {
    evaluate: (members) => request(sender, "triage.evaluate", { members }),
    async setOverride(memberId, placement) {
      await request(sender, "triage.setOverride", { memberId, placement });
    },
    getTrust: (memberId, observed) =>
      request(sender, "trust.get", { memberId, observed }),
    async logTrust(memberId, kind) {
      await request(sender, "trust.log", { memberId, kind });
    },
    async undoTrust(memberId) {
      await request(sender, "trust.undo", { memberId });
    },
    async captureSnapshot(memberId, observed) {
      await request(sender, "snapshot.capture", { memberId, observed });
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
