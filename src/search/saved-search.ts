import { selectorRegistry, VERIFIED_HOSTS } from "../selectors/registry";

/**
 * Storage guards chosen by this implementation, like the template limits.
 * They are not values observed from JoyClub.
 */
export const MAX_SAVED_SEARCH_NAME_LENGTH = 80;
export const MAX_SAVED_SEARCHES = 50;
export const MAX_SAVED_SEARCH_URL_LENGTH = 2000;

/**
 * A search's filters as its address holds them (11-search.md): the path
 * segments after `/member/` (place and sought genders) and every query
 * parameter, in order. Stored beside the URL, so a replay can check that
 * the address still carries the same filters.
 */
export interface SearchFilters {
  path: string[];
  query: Array<[string, string]>;
}

export type SearchAddress =
  | { status: "ok"; url: string; filters: SearchFilters }
  | { status: "no-match" };

const NO_MATCH = { status: "no-match" } as const;

function decode(segment: string): string {
  try {
    return decodeURIComponent(segment);
  } catch {
    return segment;
  }
}

/**
 * Read a member search address, or `no-match` when it is not one JoyFox has
 * verified: a JoyClub host from the evidence, HTTPS, and the search path
 * of the selector registry. A JoyClub change to its search address makes
 * the registry change with it, so an older saved address stops matching.
 */
export function readSearchAddress(url: string): SearchAddress {
  const definition = selectorRegistry.search;
  if (
    definition.status !== "verified" ||
    !definition.path ||
    url.length > MAX_SAVED_SEARCH_URL_LENGTH
  )
    return NO_MATCH;
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return NO_MATCH;
  }
  if (
    parsed.protocol !== "https:" ||
    parsed.username !== "" ||
    parsed.password !== "" ||
    parsed.port !== "" ||
    !VERIFIED_HOSTS.includes(parsed.hostname) ||
    !new RegExp(definition.path).test(parsed.pathname)
  )
    return NO_MATCH;
  return {
    status: "ok",
    url: parsed.href,
    filters: {
      path: parsed.pathname
        .split("/")
        .slice(2)
        .filter((segment) => segment.length > 0)
        .map(decode),
      query: queryPairs(parsed.searchParams),
    },
  };
}

/** Every query parameter, in order, repeated names included. */
function queryPairs(params: URLSearchParams): Array<[string, string]> {
  const pairs: Array<[string, string]> = [];
  params.forEach((value, name) => pairs.push([name, value]));
  return pairs;
}

function isFilters(value: unknown): value is SearchFilters {
  if (typeof value !== "object" || value === null) return false;
  const { path, query } = value as Partial<SearchFilters>;
  return (
    Array.isArray(path) &&
    path.every((segment) => typeof segment === "string") &&
    Array.isArray(query) &&
    query.every(
      (pair) =>
        Array.isArray(pair) &&
        pair.length === 2 &&
        typeof pair[0] === "string" &&
        typeof pair[1] === "string",
    )
  );
}

function sameFilters(a: SearchFilters, b: SearchFilters): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

/**
 * The address to open for a saved search, or `undefined` when it no longer
 * matches JoyClub's verified search address, or no longer carries the
 * filters stored with it (an edited or imported record). Nothing is opened
 * then (V1-3).
 */
export function replayAddress(saved: {
  url: string;
  filters: unknown;
}): string | undefined {
  const address = readSearchAddress(saved.url);
  if (address.status !== "ok" || !isFilters(saved.filters)) return undefined;
  return sameFilters(address.filters, saved.filters) ? address.url : undefined;
}

/** Collapse runs of white space, as template names do. */
export const normalizeSearchName = (name: string) =>
  name.trim().replace(/\s+/gu, " ");
