export interface ExtensionMessage<T = unknown> {
  type: string;
  requestId: string;
  payload: T;
}
export interface MessageError {
  code: string;
  message: string;
}
export type ExtensionResponse<T = unknown> =
  | { requestId: string; ok: true; payload: T }
  | { requestId: string; ok: false; error: MessageError };

export interface MessageContract {
  "diagnostic.ping": {
    request: { value: string };
    response: { value: string };
  };
}

export function createRequestId(): string {
  return crypto.randomUUID();
}
