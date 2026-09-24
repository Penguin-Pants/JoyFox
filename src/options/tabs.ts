/**
 * The options page shows one section at a time (owner request, 2026-09-24:
 * "too much scrolling"). Each tab is a link to `#<name>`, so a section can be
 * linked to, the browser's back button works, and a reload keeps the tab.
 * Keyboard use follows the WAI-ARIA tabs pattern: arrow keys, Home and End
 * move between tabs, and only the selected tab is in the tab order.
 */
export class OptionsTabs {
  readonly #tabs: HTMLAnchorElement[];

  constructor(
    private readonly document: Document,
    tablist: HTMLElement,
  ) {
    this.#tabs = Array.from(
      tablist.querySelectorAll<HTMLAnchorElement>('[role="tab"]'),
    );
    tablist.addEventListener("keydown", (event) => this.#onKey(event));
    for (const tab of this.#tabs)
      tab.addEventListener("click", (event) => {
        event.preventDefault();
        this.select(this.#name(tab), { push: true });
      });
    document.defaultView?.addEventListener("hashchange", () =>
      this.select(this.#fromHash()),
    );
    this.select(this.#fromHash());
  }

  /** The selected tab's name, as in its `#<name>` link. */
  get selected(): string {
    const tab = this.#tabs.find(
      (node) => node.getAttribute("aria-selected") === "true",
    );
    return tab ? this.#name(tab) : "";
  }

  select(
    name: string,
    options: { push?: boolean; focus?: boolean } = {},
  ): void {
    const target =
      this.#tabs.find((tab) => this.#name(tab) === name) ?? this.#tabs[0];
    if (!target) return;
    for (const tab of this.#tabs) {
      const on = tab === target;
      tab.setAttribute("aria-selected", String(on));
      tab.tabIndex = on ? 0 : -1;
      const panel = this.document.getElementById(
        tab.getAttribute("aria-controls") ?? "",
      );
      if (panel) panel.hidden = !on;
    }
    if (options.focus) target.focus();
    const hash = `#${this.#name(target)}`;
    const view = this.document.defaultView;
    if (options.push && view && view.location.hash !== hash)
      view.history.pushState(null, "", hash);
  }

  #name(tab: HTMLAnchorElement): string {
    return (tab.getAttribute("href") ?? "").replace(/^#/, "");
  }

  #fromHash(): string {
    return (this.document.defaultView?.location.hash ?? "").replace(/^#/, "");
  }

  #onKey(event: KeyboardEvent): void {
    const index = this.#tabs.findIndex(
      (tab) => tab === this.document.activeElement,
    );
    if (index < 0) return;
    const last = this.#tabs.length - 1;
    const next =
      event.key === "ArrowRight"
        ? index === last
          ? 0
          : index + 1
        : event.key === "ArrowLeft"
          ? index === 0
            ? last
            : index - 1
          : event.key === "Home"
            ? 0
            : event.key === "End"
              ? last
              : undefined;
    if (next === undefined) return;
    event.preventDefault();
    const tab = this.#tabs[next];
    if (tab) this.select(this.#name(tab), { push: true, focus: true });
  }
}
