import {
  createRequestId,
  type ExtensionMessage,
  type ExtensionResponse,
  type MessageContract,
} from "./protocol";

export type MessageSender = (
  message: ExtensionMessage,
) => Promise<ExtensionResponse>;

export async function request<K extends keyof MessageContract>(
  sender: MessageSender,
  type: K,
  payload: MessageContract[K]["request"],
): Promise<MessageContract[K]["response"]> {
  const message = { type, requestId: createRequestId(), payload };
  const response = await sender(message);
  if (response.requestId !== message.requestId)
    throw new Error("Mismatched response requestId");
  if (!response.ok)
    throw new Error(`${response.error.code}: ${response.error.message}`);
  return response.payload as MessageContract[K]["response"];
}
