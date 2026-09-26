import { isStrictIsoDate } from "../domain/iso-date";
import {
  MAX_MESSAGE_TEXT_LENGTH,
  MESSAGE_ID_PATTERN,
} from "../messages/message-settings";
import type { SeenMessage } from "../messages/message-cache-service";
import { verifiedSelector } from "../selectors/registry";

/**
 * The text a message bubble shows (12-messages.md): its text nodes, with a
 * line break for each `br`. Spaces collapse as the page shows them.
 */
function bubbleText(content: Element): string {
  let text = "";
  const walk = (node: Node) => {
    for (const child of Array.from(node.childNodes)) {
      if (child.nodeType === 3)
        text += (child.textContent ?? "").replace(/\s+/gu, " ");
      else if (child.nodeName === "BR") text += "\n";
      else walk(child);
    }
  };
  walk(content);
  return text
    .split("\n")
    .map((line) => line.trim())
    .join("\n")
    .trim()
    .slice(0, MAX_MESSAGE_TEXT_LENGTH);
}

/** The send time in the bubble's shadow root, when it can be read. */
function sentTime(item: Element): string | undefined {
  const bubbleSelector = verifiedSelector("conversation", "messageBubble");
  const timeSelector = verifiedSelector("conversation", "messageTime");
  if (!bubbleSelector || !timeSelector) return undefined;
  const bubble = item.querySelector(bubbleSelector) as
    | (Element & { openOrClosedShadowRoot?: ShadowRoot | null })
    | null;
  const shadow = bubble?.openOrClosedShadowRoot ?? bubble?.shadowRoot;
  const value = shadow?.querySelector(timeSelector)?.getAttribute("datetime");
  return value && isStrictIsoDate(value) ? value : undefined;
}

/**
 * V1-4: every message the open conversation shows, with JoyClub's own
 * message ID, whether the user sent or received it, its time when shown and
 * its text. Date separators, system hints and messages without text (such as
 * a photo alone) are skipped. Quotes of earlier messages are not part of the
 * text.
 */
export function readConversationMessages(root: ParentNode): SeenMessage[] {
  const itemSelector = verifiedSelector("conversation", "messageItem");
  const sentSelector = verifiedSelector("conversation", "sentBubble");
  const receivedSelector = verifiedSelector("conversation", "receivedBubble");
  const textSelector = verifiedSelector("conversation", "messageText");
  if (!itemSelector || !sentSelector || !receivedSelector || !textSelector)
    return [];
  const messages: SeenMessage[] = [];
  for (const item of Array.from(root.querySelectorAll(itemSelector))) {
    const messageId = item.getAttribute("data-message-id") ?? "";
    if (!MESSAGE_ID_PATTERN.test(messageId)) continue;
    const sent = item.querySelector(sentSelector);
    const bubble = sent ?? item.querySelector(receivedSelector);
    const content = bubble?.querySelector(textSelector);
    if (!bubble || !content) continue;
    const text = bubbleText(content);
    if (!text) continue;
    const sentAt = sentTime(item);
    messages.push({
      messageId,
      direction: sent ? "sent" : "received",
      text,
      ...(sentAt ? { sentAt } : {}),
    });
  }
  return messages;
}
