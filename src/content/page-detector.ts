import type { ExtractionResult } from "../domain/types";
import {
  selectorRegistry,
  VERIFIED_HOSTS,
  type PageType,
} from "../selectors/registry";

type KnownPage = Exclude<PageType, "unknown">;

/**
 * Checked in this order. The inbox and conversation views are client-side
 * routes of one app (09-navigation.md), so the inbox list can stay in the DOM
 * while a conversation is open. The URL decides, and the root element only
 * confirms that the page has rendered.
 */
const DETECTION_ORDER: readonly KnownPage[] = [
  "conversation",
  "inbox",
  "profile",
  "search",
];

/**
 * Identify the current page from verified definitions only. A URL that
 * matches but whose root has not rendered yet is `missing`, so a caller waits
 * for the next navigation event instead of reading a half-built page.
 */
export function detectPage(
  url: string = location.href,
  root: ParentNode = document,
): ExtractionResult<PageType> {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return { status: "invalid", source: "location", reason: "Unparseable URL" };
  }
  if (!VERIFIED_HOSTS.includes(parsed.hostname))
    return { status: "missing", source: "host-unverified" };
  for (const page of DETECTION_ORDER) {
    const definition = selectorRegistry[page];
    if (definition.status !== "verified" || !definition.path) continue;
    if (!new RegExp(definition.path).test(parsed.pathname)) continue;
    if (definition.root && !root.querySelector(definition.root))
      return { status: "missing", source: `${page}:root-not-rendered` };
    return { status: "found", value: page, source: `${page}:path+root` };
  }
  return { status: "missing", source: "no-verified-page-matched" };
}
