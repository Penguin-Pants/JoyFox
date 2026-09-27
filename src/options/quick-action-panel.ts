import { QUICK_ACTION_KEY } from "../actions/quick-action-setting";
import type { PlainKey } from "../i18n/catalog/en";
import { t } from "../i18n/translator";
import {
  runtimeSettingsArea,
  type SettingsArea,
} from "../storage/local-settings";

function element<K extends keyof HTMLElementTagNameMap>(
  document: Document,
  tag: K,
  className: string,
  text?: string,
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

/**
 * The switch for the experimental Ignore and Delete button (M9, ADR 0011),
 * so the user never needs the console (owner request, 2026-09-27). Off by
 * default. Open JoyClub pages hear the change through `storage.onChanged`.
 */
export class QuickActionPanel {
  #generation = 0;
  #on = false;
  #status?: PlainKey;
  #focusToggle = false;

  constructor(
    private readonly root: HTMLElement,
    private readonly settings: SettingsArea = runtimeSettingsArea,
  ) {}

  async render(): Promise<void> {
    const generation = (this.#generation += 1);
    // A setting that cannot be read counts as off, like on JoyClub pages.
    const on = await Promise.resolve()
      .then(() => this.settings.get([QUICK_ACTION_KEY]))
      .then((stored) => stored[QUICK_ACTION_KEY] === true)
      .catch(() => false);
    if (generation !== this.#generation) return;
    this.#on = on;
    this.#draw();
  }

  #draw(): void {
    const document = this.root.ownerDocument;
    const heading = element(
      document,
      "h2",
      "joyfox-panel__heading",
      t("quickSetting.heading"),
    );
    heading.id = "joyfox-quick-action-heading";
    this.root.setAttribute("aria-labelledby", heading.id);
    const label = element(document, "label", "joyfox-quick-action__label");
    const toggle = element(document, "input", "");
    toggle.type = "checkbox";
    toggle.id = "joyfox-quick-action-toggle";
    toggle.checked = this.#on;
    label.append(toggle, " ", t("quickSetting.label"));
    toggle.addEventListener("change", () => {
      // The redraw replaces the box; the keyboard stays on it.
      this.#focusToggle = true;
      void this.settings
        .set({ [QUICK_ACTION_KEY]: toggle.checked })
        .then(() => {
          this.#status = "quickSetting.saved";
          return this.render();
        })
        .catch(() => {
          toggle.checked = this.#on;
          this.#status = "quickSetting.saveFailed";
          this.#draw();
        });
    });
    this.root.replaceChildren(
      heading,
      label,
      element(document, "p", "joyfox-panel__hint", t("quickSetting.hint")),
    );
    if (this.#status) {
      const status = element(
        document,
        "p",
        "joyfox-panel__status",
        t(this.#status),
      );
      status.setAttribute("role", "status");
      this.root.append(status);
      this.#status = undefined;
    }
    if (this.#focusToggle) {
      this.#focusToggle = false;
      toggle.focus();
    }
  }
}
