import { message, type Message } from "../i18n/message";
import { t } from "../i18n/translator";
import type {
  ExtensionMessage,
  ExtensionResponse,
  MessageContract,
  SavedSearchSummary,
} from "../messaging/protocol";
import { request, type MessageSender } from "../messaging/request";
import {
  MAX_SAVED_SEARCH_NAME_LENGTH,
  MAX_SAVED_SEARCHES,
  normalizeSearchName,
  readSearchAddress,
  replayAddress,
} from "../search/saved-search";
import { verifiedSelector } from "../selectors/registry";
import { button, element, UI_ATTRIBUTE } from "./triage-ui";

export type SaveSearchAnswer = MessageContract["search.save"]["response"];
export type DeleteSearchAnswer = MessageContract["search.delete"]["response"];
export type SearchList = MessageContract["search.list"]["response"];

/**
 * What the saved-search bar asks of the background. Content scripts run in
 * the page's origin, so saved searches are reachable only through
 * messages. Tests supply their own implementation.
 */
export interface SavedSearchClient {
  list(): Promise<SearchList>;
  save(accountId: string, name: string, url: string): Promise<SaveSearchAnswer>;
  remove(accountId: string, id: string): Promise<DeleteSearchAnswer>;
  openOptions(): Promise<void>;
}

export function messageSavedSearchClient(
  sender: MessageSender,
): SavedSearchClient {
  return {
    list: () => request(sender, "search.list", {}),
    save: (accountId, name, url) =>
      request(sender, "search.save", { accountId, name, url }),
    remove: (accountId, id) =>
      request(sender, "search.delete", { accountId, id }),
    async openOptions() {
      await request(sender, "options.open", {});
    },
  };
}

export function runtimeSavedSearchClient(): SavedSearchClient {
  return messageSavedSearchClient(
    (message: ExtensionMessage) =>
      browser.runtime.sendMessage(message) as Promise<ExtensionResponse>,
  );
}

const NAME_INPUT = "joyfox-saved-searches__name";

/**
 * V1-3: saved searches on JoyClub's member search page (PRD 6.2, 8.2). The
 * bar sits above the result list. "Save this search" stores the page's
 * current address, which holds every filter (11-search.md), under a name;
 * a saved search's button opens that address again in one click. An
 * address that no longer matches JoyClub's verified search address is
 * never opened: the bar says so instead.
 *
 * The bar only reads the page's address. It never reads a result, a
 * member or a filter control, and it never changes JoyClub's filters.
 */
export class SavedSearchBar {
  #root?: HTMLElement;
  #data?: SearchList;
  /**
   * Bumped on teardown and on an account switch, so a late answer for the
   * page or account shown before is dropped.
   */
  #session = 0;
  /** Bumped on every load, so only the newest list is drawn. */
  #loadSequence = 0;
  #status?: { text: Message; error: boolean };
  /** The name box is open, and what was typed in it. */
  #naming = false;
  #draft = "";
  /** The saved search whose ✕ was clicked once; a second click deletes. */
  #armed?: string;
  /**
   * A save or delete is on its way. A second Enter, double click or ✕
   * meanwhile is ignored, so one action never stores or deletes twice.
   */
  #busy = false;

  constructor(
    private readonly document: Document,
    private readonly client: SavedSearchClient,
    private readonly navigate: (url: string) => void = (url) =>
      document.location.assign(url),
    private readonly currentUrl: () => string = () => document.location.href,
  ) {}

  /** Place the bar above the result list, again after JoyClub redraws it. */
  update(): void {
    const selector = verifiedSelector("search", "resultList");
    const list = selector ? this.document.querySelector(selector) : null;
    if (!list) return this.leave();
    if (this.#root?.isConnected) return;
    if (!this.#root) {
      this.#root = element(this.document, "section", "joyfox-saved-searches");
      this.#root.setAttribute(UI_ATTRIBUTE, "saved-searches");
      this.#draw();
      void this.#load();
    }
    list.before(this.#root);
  }

  leave(): void {
    this.#session += 1;
    this.#root?.remove();
    this.#root = undefined;
    this.#data = undefined;
    this.#status = undefined;
    this.#naming = false;
    this.#draft = "";
    this.#armed = undefined;
  }

  /** Another account's searches must never stay on screen after a switch. */
  accountChanged(): void {
    this.#session += 1;
    if (!this.#root) return;
    this.#data = undefined;
    this.#status = undefined;
    this.#naming = false;
    this.#draft = "";
    this.#armed = undefined;
    this.#draw();
    void this.#load();
  }

  /** A search saved or deleted in another tab, or data deleted. */
  invalidate(): void {
    if (this.#root) void this.#load();
  }

  localeChanged(): void {
    if (this.#root) this.#draw();
  }

  async #load(): Promise<void> {
    const session = this.#session;
    const sequence = (this.#loadSequence += 1);
    const current = () =>
      session === this.#session && sequence === this.#loadSequence;
    let answer: SearchList;
    try {
      answer = await this.client.list();
    } catch {
      if (!current()) return;
      this.#status = { text: message("searches.readFailed"), error: true };
      this.#draw();
      return;
    }
    if (!current()) return;
    this.#data = answer;
    // A read failure is over once a read works; other notices stay.
    if (this.#status?.text.key === "searches.readFailed")
      this.#status = undefined;
    // A search deleted elsewhere cannot stay armed for deletion.
    if (!answer.searches.some((search) => search.id === this.#armed))
      this.#armed = undefined;
    this.#draw();
  }

  #draw(): void {
    const root = this.#root;
    if (!root) return;
    const document = this.document;
    const focusedName =
      document.activeElement?.classList.contains(NAME_INPUT) ?? false;
    root.replaceChildren();
    root.setAttribute("aria-label", t("searches.heading"));
    root.append(
      element(
        document,
        "p",
        "joyfox-saved-searches__heading",
        t("searches.heading"),
      ),
    );
    const data = this.#data;
    if (!data) {
      if (!this.#status)
        root.append(
          element(document, "p", "joyfox-note", t("searches.loading")),
        );
    } else if (!data.accountId) {
      root.append(
        element(document, "p", "joyfox-note", t("searches.noAccount")),
        button(
          document,
          "joyfox-button",
          t("common.openOptions"),
          () => void this.client.openOptions().catch(() => undefined),
        ),
      );
    } else {
      root.append(this.#list(data.searches));
      root.append(this.#saveRow(focusedName));
    }
    const status = element(document, "p", "joyfox-saved-searches__status");
    status.setAttribute("role", "status");
    status.setAttribute("aria-live", "polite");
    if (this.#status) {
      status.textContent = t(this.#status.text);
      status.classList.toggle("joyfox-error", this.#status.error);
    }
    root.append(status);
  }

  #list(searches: readonly SavedSearchSummary[]): HTMLElement {
    const document = this.document;
    if (searches.length === 0)
      return element(document, "p", "joyfox-note", t("searches.empty"));
    const list = element(document, "ul", "joyfox-saved-searches__list");
    for (const search of searches) {
      const item = element(document, "li", "joyfox-saved-searches__item");
      const open = button(
        document,
        "joyfox-button joyfox-saved-searches__open",
        search.name,
        () => this.#open(search),
      );
      const remove = button(
        document,
        "joyfox-button joyfox-saved-searches__delete",
        "✕",
        () => void this.#remove(search),
      );
      const label = t(message("searches.deleteLabel", { name: search.name }));
      remove.setAttribute("aria-label", label);
      remove.title = label;
      if (this.#armed === search.id)
        remove.setAttribute("aria-pressed", "true");
      item.append(open, remove);
      list.append(item);
    }
    return list;
  }

  #saveRow(focusName: boolean): HTMLElement {
    const document = this.document;
    const row = element(document, "div", "joyfox-saved-searches__save");
    if (!this.#naming) {
      row.append(
        button(document, "joyfox-button", t("searches.save"), () => {
          this.#naming = true;
          this.#status = undefined;
          this.#draw();
          this.#root
            ?.querySelector<HTMLInputElement>(`.${NAME_INPUT}`)
            ?.focus();
        }),
      );
      return row;
    }
    const input = element(document, "input", NAME_INPUT);
    input.type = "text";
    input.maxLength = MAX_SAVED_SEARCH_NAME_LENGTH;
    input.autocomplete = "off";
    input.value = this.#draft;
    input.setAttribute("aria-label", t("searches.nameLabel"));
    input.placeholder = t("searches.nameLabel");
    input.addEventListener("input", () => {
      this.#draft = input.value;
    });
    // Keys typed here are JoyFox's: JoyClub's page shortcuts must not see
    // them, and Enter must not submit anything of JoyClub's.
    input.addEventListener("keydown", (event) => {
      event.stopPropagation();
      if (event.key === "Enter") {
        event.preventDefault();
        void this.#save();
      } else if (event.key === "Escape") {
        event.preventDefault();
        this.#cancel();
      }
    });
    row.append(
      input,
      button(document, "joyfox-button", t("searches.confirmSave"), () => {
        void this.#save();
      }),
      button(document, "joyfox-button", t("searches.cancel"), () =>
        this.#cancel(),
      ),
    );
    if (focusName) queueMicrotask(() => input.focus());
    return row;
  }

  #cancel(): void {
    this.#naming = false;
    this.#draft = "";
    this.#draw();
  }

  #setStatus(text: Message, error: boolean): void {
    this.#status = { text, error };
    this.#draw();
  }

  #open(search: SavedSearchSummary): void {
    this.#armed = undefined;
    const url = replayAddress(search);
    if (!url)
      return this.#setStatus(
        message("searches.noMatch", { name: search.name }),
        true,
      );
    this.navigate(url);
  }

  async #save(): Promise<void> {
    if (this.#busy) return;
    const accountId = this.#data?.accountId;
    if (!accountId) return;
    const name = normalizeSearchName(this.#draft);
    if (name.length === 0)
      return this.#setStatus(message("searches.noName"), true);
    if (name.length > MAX_SAVED_SEARCH_NAME_LENGTH)
      return this.#setStatus(
        message("searches.nameTooLong", {
          maximum: MAX_SAVED_SEARCH_NAME_LENGTH,
        }),
        true,
      );
    const address = readSearchAddress(this.currentUrl());
    if (address.status !== "ok")
      return this.#setStatus(message("searches.notSearchAddress"), true);
    const session = this.#session;
    let answer: SaveSearchAnswer;
    this.#busy = true;
    try {
      answer = await this.client.save(accountId, name, address.url);
    } catch {
      if (session === this.#session)
        this.#setStatus(message("common.saveFailed"), true);
      return;
    } finally {
      this.#busy = false;
    }
    if (session !== this.#session) return;
    if (answer.status === "saved") {
      this.#naming = false;
      this.#draft = "";
      this.#status = {
        text: message("searches.saved", { name }),
        error: false,
      };
      void this.#load();
      return;
    }
    this.#setStatus(
      answer.status === "full"
        ? message("searches.full", { maximum: MAX_SAVED_SEARCHES })
        : answer.status === "no-match"
          ? message("searches.notSearchAddress")
          : message("searches.refused"),
      true,
    );
  }

  async #remove(search: SavedSearchSummary): Promise<void> {
    if (this.#busy) return;
    const accountId = this.#data?.accountId;
    if (!accountId) return;
    if (this.#armed !== search.id) {
      this.#armed = search.id;
      return this.#setStatus(
        message("searches.confirmDelete", { name: search.name }),
        false,
      );
    }
    this.#armed = undefined;
    const session = this.#session;
    let answer: DeleteSearchAnswer;
    this.#busy = true;
    try {
      answer = await this.client.remove(accountId, search.id);
    } catch {
      if (session === this.#session)
        this.#setStatus(message("common.saveFailed"), true);
      return;
    } finally {
      this.#busy = false;
    }
    if (session !== this.#session) return;
    if (answer.status === "deleted") {
      this.#status = {
        text: message("searches.deleted", { name: search.name }),
        error: false,
      };
      void this.#load();
      return;
    }
    this.#setStatus(message("searches.refused"), true);
  }
}
