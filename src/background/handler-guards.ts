import { ExtensionError } from "../errors";
import { withAccountLock } from "../storage/account-lock";
import { isMemberId } from "../triage/triage-service";

/**
 * Checks shared by the background handlers. Every payload comes from a
 * content script, so each field is checked before a service sees it, and a
 * write names the account its data came from.
 */
export interface ActiveAccountSource {
  /** The active account's ID, or `undefined` when none is selected. */
  activeAccountId: () => Promise<string | undefined>;
}

export const invalid = (what: string) =>
  new ExtensionError("ExtractionInvalid", `Invalid ${what}`);

export function memberId(value: unknown): string {
  if (!isMemberId(value)) throw invalid("member ID");
  return value;
}

/**
 * The account a write may use: the active one, and only if it is the account
 * the page's data came from. A write sent or queued before an account switch
 * is dropped instead of landing in the newly active account.
 */
async function writeAccount(
  deps: ActiveAccountSource,
  expected: string,
): Promise<string | undefined> {
  const active = await deps.activeAccountId();
  return active === expected ? active : undefined;
}

/**
 * Run a write under the account lock, checking inside the lock that the
 * account is still the active one (and so still exists). A removal or
 * another context's write to the same account cannot interleave with it.
 */
export async function lockedWrite<T>(
  deps: ActiveAccountSource,
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
