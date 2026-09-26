import type { SavedSearch } from "../domain/types";
import { SavedSearchRepository } from "../storage/repositories";
import {
  MAX_SAVED_SEARCH_NAME_LENGTH,
  MAX_SAVED_SEARCHES,
  normalizeSearchName,
  readSearchAddress,
} from "./saved-search";

export type SaveSearchResult =
  | { status: "saved"; search: SavedSearch }
  | { status: "no-match" | "full" | "invalid-name" };

/** Name, then ID: a stable order for the list on the search page. */
export function compareSearches(a: SavedSearch, b: SavedSearch): number {
  return a.name.localeCompare(b.name) || a.id.localeCompare(b.id);
}

/**
 * V1-3: the user's saved member searches, per account. Writes come from the
 * search page through the background, which holds the account's lock and
 * checks that the account is still active before it calls `save` or
 * `delete`. So these methods take no lock themselves (locks are not
 * reentrant, `account-lock.ts`).
 */
export class SavedSearchService {
  constructor(
    private readonly searches = new SavedSearchRepository(),
    private readonly now: () => string = () => new Date().toISOString(),
    private readonly newId: () => string = () =>
      `search:${crypto.randomUUID()}`,
  ) {}

  async list(accountId: string): Promise<SavedSearch[]> {
    return (await this.searches.list(accountId)).sort(compareSearches);
  }

  async save(
    accountId: string,
    input: { name: string; url: string },
  ): Promise<SaveSearchResult> {
    const name = normalizeSearchName(input.name);
    if (name.length === 0 || name.length > MAX_SAVED_SEARCH_NAME_LENGTH)
      return { status: "invalid-name" };
    const address = readSearchAddress(input.url);
    if (address.status !== "ok") return { status: "no-match" };
    if ((await this.searches.list(accountId)).length >= MAX_SAVED_SEARCHES)
      return { status: "full" };
    const timestamp = this.now();
    const search: SavedSearch = {
      id: this.newId(),
      accountId,
      name,
      url: address.url,
      filters: address.filters,
      createdAt: timestamp,
      updatedAt: timestamp,
    };
    await this.searches.put(accountId, search);
    return { status: "saved", search };
  }

  async delete(accountId: string, id: string): Promise<void> {
    await this.searches.delete(accountId, id);
  }
}
