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
  /** The sending page's address, for a message from a content script. */
  url?: string;
}

type Handler<K extends keyof MessageContract> = (
  payload: MessageContract[K]["request"],
  context: RouteContext,
) => Promise<MessageContract[K]["response"]> | MessageContract[K]["response"];

/**
 * Only an error's name, message and stack: JoyFox's own messages name
 * fields and codes, never stored values, and a thrown value that is not an
 * `Error` is reduced to its type, so the log holds no page or member data.
 */
export function failureOf(error: unknown): {
  name: string;
  message?: string;
  stack?: string;
} {
  if (!(error instanceof Error)) return { name: typeof error };
  return {
    name: error.name,
    message: error.message,
    ...(error.stack ? { stack: error.stack } : {}),
  };
}

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
    } catch (error) {
      // A real failure (lint allows console.error for these): the answer
      // stays generic, and the background console keeps the cause, so a
      // failure on a live page can be traced.
      console.error("JoyFox: request failed", message.type, failureOf(error));
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
