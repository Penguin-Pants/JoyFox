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
  #started = false;
  #originalPushState?: History["pushState"];
  #originalReplaceState?: History["replaceState"];
  readonly #onPopState = () => this.#emit("history");

  constructor(private readonly detect: () => ExtractionResult<PageType>) {}
  subscribe(listener: NavigationListener): () => void {
    this.#listeners.add(listener);
    return () => this.#listeners.delete(listener);
  }
  start(): void {
    if (this.#started) return;
    this.#started = true;
    this.#emit("initial");
    this.#observer = new MutationObserver(() => {
      globalThis.clearTimeout(this.#timer);
      this.#timer = globalThis.setTimeout(() => this.#emit("mutation"), 50);
    });
    this.#observer.observe(document.documentElement, {
      childList: true,
      subtree: true,
    });
    this.#originalPushState = history.pushState;
    this.#originalReplaceState = history.replaceState;
    history.pushState = (...args) => {
      this.#originalPushState?.apply(history, args);
      this.#emit("history");
    };
    history.replaceState = (...args) => {
      this.#originalReplaceState?.apply(history, args);
      this.#emit("history");
    };
    globalThis.addEventListener("popstate", this.#onPopState);
  }
  stop(): void {
    if (!this.#started) return;
    this.#observer?.disconnect();
    globalThis.clearTimeout(this.#timer);
    if (this.#originalPushState) history.pushState = this.#originalPushState;
    if (this.#originalReplaceState)
      history.replaceState = this.#originalReplaceState;
    globalThis.removeEventListener("popstate", this.#onPopState);
    this.#started = false;
  }
  #emit(reason: NavigationEvent["reason"]): void {
    const event = { page: this.detect(), url: location.href, reason };
    for (const listener of this.#listeners) listener(event);
  }
}
