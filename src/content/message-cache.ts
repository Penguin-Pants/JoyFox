import { extractConversation } from "../extraction/joyclub";
import { readConversationMessages } from "../extraction/messages";
import type { SeenMessage } from "../messages/message-cache-service";
import type {
  ExtensionMessage,
  ExtensionResponse,
  MessageContract,
} from "../messaging/protocol";
import { request, type MessageSender } from "../messaging/request";

type CacheRequest = MessageContract["messages.cache"]["request"];
type CacheResponse = MessageContract["messages.cache"]["response"];

export interface MessageCacheClient {
  cache(payload: CacheRequest): Promise<CacheResponse>;
}

export function messageCacheClient(sender: MessageSender): MessageCacheClient {
  return { cache: (payload) => request(sender, "messages.cache", payload) };
}

export function runtimeMessageCacheClient(): MessageCacheClient {
  return messageCacheClient(
    (message: ExtensionMessage) =>
      browser.runtime.sendMessage(message) as Promise<ExtensionResponse>,
  );
}

/** The most messages one request carries (the background's limit). */
const BATCH = 100;

const version = (message: SeenMessage) =>
  JSON.stringify([message.text, message.sentAt ?? ""]);

/**
 * V1-4: sends the messages an open conversation shows to the background,
 * which stores them for Conversation History Search while message caching is
 * on. It only reads what the page already shows: it never scrolls, never
 * loads older messages and sends nothing to JoyClub. Nothing is logged.
 */
export class MessageCache {
  /** What was sent per message ID, so an unchanged message is not sent again. */
  #sent = new Map<string, string>();
  /** The conversation each message ID was first seen in. */
  #conversation = new Map<string, string>();
  #queue: Promise<void> = Promise.resolve();
  /**
   * Set after a send that stored nothing; cleared by the next page, account
   * or switch change, so a refusing background is not asked on every page
   * mutation.
   */
  #failed = false;
  #lastUrl = "";

  constructor(
    private readonly document: Document,
    private readonly client: MessageCacheClient,
    /** The account active now, as `storage.local` holds it. */
    private readonly activeAccount: () => string | undefined,
  ) {}

  /** A conversation page changed; `enabled` is the caching switch. */
  update(enabled: boolean): void {
    if (!enabled) return;
    const url = this.document.URL;
    if (url !== this.#lastUrl) {
      this.#lastUrl = url;
      this.#failed = false;
    }
    if (this.#failed) return;
    // Read with the page, so a request queued before an account switch
    // names the account it was read for, and the background refuses it.
    const accountId = this.activeAccount();
    if (!accountId) return;
    const page = extractConversation(this.document, url);
    // The header must belong to the address, so the list is this
    // conversation's and not the one just left (09-navigation.md).
    if (
      page.conversationId.status !== "found" ||
      page.memberId.status !== "found"
    )
      return;
    const conversationId = page.conversationId.value;
    const memberId = page.memberId.value;
    const fresh: SeenMessage[] = [];
    for (const message of readConversationMessages(this.document)) {
      const owner = this.#conversation.get(message.messageId);
      // A message ID seen in another conversation is still that one's list
      // on screen while JoyClub switches: never file it under this one.
      if (owner && owner !== conversationId) continue;
      this.#conversation.set(message.messageId, conversationId);
      if (this.#sent.get(message.messageId) === version(message)) continue;
      this.#sent.set(message.messageId, version(message));
      fresh.push(message);
    }
    for (let start = 0; start < fresh.length; start += BATCH) {
      const batch = fresh.slice(start, start + BATCH);
      this.#queue = this.#queue.then(() =>
        this.client
          .cache({ accountId, conversationId, memberId, messages: batch })
          .then((answer) => {
            // Caching off, or the account changed: stop until that
            // changes, then send these again.
            if (answer.status === "stored") return;
            this.#forget(batch);
            this.#failed = true;
          })
          .catch(() => {
            this.#forget(batch);
            this.#failed = true;
          }),
      );
    }
  }

  /** The account or the switch changed: send what the page shows again. */
  reset(): void {
    this.#sent.clear();
    this.#failed = false;
  }

  #forget(batch: readonly SeenMessage[]): void {
    for (const message of batch) this.#sent.delete(message.messageId);
  }
}
