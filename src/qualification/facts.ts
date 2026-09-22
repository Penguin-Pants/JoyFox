import { newestCaptureFirst } from "../domain/snapshot-order";
import type { ProfileSnapshot } from "../domain/types";

/**
 * The profile facts qualification reads. Every field is explicitly `unknown`
 * when it was not observed, never a negative value standing in for absence.
 */
export interface ProfileFacts {
  verification: boolean | "unknown";
  photoCount: number | "unknown";
  profileWordCount: number | "unknown";
  joinedAt: string | "unknown";
}

/** Frozen, because callers spread it as a starting point and must not change it. */
export const UNKNOWN_FACTS: Readonly<ProfileFacts> = Object.freeze({
  verification: "unknown",
  photoCount: "unknown",
  profileWordCount: "unknown",
  joinedAt: "unknown",
});

const ISO_DATE =
  /^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2})(?::(\d{2})(?:\.\d{1,9})?)?(?:Z|[+-](\d{2}):(\d{2})))?$/;

/**
 * Accept only an ISO 8601 date or date-time with a real calendar date and
 * clock time. `Date.parse` alone repairs `2026-02-30` to 2 March and accepts
 * trailing text, which would turn an extraction error into a known fact.
 */
export function isStrictIsoDate(value: string): boolean {
  const match = ISO_DATE.exec(value);
  if (!match) return false;
  const [, y, m, d, hh, mm, ss, oh, om] = match;
  const year = Number(y);
  const month = Number(m);
  const day = Number(d);
  const calendar = new Date(Date.UTC(year, month - 1, day));
  if (
    calendar.getUTCFullYear() !== year ||
    calendar.getUTCMonth() !== month - 1 ||
    calendar.getUTCDate() !== day
  )
    return false;
  if (hh !== undefined && (Number(hh) > 23 || Number(mm) > 59)) return false;
  if (ss !== undefined && Number(ss) > 59) return false;
  if (oh !== undefined && (Number(oh) > 23 || Number(om) > 59)) return false;
  return Number.isFinite(Date.parse(value));
}

/**
 * A safe non-negative integer only: above `Number.MAX_SAFE_INTEGER` the value
 * may already be rounded, so it cannot be trusted as a count.
 */
const isCount = (value: unknown): value is number =>
  typeof value === "number" && Number.isSafeInteger(value) && value >= 0;

/**
 * Whether a value is usable for its field. A value of the wrong shape is an
 * extraction problem, so it is treated as not observed rather than guessed.
 */
function isUsable(field: keyof ProfileFacts, value: unknown): boolean {
  switch (field) {
    case "verification":
      return typeof value === "boolean";
    case "photoCount":
    case "profileWordCount":
      return isCount(value);
    case "joinedAt":
      return typeof value === "string" && isStrictIsoDate(value);
  }
}

/** Where each merged fact came from, so an explanation can name its source. */
export type FactSource = "observed" | "cached" | "none";

export interface MergedFacts {
  facts: ProfileFacts;
  sources: Record<keyof ProfileFacts, FactSource>;
}

/**
 * Merge what the current surface rendered with the newest cached snapshot.
 * A value observed now wins, because it is the fresher reading of the same
 * profile. A cached value fills a field the current surface did not render,
 * which is the whole reason snapshots are kept: the build plan forbids opening
 * a profile just to complete a score.
 */
export function mergeProfileFacts(
  observed: Partial<ProfileFacts>,
  cached?: Pick<ProfileSnapshot, keyof ProfileFacts>,
): MergedFacts {
  const facts = { ...UNKNOWN_FACTS };
  const sources: Record<keyof ProfileFacts, FactSource> = {
    verification: "none",
    photoCount: "none",
    profileWordCount: "none",
    joinedAt: "none",
  };
  for (const field of Object.keys(UNKNOWN_FACTS) as Array<keyof ProfileFacts>) {
    const fresh = observed[field];
    if (isUsable(field, fresh)) {
      facts[field] = fresh as never;
      sources[field] = "observed";
      continue;
    }
    const stored = cached?.[field];
    if (isUsable(field, stored)) {
      facts[field] = stored as never;
      sources[field] = "cached";
    }
  }
  return { facts, sources };
}

/**
 * The newest snapshot by capture instant. Ties break on ID so the choice is
 * deterministic rather than dependent on storage order.
 */
export function newestSnapshot(
  snapshots: readonly ProfileSnapshot[],
): ProfileSnapshot | undefined {
  return [...snapshots].sort(newestCaptureFirst)[0];
}
