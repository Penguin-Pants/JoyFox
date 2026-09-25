import type { ExtensionAccount } from "../domain/types";
import { AccountService } from "../accounts/account-service";
import { message, type Message } from "../i18n/message";
import { errorDisplay, t } from "../i18n/translator";
import { confirmAllowed, confirmTiming } from "./confirm";
import { StatusLine } from "./status-line";

export const PANEL_CLASS = "joyfox-account-panel";
const MOUNTED = "data-joyfox-account-panel";
const mounted = new WeakMap<HTMLElement, AccountPanel>();

function element<K extends keyof HTMLElementTagNameMap>(
  document: Document,
  tag: K,
  className: string,
  text?: string,
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  node.className = className;
  // Always assign as text: account labels are user input and must never be
  // parsed as markup.
  if (text !== undefined) node.textContent = text;
  return node;
}

function accountName(account: ExtensionAccount): string {
  return account.label?.trim() || account.joyClubAccountId;
}

/**
 * The options account switcher. The extension cannot detect which JoyClub
 * login a tab belongs to yet, so the active account is whatever the user chose
 * here, and the panel states that plainly rather than implying detection.
 *
 * Rendering is idempotent: a second call replaces the panel contents instead of
 * appending a second copy.
 */
export class AccountPanel {
  #pendingRemoval: string | undefined;
  /** When the pending removal was armed, for the confirm grace period. */
  #armedAt = 0;
  /** Created once and re-attached on every render (see `StatusLine`). */
  readonly #status: StatusLine;

  constructor(
    private readonly root: HTMLElement,
    private readonly service = new AccountService(),
    /** Called after every action, so other panels can follow a change. */
    private readonly onChange: () => void = () => undefined,
  ) {
    this.root.classList.add(PANEL_CLASS);
    this.root.setAttribute(MOUNTED, "true");
    this.#status = new StatusLine(this.root.ownerDocument);
    this.#status.clear();
  }

  async render(): Promise<void> {
    const document = this.root.ownerDocument;
    // A redraw (a language change, another tab's change) keeps what the
    // user is typing into the add form.
    const typed = Array.from(
      this.root.querySelectorAll<HTMLInputElement>(".joyfox-panel__form input"),
      (input) => [input.id, input.value] as const,
    );
    const accounts = await this.service.listAccounts();
    const activeId = (await this.service.getActiveAccount())?.id;
    if (
      this.#pendingRemoval &&
      !accounts.some((a) => a.id === this.#pendingRemoval)
    )
      this.#pendingRemoval = undefined;
    this.root.replaceChildren();

    const heading = element(
      document,
      "h2",
      "joyfox-panel__heading",
      t("options.tabs.accounts"),
    );
    heading.id = "joyfox-accounts-heading";
    this.root.append(heading);
    this.root.setAttribute("aria-labelledby", heading.id);

    this.root.append(this.#renderActiveSummary(document, accounts, activeId));
    this.root.append(this.#renderList(document, accounts, activeId));
    this.root.append(this.#renderAddForm(document));
    this.root.append(
      element(document, "p", "joyfox-panel__hint", t("accounts.hint")),
    );
    this.#status.redraw();
    this.root.append(this.#status.node);
    for (const [id, value] of typed) {
      const input = this.root.querySelector<HTMLInputElement>(`#${id}`);
      if (input) input.value = value;
    }
  }

  #renderActiveSummary(
    document: Document,
    accounts: ExtensionAccount[],
    activeId: string | undefined,
  ): HTMLElement {
    const active = accounts.find((account) => account.id === activeId);
    const summary = element(document, "p", "joyfox-panel__active");
    const label = element(
      document,
      "span",
      "joyfox-panel__active-label",
      t("accounts.activeLabel"),
    );
    // The state is carried by words, never by color alone.
    const value = element(
      document,
      "strong",
      active
        ? "joyfox-panel__active-value"
        : "joyfox-panel__active-value joyfox-panel__active-value--none",
      active ? accountName(active) : t("accounts.noneSelected"),
    );
    summary.append(label, document.createTextNode(" "), value);
    return summary;
  }

  #renderList(
    document: Document,
    accounts: ExtensionAccount[],
    activeId: string | undefined,
  ): HTMLElement {
    if (accounts.length === 0)
      return element(document, "p", "joyfox-panel__empty", t("accounts.empty"));
    const list = element(document, "ul", "joyfox-panel__list");
    list.setAttribute("aria-label", t("accounts.list"));
    for (const account of accounts) {
      const item = element(document, "li", "joyfox-panel__item");
      item.dataset.accountId = account.id;
      const isActive = account.id === activeId;
      if (isActive) {
        item.setAttribute("aria-current", "true");
        item.classList.add("joyfox-panel__item--active");
      }
      const name = element(
        document,
        "span",
        "joyfox-panel__item-name",
        accountName(account),
      );
      item.append(name);
      item.append(
        element(
          document,
          "span",
          "joyfox-panel__item-state",
          t(isActive ? "accounts.active" : "accounts.inactive"),
        ),
      );
      if (!isActive) item.append(this.#activateButton(document, account));
      item.append(this.#removeButton(document, account));
      list.append(item);
    }
    return list;
  }

  #activateButton(
    document: Document,
    account: ExtensionAccount,
  ): HTMLButtonElement {
    const button = element(
      document,
      "button",
      "joyfox-panel__activate",
      t("accounts.use"),
    );
    button.type = "button";
    button.setAttribute(
      "aria-label",
      t("accounts.useLabel", { name: accountName(account) }),
    );
    button.addEventListener("click", () => {
      void this.#run(async () => {
        this.#pendingRemoval = undefined;
        await this.service.setActiveAccount(account.id);
        this.#setStatus(
          message("accounts.nowActive", { name: accountName(account) }),
          "info",
        );
      });
    });
    return button;
  }

  /**
   * Removing an account deletes every record stored under it, so the button
   * asks for a second, explicit click instead of acting on the first. A node
   * drawn unarmed can only arm, and a confirm must be a single click after the
   * grace period, so a double-click can never arm and confirm in one gesture.
   */
  #removeButton(
    document: Document,
    account: ExtensionAccount,
  ): HTMLButtonElement {
    const confirming = this.#pendingRemoval === account.id;
    const button = element(
      document,
      "button",
      "joyfox-panel__remove",
      t(confirming ? "accounts.confirmRemove" : "accounts.remove"),
    );
    button.type = "button";
    button.setAttribute(
      "aria-label",
      t(confirming ? "accounts.confirmRemoveLabel" : "accounts.removeLabel", {
        name: accountName(account),
      }),
    );
    button.addEventListener("click", (event) => {
      if (!confirming) {
        if (event.detail > 1) return;
        void this.#run(async () => {
          this.#pendingRemoval = account.id;
          this.#armedAt = confirmTiming.now();
          this.#setStatus(
            message("accounts.removePrompt", { name: accountName(account) }),
            "info",
          );
        });
        return;
      }
      if (this.#pendingRemoval !== account.id) return;
      if (!confirmAllowed(event, this.#armedAt)) return;
      this.#pendingRemoval = undefined;
      void this.#run(async () => {
        await this.service.deleteAccount(account.id);
        this.#setStatus(
          message("accounts.removed", { name: accountName(account) }),
          "info",
        );
      });
    });
    return button;
  }

  #renderAddForm(document: Document): HTMLFormElement {
    const form = element(document, "form", "joyfox-panel__form");
    form.setAttribute("aria-label", t("accounts.addForm"));
    const identifier = this.#field(
      document,
      "joyfox-account-identifier",
      t("accounts.identifier"),
      true,
    );
    const label = this.#field(
      document,
      "joyfox-account-label",
      t("accounts.label"),
      false,
    );
    const submit = element(
      document,
      "button",
      "joyfox-panel__submit",
      t("accounts.add"),
    );
    submit.type = "submit";
    form.append(identifier.wrapper, label.wrapper, submit);
    form.addEventListener("submit", (event) => {
      event.preventDefault();
      void this.#run(async () => {
        this.#pendingRemoval = undefined;
        const account = await this.service.createAccount({
          joyClubAccountId: identifier.input.value,
          label: label.input.value,
        });
        this.#setStatus(
          message("accounts.added", { name: accountName(account) }),
          "info",
        );
        // Added: the next render starts from an empty form.
        identifier.input.value = "";
        label.input.value = "";
      });
    });
    return form;
  }

  #field(
    document: Document,
    id: string,
    labelText: string,
    required: boolean,
  ): { wrapper: HTMLElement; input: HTMLInputElement } {
    const wrapper = element(document, "p", "joyfox-panel__field");
    const label = element(
      document,
      "label",
      "joyfox-panel__field-label",
      labelText,
    );
    label.htmlFor = id;
    const input = element(document, "input", "joyfox-panel__field-input");
    input.id = id;
    input.name = id;
    input.type = "text";
    input.required = required;
    input.autocomplete = "off";
    wrapper.append(label, input);
    return { wrapper, input };
  }

  #setStatus(message: Message, kind: "info" | "error"): void {
    this.#status.set(message, kind);
  }

  /**
   * Every action re-renders from storage afterwards, so the panel always shows
   * committed state rather than what the click was expected to do.
   */
  async #run(action: () => Promise<void>): Promise<void> {
    try {
      await action();
    } catch (error) {
      // A failed action must never leave a destructive one armed.
      this.#pendingRemoval = undefined;
      const display = errorDisplay(error);
      this.#setStatus(
        display
          ? message("error.withSuffix.nothingChanged", { error: display })
          : message("accounts.saveFailed"),
        "error",
      );
    }
    this.onChange();
    await this.render();
  }
}

/**
 * Mounts the panel once per host element. A second call re-renders the panel
 * already there instead of adding a second one, which matters because the
 * options page can be re-entered without a reload.
 */
export async function mountAccountPanel(
  root: HTMLElement,
  service?: AccountService,
  onChange?: () => void,
): Promise<AccountPanel> {
  const panel = mounted.get(root) ?? new AccountPanel(root, service, onChange);
  mounted.set(root, panel);
  await panel.render();
  return panel;
}
