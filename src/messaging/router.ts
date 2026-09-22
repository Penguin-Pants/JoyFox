import type {
  ExtensionMessage,
  ExtensionResponse,
  MessageContract,
} from "./protocol";

type Handler<K extends keyof MessageContract> = (
  payload: MessageContract[K]["request"],
) => Promise<MessageContract[K]["response"]> | MessageContract[K]["response"];

export class MessageRouter {
  readonly #handlers = new Map<string, (payload: never) => unknown>();
  register<K extends keyof MessageContract>(
    type: K,
    handler: Handler<K>,
  ): void {
    this.#handlers.set(type, handler as (payload: never) => unknown);
  }
  async route(message: ExtensionMessage): Promise<ExtensionResponse> {
    if (
      !message ||
      typeof message.type !== "string" ||
      typeof message.requestId !== "string"
    ) {
      return {
        requestId: message?.requestId ?? "invalid",
        ok: false,
        error: { code: "INVALID_MESSAGE", message: "Invalid message envelope" },
      };
    }
    const handler = this.#handlers.get(message.type);
    if (!handler)
      return {
        requestId: message.requestId,
        ok: false,
        error: { code: "UNKNOWN_MESSAGE", message: "Unsupported message type" },
      };
    try {
      return {
        requestId: message.requestId,
        ok: true,
        payload: await handler(message.payload as never),
      };
    } catch {
      return {
        requestId: message.requestId,
        ok: false,
        error: {
          code: "HANDLER_FAILED",
          message: "The request could not be completed",
        },
      };
    }
  }
}
