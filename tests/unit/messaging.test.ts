import { describe, expect, it, vi } from "vitest";
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

  it("keeps a failed handler's cause in the console, and answers generically", async () => {
    const logged = vi.spyOn(console, "error").mockImplementation(() => {});
    const router = new MessageRouter();
    const cause = new Error("memberId must be a non-empty string");
    router.register("note.get", () => {
      throw cause;
    });
    const response = await router.route({
      type: "note.get",
      requestId: "request-2",
      payload: {},
    } as never);
    expect(response).toEqual({
      requestId: "request-2",
      ok: false,
      error: {
        code: "HANDLER_FAILED",
        message: "The request could not be completed",
      },
    });
    expect(logged).toHaveBeenCalledWith(
      "JoyFox: request failed",
      "note.get",
      expect.objectContaining({
        name: "Error",
        message: "memberId must be a non-empty string",
      }),
    );
    // A thrown value that is not an Error is reduced to its type.
    router.register("note.save", () => {
      throw { body: "a note typed by the user" };
    });
    await router.route({
      type: "note.save",
      requestId: "request-3",
      payload: {},
    } as never);
    expect(logged).toHaveBeenLastCalledWith(
      "JoyFox: request failed",
      "note.save",
      { name: "object" },
    );
    logged.mockRestore();
  });
});
