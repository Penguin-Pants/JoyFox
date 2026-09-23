/**
 * One lock per account, shared by every extension context: the background
 * and all options tabs. Every write to an account's data, and the account's
 * removal, runs while holding it. So a write can never interleave with
 * another write to the same account from another tab, and a write that was
 * accepted just before a removal either finishes before the removal starts
 * or, when it gets the lock after it, finds the account gone and does
 * nothing.
 *
 * Uses the Web Locks API (Firefox 96 and later; the floor is 121). Where it
 * is missing, as in the unit-test environment, a per-account queue inside
 * this context stands in. The lock is not reentrant: code holding it must
 * not ask for it again.
 */
const fallback = new Map<string, Promise<unknown>>();

export function accountLockName(accountId: string): string {
  return `joyfox:account:${encodeURIComponent(accountId)}`;
}

export function withAccountLock<T>(
  accountId: string,
  action: () => Promise<T>,
): Promise<T> {
  const locks = (
    globalThis.navigator as
      | { locks?: { request?: LockManager["request"] } }
      | undefined
  )?.locks;
  const name = accountLockName(accountId);
  if (locks?.request) return locks.request(name, () => action()) as Promise<T>;
  const previous = fallback.get(name) ?? Promise.resolve();
  const run = previous.then(action, action);
  const settled = run.catch(() => undefined);
  fallback.set(name, settled);
  void settled.then(() => {
    if (fallback.get(name) === settled) fallback.delete(name);
  });
  return run;
}
