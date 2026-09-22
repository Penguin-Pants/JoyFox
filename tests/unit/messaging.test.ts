import { describe, expect, it } from "vitest";
import { request } from "../../src/messaging/request";
import { MessageRouter } from "../../src/messaging/router";

describe("F5 messaging", () => {
  it("round-trips diagnostic.ping with the same request ID", async () => {
    const router = new MessageRouter();
    router.register("diagnostic.ping", ({ value }) => ({ value }));
    await expect(
      request((message) => router.route(message), "diagnostic.ping", {
        value: "pong",
      }),
    ).resolves.toEqual({ value: "pong" });
  });
  it("returns a typed error for unknown messages", async () => {
    const response = await new MessageRouter().route({
      type: "unknown",
      requestId: "request-1",
      payload: {},
    });
    expect(response).toEqual({
      requestId: "request-1",
      ok: false,
      error: { code: "UNKNOWN_MESSAGE", message: "Unsupported message type" },
    });
  });
});
