import type { ExtractionResult } from "../domain/types";
export type { ExtractionResult } from "../domain/types";

export function missing<T>(source?: string): ExtractionResult<T> {
  return source === undefined
    ? { status: "missing" }
    : { status: "missing", source };
}
