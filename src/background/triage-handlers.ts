import type { TriagePlacement } from "../domain/types";
import type { MessageRouter } from "../messaging/router";
import type { ProfileFacts } from "../qualification/facts";
import { MAX_PREVIEW_LENGTH } from "../rules/message-phrase";
import {
  MAX_PREFERENCE_LABEL_LENGTH,
  MAX_PREFERENCE_TAGS,
  normalizeLabel,
} from "../extraction/preferences";
import {
  MAX_MEMBERS_PER_REQUEST,
  type ProfileCaptureExtras,
  type TriageRequestMember,
  type TriageService,
} from "../triage/triage-service";
import type { TrustOutcomeKind, TrustService } from "../trust/trust-service";
import { invalid, lockedWrite, memberId } from "./handler-guards";

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

/** Only an object passes; the fact merge then drops unusable values. */
function observed(value: unknown): Partial<ProfileFacts> {
  if (value === undefined) return {};
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw invalid("observed facts");
  return value as Partial<ProfileFacts>;
}

/** A message preview is a bounded string, or left out. */
function preview(value: unknown): { preview?: string } {
  if (value === undefined) return {};
  if (typeof value !== "string" || value.length > MAX_PREVIEW_LENGTH)
    throw invalid("message preview");
  return { preview: value };
}

/**
 * V1-2: the positive preference labels a profile page showed, each a
 * bounded, non-empty label; stored normalized, sorted and unique.
 */
function captureExtras(
  preferences: unknown,
  ownProfile: unknown,
): ProfileCaptureExtras {
  if (ownProfile !== undefined && typeof ownProfile !== "boolean")
    throw invalid("own profile flag");
  const extras: ProfileCaptureExtras = ownProfile ? { ownProfile: true } : {};
  if (preferences === undefined) return extras;
  if (
    !Array.isArray(preferences) ||
    preferences.length > MAX_PREFERENCE_TAGS ||
    preferences.some(
      (label) =>
        typeof label !== "string" ||
        normalizeLabel(label).length === 0 ||
        label.length > MAX_PREFERENCE_LABEL_LENGTH,
    )
  )
    throw invalid("preferences");
  return {
    ...extras,
    preferences: [
      ...new Set((preferences as string[]).map(normalizeLabel)),
    ].sort(),
  };
}

function members(value: unknown): TriageRequestMember[] {
  if (!Array.isArray(value) || value.length > MAX_MEMBERS_PER_REQUEST)
    throw invalid("member list");
  return value.map((item: unknown) => {
    const entry = (item ?? {}) as Record<string, unknown>;
    return {
      memberId: memberId(entry.memberId),
      observed: observed(entry.observed),
      ...preview(entry.preview),
    };
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
  router.register("triage.evaluate", async (payload) => {
    const requested = members(payload?.members);
    const accountId = await deps.activeAccountId();
    // Store the phrase matches the previews show first, under the account
    // lock, so the answer and every other tab agree. A failed write must
    // not stop triage: the previews on screen still decide this answer.
    if (accountId && requested.some((member) => member.preview !== undefined))
      await lockedWrite(deps, accountId, 0, (id) =>
        deps.triage.recordPhraseMatches(id, requested),
      ).catch(() => 0);
    return deps.triage.evaluate(await deps.activeAccountId(), requested);
  });
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
    const extras = captureExtras(payload?.preferences, payload?.ownProfile);
    return lockedWrite<{ stored: boolean }>(
      deps,
      payload?.accountId,
      { stored: false },
      async (accountId) => ({
        stored: await deps.triage.captureSnapshot(accountId, id, facts, extras),
      }),
    );
  });
  router.register("options.open", async () => {
    await deps.openOptions();
    return { done: true };
  });
}
