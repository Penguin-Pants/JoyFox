import { isStrictIsoDate } from "../domain/iso-date";
import type {
  CacheAnswer,
  MessageCacheService,
  SeenMessage,
} from "../messages/message-cache-service";
import {
  CONVERSATION_ID_PATTERN,
  MAX_MESSAGE_TEXT_LENGTH,
  MESSAGE_ID_PATTERN,
} from "../messages/message-settings";
import type { MessageRouter } from "../messaging/router";
import type { SettingsArea } from "../storage/local-settings";
import { bumpMessageRevision } from "../storage/message-revision";
import { invalid, lockedWrite, memberId } from "./handler-guards";

/** The most messages one request may carry. */
export const MAX_MESSAGES_PER_REQUEST = 100;

export interface MessageHandlerDeps {
  messages: MessageCacheService;
  /** The active account's ID, or `undefined` when none is selected. */
  activeAccountId: () => Promise<string | undefined>;
  /** Where the message revision is set; `storage.local` by default. */
  settings?: SettingsArea;
}

function seenMessages(value: unknown): SeenMessage[] {
  if (!Array.isArray(value) || value.length > MAX_MESSAGES_PER_REQUEST)
    throw invalid("message list");
  return value.map((item: unknown) => {
    const entry = (item ?? {}) as Record<string, unknown>;
    const { messageId, direction, sentAt, text } = entry;
    if (typeof messageId !== "string" || !MESSAGE_ID_PATTERN.test(messageId))
      throw invalid("message ID");
    if (direction !== "sent" && direction !== "received")
      throw invalid("message direction");
    if (
      sentAt !== undefined &&
      (typeof sentAt !== "string" || !isStrictIsoDate(sentAt))
    )
      throw invalid("message time");
    if (
      typeof text !== "string" ||
      text.trim().length === 0 ||
      text.length > MAX_MESSAGE_TEXT_LENGTH
    )
      throw invalid("message text");
    return { messageId, direction, text, ...(sentAt ? { sentAt } : {}) };
  });
}

/**
 * V1-4: the write that stores what a conversation page showed. Every field
 * comes from a content script, so each is checked here first. The write
 * names the account that was active when the page was read and does nothing
 * unless that account is still active: a request queued before an account
 * switch never lands in the new account.
 */
export function registerMessageHandlers(
  router: MessageRouter,
  deps: MessageHandlerDeps,
): void {
  // The window also applies while no conversation is opened: each start of
  // the background deletes what has expired since (and announces it).
  void deps.messages.prune().catch(() => undefined);
  router.register("messages.cache", async (payload) => {
    const conversationId = payload?.conversationId;
    if (
      typeof conversationId !== "string" ||
      !CONVERSATION_ID_PATTERN.test(conversationId)
    )
      throw invalid("conversation ID");
    const member = memberId(payload?.memberId);
    if (!conversationId.split("-").slice(1).includes(member))
      throw invalid("member ID");
    const messages = seenMessages(payload?.messages);
    const answer = await lockedWrite<CacheAnswer | { status: "refused" }>(
      deps,
      payload?.accountId,
      { status: "refused" },
      (accountId) =>
        deps.messages.store(accountId, conversationId, member, messages),
    );
    // Open options pages show the new messages in search. The purge window
    // announces its own deletions.
    if (answer.status === "stored" && answer.stored > 0)
      await bumpMessageRevision(deps.settings).catch(() => undefined);
    return answer;
  });
}
