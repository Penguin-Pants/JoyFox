/**
 * V1-2: a profile's tag labels draw inside each `j-tag`'s shadow root, and
 * neither that drawing nor the shadow root's creation reaches the page's
 * mutation observer. While the checklist reads as unreadable, this asks for
 * another pass after a short delay, a bounded number of times per page, so
 * the labels are read once they appear.
 */
export class PreferenceRetry {
  #url = "";
  #attempts = 0;
  #timer?: ReturnType<typeof setTimeout>;

  constructor(
    private readonly refresh: () => void,
    private readonly limit = 10,
    private readonly delayMs = 500,
  ) {}

  /** Called after each pass with the page address and whether to retry. */
  check(url: string, unreadable: boolean): void {
    if (url !== this.#url) {
      this.#url = url;
      this.#attempts = 0;
      this.stop();
    }
    if (!unreadable || this.#timer !== undefined) return;
    if (this.#attempts >= this.limit) return;
    this.#attempts += 1;
    this.#timer = globalThis.setTimeout(() => {
      this.#timer = undefined;
      this.refresh();
    }, this.delayMs);
  }

  stop(): void {
    globalThis.clearTimeout(this.#timer);
    this.#timer = undefined;
  }
}
