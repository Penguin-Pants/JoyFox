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
  #urlTimer?: ReturnType<typeof setInterval>;
  #lastUrl = "";
  #started = false;
  readonly #onPopState = () => this.#emit("history");

  constructor(private readonly detect: () => ExtractionResult<PageType>) {}
  subscribe(listener: NavigationListener): () => void {
    this.#listeners.add(listener);
    return () => this.#listeners.delete(listener);
  }
  start(): void {
    if (this.#started) return;
    this.#started = true;
    this.#lastUrl = location.href;
    this.#emit("initial");
    this.#observer = new MutationObserver(() => {
      globalThis.clearTimeout(this.#timer);
      this.#timer = globalThis.setTimeout(() => this.#emit("mutation"), 50);
    });
    this.#observer.observe(document.documentElement, {
      childList: true,
      subtree: true,
    });
    this.#urlTimer = globalThis.setInterval(() => {
      if (location.href !== this.#lastUrl) this.#emit("history");
    }, 250);
    globalThis.addEventListener("popstate", this.#onPopState);
  }
  stop(): void {
    if (!this.#started) return;
    this.#observer?.disconnect();
    globalThis.clearTimeout(this.#timer);
    globalThis.clearInterval(this.#urlTimer);
    globalThis.removeEventListener("popstate", this.#onPopState);
    this.#started = false;
  }
  #emit(reason: NavigationEvent["reason"]): void {
    const url = location.href;
    this.#lastUrl = url;
    const event = { page: this.detect(), url, reason };
    for (const listener of this.#listeners) listener(event);
  }
}
