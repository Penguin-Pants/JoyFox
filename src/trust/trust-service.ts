import type { TrustSignal } from "../domain/types";
import { ExtensionError } from "../errors";
import {
  runtimeSettingsArea,
  type SettingsArea,
} from "../storage/local-settings";
import { registerMember } from "../storage/member-directory";
import {
  JoyClubMemberRepository,
  TrustSignalRepository,
} from "../storage/repositories";
import { bumpTriageRevision } from "../storage/triage-revision";

export type TrustOutcomeKind = TrustSignal["kind"];

function requireAccountId(accountId: string): void {
  if (accountId.trim().length === 0)
    throw new ExtensionError(
      "IdentityMismatch",
      "A trust outcome needs an explicit active account",
    );
}

/** Newest first by instant, ties on ID, so "undo" always removes the same one. */
const newestFirst = (a: TrustSignal, b: TrustSignal) =>
  Date.parse(b.occurredAt) - Date.parse(a.occurredAt) ||
  b.id.localeCompare(a.id);

/**
 * Logs the user's own interaction outcomes (M6). Every write bumps the triage
 * revision, so an open page shows the new score at once, which is M6's
 * acceptance criterion.
 */
export class TrustService {
  constructor(
    private readonly signals = new TrustSignalRepository(),
    private readonly members = new JoyClubMemberRepository(),
    private readonly settings: SettingsArea = runtimeSettingsArea,
    private readonly now: () => string = () => new Date().toISOString(),
    private readonly newId: () => string = () => crypto.randomUUID(),
  ) {}

  async listSignals(
    accountId: string,
    memberId: string,
  ): Promise<TrustSignal[]> {
    requireAccountId(accountId);
    const all = await this.signals.list(accountId);
    return all
      .filter((signal) => signal.memberId === memberId)
      .sort(newestFirst);
  }

  async logOutcome(
    accountId: string,
    memberId: string,
    kind: TrustOutcomeKind,
  ): Promise<TrustSignal> {
    requireAccountId(accountId);
    const timestamp = this.now();
    const signal: TrustSignal = {
      id: `trust:${this.newId()}`,
      accountId,
      memberId,
      kind,
      occurredAt: timestamp,
      createdAt: timestamp,
      updatedAt: timestamp,
    };
    await registerMember(this.members, accountId, memberId, timestamp);
    await this.signals.put(accountId, signal);
    await bumpTriageRevision(this.settings);
    return signal;
  }

  /** Removes the newest outcome for the member. Returns whether one existed. */
  async undoLastOutcome(accountId: string, memberId: string): Promise<boolean> {
    const [latest] = await this.listSignals(accountId, memberId);
    if (!latest) return false;
    await this.signals.delete(accountId, latest.id);
    await bumpTriageRevision(this.settings);
    return true;
  }
}
