import type { MessageRouter } from "../messaging/router";
import type { ProfileFacts } from "../qualification/facts";
import {
  MAX_SIGNAL_MEMBERS,
  type SignalRequest,
  type SignalsService,
} from "../signals/signals-service";
import { invalid, memberId } from "./handler-guards";

export interface SignalsHandlerDeps {
  signals: SignalsService;
  /** The active account's ID, or `undefined` when none is selected. */
  activeAccountId: () => Promise<string | undefined>;
}

/** Only an object passes; the fact merge then drops unusable values. */
function observed(value: unknown): Partial<ProfileFacts> {
  if (value === undefined) return {};
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw invalid("observed facts");
  return value as Partial<ProfileFacts>;
}

/** V1-10: a read only; notes and tags are written through `note.*`. */
export function registerSignalsHandlers(
  router: MessageRouter,
  deps: SignalsHandlerDeps,
): void {
  router.register("signals.lookup", async (payload) => {
    const list: unknown = payload?.members;
    if (!Array.isArray(list) || list.length > MAX_SIGNAL_MEMBERS)
      throw invalid("member list");
    const members: SignalRequest[] = list.map((item: unknown) => {
      const entry = (item ?? {}) as Record<string, unknown>;
      return {
        memberId: memberId(entry.memberId),
        observed: observed(entry.observed),
      };
    });
    const accountId = await deps.activeAccountId();
    if (!accountId) return { status: "no-account" as const };
    return {
      status: "ok" as const,
      accountId,
      signals: await deps.signals.lookup(accountId, members),
    };
  });
}
