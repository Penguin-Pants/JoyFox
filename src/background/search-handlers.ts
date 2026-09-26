import type { MessageContract } from "../messaging/protocol";
import type { MessageRouter } from "../messaging/router";
import {
  MAX_SAVED_SEARCH_NAME_LENGTH,
  MAX_SAVED_SEARCH_URL_LENGTH,
  normalizeSearchName,
} from "../search/saved-search";
import type { SavedSearchService } from "../search/saved-search-service";
import type { SettingsArea } from "../storage/local-settings";
import { bumpSavedSearchRevision } from "../storage/saved-search-revision";
import {
  invalid,
  lockedWrite,
  type ActiveAccountSource,
} from "./handler-guards";

export interface SearchHandlerDeps extends ActiveAccountSource {
  searches: SavedSearchService;
  /** Where the saved-search revision is set; `storage.local` by default. */
  settings?: SettingsArea;
}

type SaveAnswer = MessageContract["search.save"]["response"];
type DeleteAnswer = MessageContract["search.delete"]["response"];

function searchName(value: unknown): string {
  if (typeof value !== "string") throw invalid("search name");
  const name = normalizeSearchName(value);
  if (name.length === 0 || name.length > MAX_SAVED_SEARCH_NAME_LENGTH)
    throw invalid("search name");
  return name;
}

function searchUrl(value: unknown): string {
  if (typeof value !== "string" || value.length > MAX_SAVED_SEARCH_URL_LENGTH)
    throw invalid("search address");
  return value;
}

/**
 * Any stored ID: records this build saves start with `search:`, but an
 * imported record may carry any non-empty ID (the import checks no more),
 * and it must stay deletable.
 */
function searchId(value: unknown): string {
  if (typeof value !== "string" || value.length === 0)
    throw invalid("saved search");
  return value;
}

/**
 * Register the V1-3 saved-search handlers for the search page. The list
 * uses the active account; every write names the account its page was
 * drawn for and runs under that account's lock, and is refused if it is
 * no longer active.
 */
export function registerSearchHandlers(
  router: MessageRouter,
  deps: SearchHandlerDeps,
): void {
  router.register("search.list", async () => {
    const accountId = await deps.activeAccountId();
    if (!accountId) return { searches: [] };
    const searches = await deps.searches.list(accountId);
    return {
      accountId,
      searches: searches.map(({ id, name, url, filters }) => ({
        id,
        name,
        url,
        filters,
      })),
    };
  });
  // Set after a committed write only, so other open search pages reload.
  const changed = () => bumpSavedSearchRevision(deps.settings);
  router.register("search.save", async (payload) => {
    const name = searchName(payload?.name);
    const url = searchUrl(payload?.url);
    const answer = await lockedWrite<SaveAnswer>(
      deps,
      payload?.accountId,
      { status: "refused" },
      async (accountId) => {
        const result = await deps.searches.save(accountId, { name, url });
        if (result.status === "saved")
          return { status: "saved", id: result.search.id };
        // The name was checked above, so only these two remain.
        return { status: result.status === "full" ? "full" : "no-match" };
      },
    );
    if (answer.status === "saved") await changed();
    return answer;
  });
  router.register("search.delete", async (payload) => {
    const id = searchId(payload?.id);
    const answer = await lockedWrite<DeleteAnswer>(
      deps,
      payload?.accountId,
      { status: "refused" },
      async (accountId) => {
        await deps.searches.delete(accountId, id);
        return { status: "deleted" };
      },
    );
    if (answer.status === "deleted") await changed();
    return answer;
  });
}
