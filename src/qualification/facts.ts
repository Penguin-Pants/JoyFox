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

export const UNKNOWN_FACTS: ProfileFacts = {
  verification: "unknown",
  photoCount: "unknown",
  profileWordCount: "unknown",
  joinedAt: "unknown",
};

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
    if (fresh !== undefined && fresh !== "unknown") {
      facts[field] = fresh as never;
      sources[field] = "observed";
      continue;
    }
    const stored = cached?.[field];
    if (stored !== undefined && stored !== "unknown") {
      facts[field] = stored as never;
      sources[field] = "cached";
    }
  }
  return { facts, sources };
}

/**
 * The newest snapshot by capture time. Ties break on ID so the choice is
 * deterministic rather than dependent on storage order.
 */
export function newestSnapshot(
  snapshots: readonly ProfileSnapshot[],
): ProfileSnapshot | undefined {
  return [...snapshots].sort(
    (a, b) =>
      b.capturedAt.localeCompare(a.capturedAt) || b.id.localeCompare(a.id),
  )[0];
}
