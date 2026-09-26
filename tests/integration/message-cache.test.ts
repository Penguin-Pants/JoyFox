// @vitest-environment jsdom
import "../setup-indexeddb";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { registerMessageHandlers } from "../../src/background/message-handlers";
import {
  MessageCache,
  messageCacheClient,
  type MessageCacheClient,
} from "../../src/content/message-cache";
import { MessageCacheService } from "../../src/messages/message-cache-service";
import {
  MESSAGE_CACHING_KEY,
  MESSAGE_RETENTION_KEY,
} from "../../src/messages/message-settings";
import { MessageRouter } from "../../src/messaging/router";
import { MESSAGE_REVISION_KEY } from "../../src/storage/message-revision";
import { repositories } from "../../src/storage/repositories";
import { conversationPage, messageId } from "../fixtures/messages";
import { MemorySettingsArea } from "../memory-settings";
import { freshDatabase } from "../setup-indexeddb";

const now = "2026-09-26T10:00:00.000Z";
const CONVERSATION = "personal-1111111-1234567";
let active: string | undefined;
let settings: MemorySettingsArea;
let service: MessageCacheService;
let router: MessageRouter;
let client: MessageCacheClient;

beforeEach(async () => {
  await freshDatabase();
  for (const id of ["account-a", "account-b"])
    await repositories.extensionAccounts.put(id, {
      id,
      accountId: id,
      joyClubAccountId: `synthetic-${id}`,
      createdAt: now,
      updatedAt: now,
    });
  active = "account-a";
  settings = new MemorySettingsArea();
  service = new MessageCacheService(settings, undefined, () => new Date(now));
  router = new MessageRouter();
  registerMessageHandlers(router, {
    messages: service,
    activeAccountId: () => Promise.resolve(active),
    settings,
  });
  client = messageCacheClient((message) => router.route(message));
});

afterEach(() => {
  document.body.replaceChildren();
});

const flush = async () => {
  for (let round = 0; round < 10; round += 1)
    await new Promise((resolve) => setTimeout(resolve, 0));
};

async function send(payload: Record<string, unknown>) {
  const response = await router.route({
    type: "messages.cache",
    requestId: `r${Math.random()}`,
    payload: {
      conversationId: CONVERSATION,
      memberId: "1234567",
      messages: [],
      ...payload,
    },
  } as never);
  if (!response.ok) throw new Error(response.error.code);
  return response.payload as never as Record<string, unknown>;
}

const message = (
  n: number,
  text: string,
  extra: Record<string, unknown> = {},
) => ({
  messageId: messageId(n),
  direction: "received",
  text,
  sentAt: "2026-09-20T18:00:00.000Z",
  ...extra,
});

const stored = async (account = "account-a") =>
  (await repositories.cachedMessages.list(account))
    .map((item) => [item.messageId.slice(-2), item.text])
    .sort();

describe("V1-4 storing messages", () => {
  it("stores what a conversation showed, once, and follows an edit", async () => {
    expect(
      await send({
        messages: [message(1, "Invented hello"), message(2, "Invented bye")],
      }),
    ).toEqual({ status: "stored", stored: 2 });
    expect(settings.items.get(MESSAGE_REVISION_KEY)).toBeDefined();
    const [first] = await repositories.cachedMessages.list("account-a");
    expect(first).toMatchObject({
      id: `message:${messageId(1)}`,
      conversationId: CONVERSATION,
      memberId: "1234567",
      direction: "received",
    });
    expect(await send({ messages: [message(1, "Invented hello")] })).toEqual({
      status: "stored",
      stored: 0,
    });
    await send({ messages: [message(1, "Invented hello, edited")] });
    expect(await stored()).toEqual([
      ["01", "Invented hello, edited"],
      ["02", "Invented bye"],
    ]);
  });

  it("never files a message under a second conversation", async () => {
    await send({ messages: [message(1, "Invented hello")] });
    await send({
      conversationId: "personal-1111111-7654321",
      memberId: "7654321",
      messages: [message(1, "Invented hello")],
    });
    const [only] = await repositories.cachedMessages.list("account-a");
    expect(only?.conversationId).toBe(CONVERSATION);
  });

  it("stores nothing while caching is off or no account is active", async () => {
    await settings.set({ [MESSAGE_CACHING_KEY]: false });
    expect(await send({ messages: [message(1, "Invented")] })).toEqual({
      status: "off",
    });
    await settings.set({ [MESSAGE_CACHING_KEY]: true });
    active = undefined;
    expect(await send({ messages: [message(1, "Invented")] })).toEqual({
      status: "no-account",
    });
    expect(await stored()).toEqual([]);
  });

  it("keeps messages only inside the purge window, 12 months by default", async () => {
    await send({
      messages: [
        message(1, "Invented recent"),
        message(2, "Invented old", { sentAt: "2025-09-01T10:00:00.000Z" }),
        message(3, "Invented undated", { sentAt: undefined }),
      ],
    });
    expect(await stored()).toEqual([
      ["01", "Invented recent"],
      ["03", "Invented undated"],
    ]);
    // Shorter: the message from 6 days ago stays, none is older.
    expect(await service.setRetention(1)).toBe(0);
    expect(settings.items.get(MESSAGE_RETENTION_KEY)).toBe(1);
    await expect(service.setRetention(0)).rejects.toThrow();
    // A later time: a month on, the September messages go.
    const later = new MessageCacheService(
      settings,
      undefined,
      () => new Date("2026-11-01T10:00:00.000Z"),
    );
    expect(await later.prune()).toBe(2);
    expect(await stored()).toEqual([]);
  });

  it("rejects malformed input", async () => {
    for (const payload of [
      { conversationId: "7654321" },
      { memberId: "7654321" },
      { messages: "x" },
      { messages: Array.from({ length: 101 }, (_, n) => message(n, "x")) },
      { messages: [message(1, "x", { messageId: "cm-message-1" })] },
      { messages: [message(1, "x", { direction: "both" })] },
      { messages: [message(1, "x", { sentAt: "yesterday" })] },
      { messages: [message(1, " ")] },
      { messages: [message(1, "x".repeat(10001))] },
    ])
      await expect(
        send(payload),
        JSON.stringify(payload).slice(0, 60),
      ).rejects.toThrow("HANDLER_FAILED");
  });
});

describe("V1-4 searching stored messages", () => {
  beforeEach(async () => {
    await send({
      messages: [
        message(1, "Invented Blue  heron at the lake", {
          sentAt: "2026-09-21T10:00:00.000Z",
        }),
        message(2, "Invented red kite", { direction: "sent" }),
        message(3, "Invented blue HERON again", {
          sentAt: "2026-09-25T10:00:00.000Z",
        }),
      ],
    });
  });

  it("finds every message that contains the query and no other, newest first", async () => {
    const found = await service.search("account-a", "  blue heron ");
    expect(found.messages.map((item) => item.messageId.slice(-2))).toEqual([
      "03",
      "01",
    ]);
    expect((await service.search("account-a", "kite")).messages).toHaveLength(
      1,
    );
    expect((await service.search("account-a", "owl")).messages).toEqual([]);
    expect((await service.search("account-a", " ")).messages).toEqual([]);
    expect((await service.search("account-b", "heron")).messages).toEqual([]);
  });
});

describe("V1-4 capture on a conversation page", () => {
  beforeEach(() => {
    window.history.replaceState(
      null,
      "",
      `/clubmail/conversation/conversation-wrapper-${CONVERSATION}/`,
    );
  });

  it("stores what the page shows, and sends an unchanged message only once", async () => {
    conversationPage(document, "1234567", [
      {
        id: messageId(1),
        direction: "received",
        html: "Invented hello",
        sentAt: "2026-09-25T10:00:00.000Z",
      },
      { id: messageId(2), direction: "sent", html: "Invented reply" },
    ]);
    const spy = vi.spyOn(client, "cache");
    const cache = new MessageCache(document, client);
    cache.update(true);
    await flush();
    expect(await stored()).toEqual([
      ["01", "Invented hello"],
      ["02", "Invented reply"],
    ]);
    cache.update(true);
    await flush();
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it("stores nothing while the switch is off", async () => {
    conversationPage(document, "1234567", [
      { id: messageId(1), direction: "received", html: "Invented hello" },
    ]);
    const spy = vi.spyOn(client, "cache");
    new MessageCache(document, client).update(false);
    await flush();
    expect(spy).not.toHaveBeenCalled();
    expect(await stored()).toEqual([]);
  });

  it("does not file the list just left under the next conversation", async () => {
    conversationPage(document, "1234567", [
      { id: messageId(1), direction: "received", html: "Invented first chat" },
    ]);
    const cache = new MessageCache(document, client);
    cache.update(true);
    await flush();
    // JoyClub routed to another member; the old item is still in the list.
    window.history.replaceState(
      null,
      "",
      "/clubmail/conversation/conversation-wrapper-personal-1111111-7654321/",
    );
    conversationPage(document, "7654321", [
      { id: messageId(1), direction: "received", html: "Invented first chat" },
      { id: messageId(2), direction: "received", html: "Invented second chat" },
    ]);
    cache.update(true);
    await flush();
    const byId = new Map(
      (await repositories.cachedMessages.list("account-a")).map((item) => [
        item.messageId.slice(-2),
        item.conversationId,
      ]),
    );
    expect(byId.get("01")).toBe(CONVERSATION);
    expect(byId.get("02")).toBe("personal-1111111-7654321");
  });

  it("stops asking after a refusal until the account changes", async () => {
    active = undefined;
    conversationPage(document, "1234567", [
      { id: messageId(1), direction: "received", html: "Invented hello" },
    ]);
    const spy = vi.spyOn(client, "cache");
    const cache = new MessageCache(document, client);
    cache.update(true);
    await flush();
    cache.update(true);
    await flush();
    expect(spy).toHaveBeenCalledTimes(1);
    active = "account-a";
    cache.reset();
    cache.update(true);
    await flush();
    expect(await stored()).toEqual([["01", "Invented hello"]]);
  });
});
