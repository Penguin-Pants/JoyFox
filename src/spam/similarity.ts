/**
 * The similarity engine sits behind this interface so a future classifier can
 * replace it without the detector or triage changing, as the build plan
 * requires. An implementation must be deterministic and local: no network, no
 * model, no hidden state.
 */
export interface SimilarityEngine {
  readonly name: string;
  /** 0 for unrelated, 1 for identical. Inputs are already normalized. */
  score(a: string, b: string): number;
}

const SHINGLE_SIZE = 3;

function shingles(value: string): Map<string, number> {
  const counts = new Map<string, number>();
  for (let index = 0; index + SHINGLE_SIZE <= value.length; index += 1) {
    const shingle = value.slice(index, index + SHINGLE_SIZE);
    counts.set(shingle, (counts.get(shingle) ?? 0) + 1);
  }
  return counts;
}

/**
 * Dice coefficient over character trigrams. Chosen because it is cheap, needs
 * no training data, and rates a lightly edited copy of a template highly while
 * rating unrelated text near zero. Strings shorter than one trigram cannot be
 * shingled, so they compare by equality instead.
 */
export class TrigramDiceSimilarity implements SimilarityEngine {
  readonly name = "trigram-dice";
  score(a: string, b: string): number {
    if (a === b) return 1;
    if (a.length < SHINGLE_SIZE || b.length < SHINGLE_SIZE) return 0;
    const left = shingles(a);
    const right = shingles(b);
    let shared = 0;
    let leftTotal = 0;
    for (const [shingle, count] of left) {
      leftTotal += count;
      shared += Math.min(count, right.get(shingle) ?? 0);
    }
    let rightTotal = 0;
    for (const count of right.values()) rightTotal += count;
    return leftTotal + rightTotal === 0
      ? 0
      : (2 * shared) / (leftTotal + rightTotal);
  }
}

export const defaultSimilarityEngine: SimilarityEngine =
  new TrigramDiceSimilarity();
