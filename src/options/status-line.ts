import type { Message } from "../i18n/message";
import { t } from "../i18n/translator";

export type StatusKind = "info" | "error";

/**
 * A panel's status line. The node is created once and kept: replacing a live
 * region on each render can leave its announcement unread, so only its text
 * changes. The message is kept too, so a language change can show it again
 * in the new language (`redraw`).
 *
 * The class list stays constant and the state rides on `data-kind`, so
 * styling and tests key off an attribute rather than a mutated class.
 */
export class StatusLine {
  readonly node: HTMLParagraphElement;
  #message: Message | undefined;

  constructor(document: Document) {
    this.node = document.createElement("p");
    this.node.className = "joyfox-panel__status";
    this.node.setAttribute("aria-live", "polite");
  }

  set(message: Message | undefined, kind: StatusKind): void {
    this.#message = message;
    this.node.dataset.kind = kind;
    this.node.setAttribute("role", kind === "error" ? "alert" : "status");
    this.node.textContent = message ? t(message) : "";
  }

  clear(): void {
    this.set(undefined, "info");
  }

  /** Show the message again, in the current language. */
  redraw(): void {
    const text = this.#message ? t(this.#message) : "";
    if (this.node.textContent !== text) this.node.textContent = text;
  }
}
