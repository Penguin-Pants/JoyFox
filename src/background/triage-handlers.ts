import type { TriagePlacement } from "../domain/types";
import { ExtensionError } from "../errors";
import type { MessageRouter } from "../messaging/router";
import { withAccountLock } from "../storage/account-lock";
import type { ProfileFacts } from "../qualification/facts";
import {
  isMemberId,
  MAX_MEMBERS_PER_REQUEST,
  type TriageRequestMember,
  type TriageService,
} from "../triage/triage-service";
import type { TrustOutcomeKind, TrustService } from "../trust/trust-service";

export interface TriageHandlerDeps {
  triage: TriageService;
  trust: TrustService;
  /** The active account's ID, or `undefined` when none is selected. */
  activeAccountId: () => Promise<string | undefined>;
  openOptions: () => Promise<void>;
}

const PLACEMENTS: readonly TriagePlacement[] = [
  "qualified",
  "needs-review",
  "quarantined",
];
const OUTCOMES: readonly TrustOutcomeKind[] = [
  "positive",
  "negative",
  "neutral",
];

const invalid = (what: string) =>
  new ExtensionError("ExtractionInvalid", `Invalid ${what}`);

function memberId(value: unknown): string {
  if (!isMemberId(value)) throw invalid("member ID");
  return value;
}

/** Only an object passes; the fact merge then drops unusable values. */
function observed(value: unknown): Partial<ProfileFacts> {
  if (value === undefined) return {};
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw invalid("observed facts");
  return value as Partial<ProfileFacts>;
}

function members(value: unknown): TriageRequestMember[] {
  if (!Array.isArray(value) || value.length > MAX_MEMBERS_PER_REQUEST)
    throw invalid("member list");
  return value.map((item: unknown) => {
    const entry = (item ?? {}) as Record<string, unknown>;
    return {
      memberId: memberId(entry.memberId),
      observed: observed(entry.observed),
    };
  });
}

/**
 * The account a write may use: the active one, and only if it is the account
 * the page's data came from. A write sent or queued before an account switch
 * is dropped instead of landing in the newly active account.
 */
async function writeAccount(
  deps: TriageHandlerDeps,
  expected: unknown,
): Promise<string | undefined> {
  if (typeof expected !== "string" || expected.length === 0)
    throw invalid("account");
  const active = await deps.activeAccountId();
  return active === expected ? active : undefined;
}

/**
 * Run a write under the account lock, checking inside the lock that the
 * account is still the active one (and so still exists). A removal or
 * another context's write to the same account cannot interleave with it.
 */
async function lockedWrite<T>(
  deps: TriageHandlerDeps,
  expected: unknown,
  refused: T,
  write: (accountId: string) => Promise<T>,
): Promise<T> {
  if (typeof expected !== "string" || expected.length === 0)
    throw invalid("account");
  return withAccountLock(expected, async () => {
    const accountId = await writeAccount(deps, expected);
    return accountId ? write(accountId) : refused;
  });
}

/**
 * Register the triage, trust and snapshot handlers. Every payload comes from a
 * content script, so each field is checked here before a service sees it.
 * A write carries the account its data came from and does nothing unless
 * that account is still active, rather than guess a scope.
 */
export function registerTriageHandlers(
  router: MessageRouter,
  deps: TriageHandlerDeps,
): void {
  router.register("triage.evaluate", async (payload) =>
    deps.triage.evaluate(
      await deps.activeAccountId(),
      members(payload?.members),
    ),
  );
  router.register("triage.setOverride", async (payload) => {
    const id = memberId(payload?.memberId);
    const placement = payload?.placement;
    if (placement !== null && !PLACEMENTS.includes(placement))
      throw invalid("placement");
    return lockedWrite<{ done: boolean }>(
      deps,
      payload?.accountId,
      { done: false },
      async (accountId) => {
        await deps.triage.setOverride(accountId, id, placement);
        return { done: true };
      },
    );
  });
  router.register("trust.log", async (payload) => {
    const id = memberId(payload?.memberId);
    if (!OUTCOMES.includes(payload?.kind)) throw invalid("outcome");
    const kind = payload.kind;
    return lockedWrite<{ done: boolean }>(
      deps,
      payload?.accountId,
      { done: false },
      async (accountId) => {
        await deps.trust.logOutcome(accountId, id, kind);
        return { done: true };
      },
    );
  });
  router.register("trust.get", async (payload) =>
    deps.triage.trustFor(
      await deps.activeAccountId(),
      memberId(payload?.memberId),
      observed(payload?.observed),
    ),
  );
  router.register("trust.undo", async (payload) => {
    const id = memberId(payload?.memberId);
    return lockedWrite<{ removed: boolean }>(
      deps,
      payload?.accountId,
      { removed: false },
      async (accountId) => ({
        removed: await deps.trust.undoLastOutcome(accountId, id),
      }),
    );
  });
  router.register("snapshot.capture", async (payload) => {
    const id = memberId(payload?.memberId);
    const facts = observed(payload?.observed);
    return lockedWrite<{ stored: boolean }>(
      deps,
      payload?.accountId,
      { stored: false },
      async (accountId) => ({
        stored: await deps.triage.captureSnapshot(accountId, id, facts),
      }),
    );
  });
  router.register("options.open", async () => {
    await deps.openOptions();
    return { done: true };
  });
}
