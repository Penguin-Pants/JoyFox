import type { ExtractionResult } from "../domain/types";
import type { PageType } from "../selectors/registry";

export interface NavigationEvent {
  page: ExtractionResult<PageType>;
  url: string;
  reason: "initial" | "mutation" | "history";
}
export type NavigationListener = (event: NavigationEvent) => void;

/** Attributes whose in-place change can alter what a feature reads. */
export const WATCHED_ATTRIBUTES: readonly string[] = [
  "href",
  "verification-status",
  "universal-gender",
  "aria-label",
];

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
      // JoyClub can patch a triage input in place: a row's profile link, a
      // shield or gender code, or the photo count label. Only these
      // attributes are watched, never JoyFox's own `data-joyfox-*` ones, so
      // JoyFox's writes cannot wake the coordinator.
      attributes: true,
      attributeFilter: [...WATCHED_ATTRIBUTES],
      characterData: true,
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
    // Isolate listeners: one failing feature must not stop delivery to the
    // others, and must not leave `start()` half-initialized on the initial
    // emission or let an exception escape into the page's own navigation.
    for (const listener of [...this.#listeners])
      try {
        listener(event);
      } catch (error) {
        console.error("JoyFox: navigation listener failed", error);
      }
  }
}
