import type { ExtractionResult } from "../domain/types";
import type { PageType } from "../selectors/registry";

export function detectPage(): ExtractionResult<PageType> {
  return { status: "missing", source: "selector-registry-unverified" };
}
