import type { ExtensionMessage } from "./protocol";

export interface RuntimePort {
  postMessage(message: ExtensionMessage): void;
  disconnect(): void;
  onMessage: {
    addListener(listener: (message: ExtensionMessage) => void): void;
    removeListener(listener: (message: ExtensionMessage) => void): void;
  };
}

export class OperationPort {
  constructor(
    private readonly port: RuntimePort,
    readonly requestId: string,
  ) {}
  send<T>(type: string, payload: T): void {
    this.port.postMessage({ type, requestId: this.requestId, payload });
  }
  subscribe(listener: (message: ExtensionMessage) => void): () => void {
    const filtered = (message: ExtensionMessage) => {
      if (message.requestId === this.requestId) listener(message);
    };
    this.port.onMessage.addListener(filtered);
    return () => this.port.onMessage.removeListener(filtered);
  }
  close(): void {
    this.port.disconnect();
  }
}
