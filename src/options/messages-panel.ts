import { AccountService } from "../accounts/account-service";
import type { CachedMessage } from "../domain/types";
import { message, type Message } from "../i18n/message";
import { formatDateTime, t } from "../i18n/translator";
import { MessageCacheService } from "../messages/message-cache-service";
import { nicknamesOf } from "../storage/member-directory";
import { JoyClubMemberRepository } from "../storage/repositories";
import {
  DEFAULT_MESSAGE_RETENTION_MONTHS,
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
import { FOCUS_KEY, rememberFocus, restoreFocus } from "../ui/focus";
import { confirmAllowed, confirmTiming } from "./confirm";
import { StatusLine } from "./status-line";

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
  /** Created once and re-attached on every draw (see `StatusLine`). */
  readonly #status: StatusLine;
  /**
   * A lower number of months that Save armed: it deletes stored messages at
   * once, so it waits for a second click, like every other delete.
   */
  #pendingRetention: number | undefined;
  /** When the lower number was armed, for the confirm grace period. */
  #armedAt = 0;

  constructor(
    private readonly root: HTMLElement,
    private readonly settings: SettingsArea = runtimeSettingsArea,
    private readonly service = new MessageCacheService(settings),
    private readonly accounts = new AccountService(),
    private readonly members = new JoyClubMemberRepository(),
  ) {
    this.#status = new StatusLine(root.ownerDocument);
  }

  /** Nicknames by member ID, for the results of the shown account. */
  #names = new Map<string, string>();

  async render(): Promise<void> {
    const generation = (this.#generation += 1);
    let accountId: string | undefined;
    let current: MessageSettings;
    let found: CachedMessage[];
    let names: Map<string, string>;
    try {
      accountId = (await this.accounts.getActiveAccount())?.id;
      if (accountId !== this.#accountId) this.#query = "";
      current = await readMessageSettings(this.settings);
      // What the window no longer keeps is gone before anything is shown.
      await this.service.prune();
      found = accountId
        ? (await this.service.search(accountId, this.#query)).messages
        : [];
      names = accountId
        ? await nicknamesOf(this.members, accountId)
        : new Map<string, string>();
    } catch {
      if (generation === this.#generation)
        this.root.textContent = t("messages.readFailed");
      return;
    }
    if (generation !== this.#generation) return;
    this.#accountId = accountId;
    this.#names = names;
    this.#draw(accountId, current, found);
  }

  #draw(
    accountId: string | undefined,
    current: MessageSettings,
    found: CachedMessage[],
  ): void {
    const document = this.root.ownerDocument;
    const focus = rememberFocus(this.root);
    // A number typed and not saved yet stays in the field.
    const field = this.root.querySelector<HTMLInputElement>(
      "#joyfox-messages-retention",
    );
    const typed =
      field && field.value !== field.defaultValue ? field.value : undefined;
    this.root.replaceChildren();
    const heading = element(
      document,
      "h2",
      "joyfox-panel__heading",
      t("messages.heading"),
    );
    heading.id = "joyfox-messages-heading";
    this.root.setAttribute("aria-labelledby", heading.id);
    this.#status.redraw();
    this.root.append(
      heading,
      element(document, "p", "joyfox-panel__hint", t("messages.hint")),
      this.#settingsForm(document, current, typed),
      this.#status.node,
    );
    if (!accountId) {
      this.root.append(
        element(document, "p", "joyfox-panel__empty", t("messages.noAccount")),
      );
      restoreFocus(this.root, focus);
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
    restoreFocus(this.root, focus);
  }

  #settingsForm(
    document: Document,
    current: MessageSettings,
    typed: string | undefined,
  ): HTMLElement {
    const form = element(document, "div", "joyfox-messages__settings");
    const caching = element(document, "input", "");
    caching.type = "checkbox";
    caching.id = "joyfox-messages-caching";
    caching.setAttribute(FOCUS_KEY, "caching");
    caching.checked = current.caching;
    const cachingLabel = element(document, "label", "joyfox-messages__switch");
    cachingLabel.htmlFor = caching.id;
    cachingLabel.append(caching, " ", t("messages.caching"));
    caching.addEventListener("change", () => {
      // Any other action disarms a lower number, at once.
      this.#pendingRetention = undefined;
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
    retention.setAttribute(FOCUS_KEY, "retention");
    retention.min = String(MIN_MESSAGE_RETENTION_MONTHS);
    retention.max = String(MAX_MESSAGE_RETENTION_MONTHS);
    // The stored number is the default value, so a later draw can tell
    // whether the user changed the field.
    retention.defaultValue = String(current.retentionMonths);
    const pending = this.#pendingRetention;
    retention.value =
      pending !== undefined
        ? String(pending)
        : (typed ?? retention.defaultValue);
    retentionLabel.htmlFor = retention.id;
    const retentionHint = element(
      document,
      "p",
      "joyfox-panel__hint",
      t(
        message("messages.retentionHint", {
          default: DEFAULT_MESSAGE_RETENTION_MONTHS,
        }),
      ),
    );
    retentionHint.id = "joyfox-messages-retention-hint";
    retention.setAttribute("aria-describedby", retentionHint.id);
    // Whether this node was drawn armed, fixed at draw time: a click on a
    // node drawn unarmed can only arm, never delete.
    const armed = pending !== undefined;
    const save = element(
      document,
      "button",
      "joyfox-messages__save",
      t(armed ? "messages.retentionConfirm" : "messages.retentionSave"),
    );
    save.type = "button";
    save.setAttribute(FOCUS_KEY, "retention-save");
    retention.addEventListener("input", () => {
      // Another number: the armed one no longer applies.
      if (this.#pendingRetention === undefined) return;
      this.#pendingRetention = undefined;
      save.textContent = t("messages.retentionSave");
      this.#status.clear();
    });
    save.addEventListener("click", (event) => {
      const months = Number(retention.value);
      if (!isMessageRetention(months)) {
        this.#pendingRetention = undefined;
        this.#status.set(
          message("messages.retentionInvalid", {
            minimum: MIN_MESSAGE_RETENTION_MONTHS,
            maximum: MAX_MESSAGE_RETENTION_MONTHS,
          }),
          "error",
        );
        void this.render();
        return;
      }
      if (armed && this.#pendingRetention === months) {
        if (!confirmAllowed(event, this.#armedAt)) return;
      } else if (months < current.retentionMonths) {
        // A lower number deletes older messages at once: arm first, and
        // say what the second click deletes.
        if (event.detail > 1) return;
        this.#pendingRetention = months;
        this.#armedAt = confirmTiming.now();
        this.#status.set(
          message("messages.retentionConfirmPrompt", { months }),
          "info",
        );
        void this.render();
        return;
      }
      this.#pendingRetention = undefined;
      void this.#save(async () =>
        message("messages.retentionSaved", {
          deleted: await this.service.setRetention(months),
        }),
      );
    });
    const switchRow = element(document, "p", "joyfox-panel__field");
    switchRow.append(cachingLabel);
    form.append(switchRow);
    if (!current.caching)
      form.append(
        element(document, "p", "joyfox-panel__hint", t("messages.offHint")),
      );
    const row = element(document, "p", "joyfox-panel__field");
    row.append(retentionLabel, retention, save);
    form.append(row, retentionHint);
    return form;
  }

  async #save(write: () => Promise<Message>): Promise<void> {
    try {
      this.#status.set(await write(), "info");
    } catch {
      this.#status.set(message("common.saveFailed"), "error");
    }
    await this.render();
  }

  #searchBox(document: Document): HTMLElement {
    const row = element(document, "p", "joyfox-panel__field");
    const label = element(document, "label", "", t("messages.searchLabel"));
    const input = element(document, "input", "joyfox-messages__search");
    input.type = "search";
    input.id = "joyfox-messages-search";
    input.setAttribute(FOCUS_KEY, "search");
    label.htmlFor = input.id;
    input.value = this.#query;
    input.addEventListener("input", () => {
      // Kept as typed; the search itself ignores case and spacing.
      this.#query = input.value;
      // A new search: the last save's result and an armed lower number no
      // longer apply.
      this.#pendingRetention = undefined;
      this.#status.clear();
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
              {
                member:
                  this.#names.get(item.memberId) ??
                  t(message("member.number", { id: item.memberId })),
                when,
              },
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
