/**
 * One lock per account, shared by every extension context: the background
 * and all options tabs. Every write to an account's data, and the account's
 * removal, runs while holding it. So a write can never interleave with
 * another write to the same account from another tab, and a write that was
 * accepted just before a removal either finishes before the removal starts
 * or, when it gets the lock after it, finds the account gone and does
 * nothing.
 *
 * Every account lock also holds one global data lock in shared mode.
 * "Delete all JoyFox data" takes that lock exclusively, so it waits for
 * every write in progress, in any scope, and no write starts until it ends.
 *
 * Uses the Web Locks API (Firefox 96 and later; the floor is 121). Where it
 * is missing, as in the unit-test environment, queues inside this context
 * stand in. Locks are not reentrant: code holding an account lock must not
 * ask for it again, and code holding the exclusive lock must not ask for
 * any account lock.
 */
const fallback = new Map<string, Promise<unknown>>();

/** Settles when the newest exclusive holder of the fallback is done. */
let fallbackExclusive: Promise<unknown> = Promise.resolve();
const fallbackShared = new Set<Promise<unknown>>();

export const DATA_LOCK_NAME = "joyfox:data";

export function accountLockName(accountId: string): string {
  return `joyfox:account:${encodeURIComponent(accountId)}`;
}

function webLocks(): LockManager["request"] | undefined {
  const locks = (
    globalThis.navigator as
      | { locks?: { request?: LockManager["request"] } }
      | undefined
  )?.locks;
  return locks?.request?.bind(locks);
}

function withSharedDataLock<T>(action: () => Promise<T>): Promise<T> {
  const request = webLocks();
  if (request)
    return request(DATA_LOCK_NAME, { mode: "shared" }, () =>
      action(),
    ) as Promise<T>;
  const run = fallbackExclusive.then(() => action());
  const settled = run.catch(() => undefined);
  fallbackShared.add(settled);
  void settled.then(() => fallbackShared.delete(settled));
  return run;
}

/**
 * Run an action no write can overlap: it waits for every account-locked
 * write in progress, and holds back every new one until it ends.
 */
export function withExclusiveDataLock<T>(action: () => Promise<T>): Promise<T> {
  const request = webLocks();
  if (request) return request(DATA_LOCK_NAME, () => action()) as Promise<T>;
  const prior = Promise.all([fallbackExclusive, ...fallbackShared]);
  const run = prior.then(() => action());
  fallbackExclusive = run.catch(() => undefined);
  return run;
}

/** The per-account lock alone, without the shared data lock. */
function accountOnly<T>(
  accountId: string,
  action: () => Promise<T>,
): Promise<T> {
  const request = webLocks();
  const name = accountLockName(accountId);
  if (request) return request(name, () => action()) as Promise<T>;
  const previous = fallback.get(name) ?? Promise.resolve();
  const run = previous.then(action, action);
  const settled = run.catch(() => undefined);
  fallback.set(name, settled);
  void settled.then(() => {
    if (fallback.get(name) === settled) fallback.delete(name);
  });
  return run;
}

export function withAccountLock<T>(
  accountId: string,
  action: () => Promise<T>,
): Promise<T> {
  return withSharedDataLock(() => accountOnly(accountId, action));
}

/**
 * Hold the locks of several accounts at once, for an action that spans them
 * (an account switch). Locks are taken in one fixed order, so two such
 * actions cannot each hold a lock the other waits for. The shared data lock
 * is taken once: a second shared request queued behind a waiting exclusive
 * one would never be granted.
 */
export function withAccountLocks<T>(
  accountIds: readonly string[],
  action: () => Promise<T>,
): Promise<T> {
  const ordered = [...new Set(accountIds)].sort();
  const acquire = (index: number): Promise<T> =>
    index === ordered.length
      ? action()
      : accountOnly(ordered[index]!, () => acquire(index + 1));
  return withSharedDataLock(() => acquire(0));
}
