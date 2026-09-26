import type { CachedMessage } from "../domain/types";
import type { SettingsArea } from "../storage/local-settings";
import { CachedMessageRepository } from "../storage/repositories";
import {
  isMessageRetention,
  MESSAGE_RETENTION_KEY,
  messageTime,
  readMessageSettings,
  retentionCutoff,
} from "./message-settings";

/** One message as a conversation page shows it. */
export interface SeenMessage {
  messageId: string;
  direction: CachedMessage["direction"];
  sentAt?: string;
  text: string;
}

export type CacheAnswer =
  /** `deleted`: messages the purge window removed in the same request. */
  { status: "stored"; stored: number; deleted: number } | { status: "off" };

export interface SearchResult {
  /** Every match, newest first. */
  messages: CachedMessage[];
}

/** Case and spacing do not matter to a search. */
const searchable = (text: string) =>
  text.replace(/\s+/gu, " ").trim().toLocaleLowerCase("de");

/**
 * V1-4, Conversation History Search (PRD 6.2, 13.3; ADR 0016). Stores the
 * messages a conversation page showed while caching is on, keeps them inside
 * the purge window and finds the ones that contain a query. Writes come
 * through the background, which holds the account's lock, so this service
 * takes no lock itself.
 */
export class MessageCacheService {
  constructor(
    private readonly settings: SettingsArea,
    private readonly messages = new CachedMessageRepository(),
    private readonly now: () => Date = () => new Date(),
  ) {}

  async store(
    accountId: string,
    conversationId: string,
    memberId: string,
    seen: readonly SeenMessage[],
  ): Promise<CacheAnswer> {
    const { caching, retentionMonths } = await readMessageSettings(
      this.settings,
    );
    if (!caching) return { status: "off" };
    const now = this.now();
    const timestamp = now.toISOString();
    const cutoff = Date.parse(retentionCutoff(now, retentionMonths));
    let stored = 0;
    for (const message of seen) {
      // A message older than the window is not stored at all.
      if (message.sentAt && Date.parse(message.sentAt) < cutoff) continue;
      const id = `message:${message.messageId}`;
      const existing = await this.messages.get(accountId, id);
      // A message belongs to one conversation. One already stored under
      // another is never moved: while JoyClub switches conversations, the
      // old list can still be on screen under the new address.
      if (existing && existing.conversationId !== conversationId) continue;
      if (
        existing &&
        existing.text === message.text &&
        existing.sentAt === message.sentAt
      )
        continue;
      await this.messages.put(accountId, {
        id,
        accountId,
        messageId: message.messageId,
        conversationId,
        memberId,
        direction: message.direction,
        ...(message.sentAt ? { sentAt: message.sentAt } : {}),
        text: message.text,
        createdAt: existing?.createdAt ?? timestamp,
        updatedAt: timestamp,
      });
      stored += 1;
    }
    // Every accepted request applies the window, also when nothing new was
    // stored: a reload after the cutoff moved must still delete old text.
    const deleted = await this.prune();
    return { status: "stored", stored, deleted };
  }

  /**
   * Every stored message of the account that contains the query, newest
   * first. Case and spacing do not matter. An empty query finds nothing.
   */
  async search(accountId: string, query: string): Promise<SearchResult> {
    const needle = searchable(query);
    if (!needle) return { messages: [] };
    const all = await this.messages.list(accountId);
    return {
      messages: all
        .filter((message) => searchable(message.text).includes(needle))
        // By instant, not by text: ISO dates with an offset or another
        // precision do not sort as strings.
        .sort(
          (a, b) =>
            Date.parse(messageTime(b)) - Date.parse(messageTime(a)) ||
            a.id.localeCompare(b.id),
        ),
    };
  }

  /** Deletes every message older than the window now in effect. */
  async prune(): Promise<number> {
    const { retentionMonths } = await readMessageSettings(this.settings);
    return this.messages.pruneOlderThan(
      retentionCutoff(this.now(), retentionMonths),
    );
  }

  /** Saves the window, then deletes what is older at once. */
  async setRetention(months: number): Promise<number> {
    if (!isMessageRetention(months))
      throw new RangeError("Invalid message retention");
    await this.settings.set({ [MESSAGE_RETENTION_KEY]: months });
    return this.prune();
  }
}
