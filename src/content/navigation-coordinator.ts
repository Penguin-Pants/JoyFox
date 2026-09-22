import type { ExtractionResult } from "../domain/types";
import type { PageType } from "../selectors/registry";

export interface NavigationEvent {
  page: ExtractionResult<PageType>;
  url: string;
  reason: "initial" | "mutation" | "history";
}
export type NavigationListener = (event: NavigationEvent) => void;

export class NavigationCoordinator {
  readonly #listeners = new Set<NavigationListener>();
  #observer?: MutationObserver;
  #timer?: ReturnType<typeof setTimeout>;

  constructor(private readonly detect: () => ExtractionResult<PageType>) {}
  subscribe(listener: NavigationListener): () => void {
    this.#listeners.add(listener);
    return () => this.#listeners.delete(listener);
  }
  start(): void {
    this.#emit("initial");
    this.#observer = new MutationObserver(() => {
      globalThis.clearTimeout(this.#timer);
      this.#timer = globalThis.setTimeout(() => this.#emit("mutation"), 50);
    });
    this.#observer.observe(document.documentElement, {
      childList: true,
      subtree: true,
    });
  }
  stop(): void {
    this.#observer?.disconnect();
    globalThis.clearTimeout(this.#timer);
  }
  #emit(reason: NavigationEvent["reason"]): void {
    const event = { page: this.detect(), url: location.href, reason };
    for (const listener of this.#listeners) listener(event);
  }
}
