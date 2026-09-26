import { AccountService } from "../accounts/account-service";
import type { CachedMessage } from "../domain/types";
import { message, type Message } from "../i18n/message";
import { formatDateTime, t } from "../i18n/translator";
import { MessageCacheService } from "../messages/message-cache-service";
import {
  isMessageRetention,
  MAX_MESSAGE_RETENTION_MONTHS,
  MESSAGE_CACHING_KEY,
  MIN_MESSAGE_RETENTION_MONTHS,
  readMessageSettings,
  type MessageSettings,
} from "../messages/message-settings";
import {
  runtimeSettingsArea,
  type SettingsArea,
} from "../storage/local-settings";

/** The most results drawn at once; the count still names every match. */
export const MAX_SHOWN_RESULTS = 200;

function element<K extends keyof HTMLElementTagNameMap>(
  document: Document,
  tag: K,
  className: string,
  text?: string,
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  node.className = className;
  // Message text is the members' own text and is always set as text.
  if (text !== undefined) node.textContent = text;
  return node;
}

/** The query as a pattern: any spacing, any case. */
function queryPattern(query: string): RegExp | undefined {
  const words = query.trim().split(/\s+/u).filter(Boolean);
  if (words.length === 0) return undefined;
  const escaped = words.map((word) =>
    word.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&"),
  );
  return new RegExp(escaped.join("\\s+"), "giu");
}

/** The text with each match marked, built as nodes, never as markup. */
function markedText(
  document: Document,
  text: string,
  pattern: RegExp | undefined,
): HTMLElement {
  const paragraph = element(document, "p", "joyfox-messages__text");
  if (!pattern) {
    paragraph.textContent = text;
    return paragraph;
  }
  let last = 0;
  for (const match of text.matchAll(pattern)) {
    const start = match.index ?? 0;
    if (match[0].length === 0) continue;
    paragraph.append(text.slice(last, start));
    paragraph.append(element(document, "mark", "", match[0]));
    last = start + match[0].length;
  }
  paragraph.append(text.slice(last));
  return paragraph;
}

/**
 * V1-4, Conversation History Search (PRD 6.2, 13.3; ADR 0016). The switch
 * for message caching, how long messages are kept, and a search over the
 * active account's stored messages. Each stored message can also be seen and
 * deleted under "Your data".
 */
export class MessagesPanel {
  #generation = 0;
  #accountId: string | undefined;
  #query = "";
  #status?: { text: Message; error: boolean };

  constructor(
    private readonly root: HTMLElement,
    private readonly settings: SettingsArea = runtimeSettingsArea,
    private readonly service = new MessageCacheService(settings),
    private readonly accounts = new AccountService(),
  ) {}

  async render(): Promise<void> {
    const generation = (this.#generation += 1);
    let accountId: string | undefined;
    let current: MessageSettings;
    let found: CachedMessage[];
    try {
      accountId = (await this.accounts.getActiveAccount())?.id;
      if (accountId !== this.#accountId) this.#query = "";
      current = await readMessageSettings(this.settings);
      // What the window no longer keeps is gone before anything is shown.
      await this.service.prune();
      found = accountId
        ? (await this.service.search(accountId, this.#query)).messages
        : [];
    } catch {
      if (generation === this.#generation)
        this.root.textContent = t("messages.readFailed");
      return;
    }
    if (generation !== this.#generation) return;
    this.#accountId = accountId;
    this.#draw(accountId, current, found);
  }

  #draw(
    accountId: string | undefined,
    current: MessageSettings,
    found: CachedMessage[],
  ): void {
    const document = this.root.ownerDocument;
    const focused = document.activeElement?.id;
    this.root.replaceChildren();
    const heading = element(
      document,
      "h2",
      "joyfox-panel__heading",
      t("messages.heading"),
    );
    heading.id = "joyfox-messages-heading";
    this.root.setAttribute("aria-labelledby", heading.id);
    this.root.append(
      heading,
      element(document, "p", "joyfox-panel__hint", t("messages.hint")),
      this.#settingsForm(document, current),
    );
    if (this.#status) {
      const status = element(
        document,
        "p",
        "joyfox-panel__status",
        t(this.#status.text),
      );
      status.setAttribute("role", "status");
      if (this.#status.error) status.dataset.kind = "error";
      this.root.append(status);
    }
    if (!accountId) {
      this.root.append(
        element(document, "p", "joyfox-panel__empty", t("messages.noAccount")),
      );
      return;
    }
    this.root.append(this.#searchBox(document));
    const query = this.#query.trim();
    if (query) {
      this.root.append(
        element(
          document,
          "p",
          "joyfox-panel__hint",
          t(
            found.length > MAX_SHOWN_RESULTS
              ? message("messages.countLimited", {
                  count: found.length,
                  shown: MAX_SHOWN_RESULTS,
                })
              : message("messages.count", { count: found.length }),
          ),
        ),
        this.#results(document, found.slice(0, MAX_SHOWN_RESULTS)),
      );
    }
    if (focused) document.getElementById(focused)?.focus();
  }

  #settingsForm(document: Document, current: MessageSettings): HTMLElement {
    const form = element(document, "div", "joyfox-messages__settings");
    const caching = element(document, "input", "");
    caching.type = "checkbox";
    caching.id = "joyfox-messages-caching";
    caching.checked = current.caching;
    const cachingLabel = element(document, "label", "joyfox-messages__switch");
    cachingLabel.htmlFor = caching.id;
    cachingLabel.append(caching, " ", t("messages.caching"));
    caching.addEventListener("change", () => {
      void this.#save(async () => {
        await this.settings.set({ [MESSAGE_CACHING_KEY]: caching.checked });
        return message(
          caching.checked ? "messages.cachingOn" : "messages.cachingOff",
        );
      });
    });

    const retentionLabel = element(
      document,
      "label",
      "",
      t("messages.retentionLabel"),
    );
    const retention = element(document, "input", "joyfox-messages__months");
    retention.type = "number";
    retention.id = "joyfox-messages-retention";
    retention.min = String(MIN_MESSAGE_RETENTION_MONTHS);
    retention.max = String(MAX_MESSAGE_RETENTION_MONTHS);
    retention.value = String(current.retentionMonths);
    retentionLabel.htmlFor = retention.id;
    const save = element(
      document,
      "button",
      "joyfox-messages__save",
      t("messages.retentionSave"),
    );
    save.type = "button";
    save.addEventListener("click", () => {
      const months = Number(retention.value);
      if (!isMessageRetention(months)) {
        this.#status = {
          text: message("messages.retentionInvalid", {
            minimum: MIN_MESSAGE_RETENTION_MONTHS,
            maximum: MAX_MESSAGE_RETENTION_MONTHS,
          }),
          error: true,
        };
        void this.render();
        return;
      }
      void this.#save(async () =>
        message("messages.retentionSaved", {
          deleted: await this.service.setRetention(months),
        }),
      );
    });
    const switchRow = element(document, "p", "joyfox-panel__field");
    switchRow.append(cachingLabel);
    const row = element(document, "p", "joyfox-panel__field");
    row.append(retentionLabel, retention, save);
    form.append(
      switchRow,
      row,
      element(
        document,
        "p",
        "joyfox-panel__hint",
        t(current.caching ? "messages.onHint" : "messages.offHint"),
      ),
    );
    return form;
  }

  async #save(write: () => Promise<Message>): Promise<void> {
    try {
      this.#status = { text: await write(), error: false };
    } catch {
      this.#status = { text: message("common.saveFailed"), error: true };
    }
    await this.render();
  }

  #searchBox(document: Document): HTMLElement {
    const row = element(document, "p", "joyfox-panel__field");
    const label = element(document, "label", "", t("messages.searchLabel"));
    const input = element(document, "input", "joyfox-messages__search");
    input.type = "search";
    input.id = "joyfox-messages-search";
    label.htmlFor = input.id;
    input.value = this.#query;
    input.addEventListener("input", () => {
      // Kept as typed; the search itself ignores case and spacing.
      this.#query = input.value;
      const start = input.selectionStart;
      void this.render().then(() => {
        this.root
          .querySelector<HTMLInputElement>("#joyfox-messages-search")
          ?.setSelectionRange(start, start);
      });
    });
    row.append(label, input);
    return row;
  }

  #results(document: Document, found: CachedMessage[]): HTMLElement {
    const list = element(document, "ol", "joyfox-messages__list");
    const pattern = queryPattern(this.#query);
    for (const item of found) {
      const entry = element(document, "li", "joyfox-messages__item");
      const when = item.sentAt
        ? formatDateTime(item.sentAt)
        : t(
            message("messages.storedAt", {
              when: formatDateTime(item.createdAt),
            }),
          );
      entry.append(
        element(
          document,
          "p",
          "joyfox-messages__meta",
          t(
            message(
              item.direction === "sent"
                ? "messages.sentTo"
                : "messages.receivedFrom",
              { member: item.memberId, when },
            ),
          ),
        ),
        markedText(document, item.text, pattern),
      );
      list.append(entry);
    }
    return list;
  }
}
