import type { CompatibilityService } from "../compatibility/compatibility-service";
import { MAX_COMPATIBILITY_MEMBERS } from "../compatibility/limits";
import type { MessageRouter } from "../messaging/router";
import { invalid, memberId } from "./handler-guards";

export interface CompatibilityHandlerDeps {
  compatibility: CompatibilityService;
  /** The active account's ID, or `undefined` when none is selected. */
  activeAccountId: () => Promise<string | undefined>;
}

/** V1-2: a read only; the preferences are stored with snapshot captures. */
export function registerCompatibilityHandlers(
  router: MessageRouter,
  deps: CompatibilityHandlerDeps,
): void {
  router.register("compat.lookup", async (payload) => {
    const ids: unknown = payload?.memberIds;
    if (!Array.isArray(ids) || ids.length > MAX_COMPATIBILITY_MEMBERS)
      throw invalid("member list");
    const requested = ids.map(memberId);
    const accountId = await deps.activeAccountId();
    if (!accountId) return { status: "no-account" as const };
    return {
      status: "ok" as const,
      ...(await deps.compatibility.lookup(accountId, requested)),
    };
  });
}
