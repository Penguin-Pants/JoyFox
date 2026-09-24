import type {
  ExtensionMessage,
  ExtensionResponse,
  MessageContract,
} from "./protocol";

/**
 * Where a message came from, as the browser reports it (never as the message
 * claims). `tabId` is set for messages from a content script.
 */
export interface RouteContext {
  tabId?: number;
}

type Handler<K extends keyof MessageContract> = (
  payload: MessageContract[K]["request"],
  context: RouteContext,
) => Promise<MessageContract[K]["response"]> | MessageContract[K]["response"];

export class MessageRouter {
  readonly #handlers = new Map<
    string,
    (payload: never, context: RouteContext) => unknown
  >();
  register<K extends keyof MessageContract>(
    type: K,
    handler: Handler<K>,
  ): void {
    this.#handlers.set(
      type,
      handler as (payload: never, context: RouteContext) => unknown,
    );
  }
  async route(
    message: ExtensionMessage,
    context: RouteContext = {},
  ): Promise<ExtensionResponse> {
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
        payload: await handler(message.payload as never, context),
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
