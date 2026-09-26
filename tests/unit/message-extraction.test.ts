// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { readConversationMessages } from "../../src/extraction/messages";
import { conversationPage, messageId } from "../fixtures/messages";

afterEach(() => {
  document.body.replaceChildren();
});

describe("V1-4 reading the messages a conversation shows (12-messages.md)", () => {
  it("reads each message's ID, direction, time and text, and skips the rest", () => {
    conversationPage(document, "1234567", [
      {
        id: messageId(1),
        direction: "received",
        html: "Invented   first<br>line two <a class='j-anchor'>link</a>",
        sentAt: "2026-09-26T10:00:00.000Z",
        quote: "An earlier message",
      },
      { id: messageId(2), direction: "sent", html: " Invented reply " },
      // A photo alone: no text.
      { id: messageId(3), direction: "received", html: "" },
      { id: "not-a-message-id", direction: "sent", html: "Skipped" },
    ]);
    expect(readConversationMessages(document)).toEqual([
      {
        messageId: messageId(1),
        direction: "received",
        sentAt: "2026-09-26T10:00:00.000Z",
        text: "Invented first\nline two link",
      },
      { messageId: messageId(2), direction: "sent", text: "Invented reply" },
    ]);
  });

  it("keeps a time only when it is a strict date, and cuts a very long text", () => {
    conversationPage(document, "1234567", [
      {
        id: messageId(1),
        direction: "sent",
        html: "x".repeat(10050),
        sentAt: "yesterday",
      },
    ]);
    const [message] = readConversationMessages(document);
    expect(message?.sentAt).toBeUndefined();
    expect(message?.text).toHaveLength(10000);
  });
});
