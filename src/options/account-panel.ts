import type { ExtensionAccount } from "../domain/types";
import { AccountService } from "../accounts/account-service";
import { isExtensionError } from "../errors";

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
  /**
   * Created once and re-attached on every render. Replacing a live region on
   * each render can leave its announcement unread, so the node itself stays
   * the same and only its text changes.
   */
  readonly #status: HTMLParagraphElement;

  constructor(
    private readonly root: HTMLElement,
    private readonly service = new AccountService(),
    /** Called after every action, so other panels can follow a change. */
    private readonly onChange: () => void = () => undefined,
  ) {
    this.root.classList.add(PANEL_CLASS);
    this.root.setAttribute(MOUNTED, "true");
    this.#status = this.root.ownerDocument.createElement("p");
    this.#status.className = "joyfox-panel__status";
    this.#status.setAttribute("aria-live", "polite");
    this.#setStatus("", "info");
  }

  async render(): Promise<void> {
    const document = this.root.ownerDocument;
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
      "Accounts",
    );
    heading.id = "joyfox-accounts-heading";
    this.root.append(heading);
    this.root.setAttribute("aria-labelledby", heading.id);

    this.root.append(this.#renderActiveSummary(document, accounts, activeId));
    this.root.append(this.#renderList(document, accounts, activeId));
    this.root.append(this.#renderAddForm(document));
    this.root.append(
      element(
        document,
        "p",
        "joyfox-panel__hint",
        "JoyFox cannot read which JoyClub login a tab uses. The active account is the one selected here, and all notes, tags and rules are stored under it.",
      ),
    );
    this.root.append(this.#status);
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
      "Active account:",
    );
    // The state is carried by words, never by color alone.
    const value = element(
      document,
      "strong",
      active
        ? "joyfox-panel__active-value"
        : "joyfox-panel__active-value joyfox-panel__active-value--none",
      active ? accountName(active) : "None selected",
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
      return element(
        document,
        "p",
        "joyfox-panel__empty",
        "No accounts yet. Add one below to start storing notes and tags.",
      );
    const list = element(document, "ul", "joyfox-panel__list");
    list.setAttribute("aria-label", "Stored accounts");
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
          isActive ? "Active" : "Not active",
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
      "Use this account",
    );
    button.type = "button";
    button.setAttribute("aria-label", `Use account ${accountName(account)}`);
    button.addEventListener("click", () => {
      void this.#run(async () => {
        this.#pendingRemoval = undefined;
        await this.service.setActiveAccount(account.id);
        this.#setStatus(
          `Active account is now ${accountName(account)}.`,
          "info",
        );
      });
    });
    return button;
  }

  /**
   * Removing an account deletes every record stored under it, so the button
   * asks for a second, explicit click instead of acting on the first.
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
      confirming ? "Confirm removal" : "Remove",
    );
    button.type = "button";
    button.setAttribute(
      "aria-label",
      confirming
        ? `Confirm removal of account ${accountName(account)} and all of its data`
        : `Remove account ${accountName(account)}`,
    );
    button.addEventListener("click", () => {
      void this.#run(async () => {
        if (this.#pendingRemoval !== account.id) {
          this.#pendingRemoval = account.id;
          this.#setStatus(
            `Removing ${accountName(account)} also deletes its notes, tags and rules. Click again to confirm.`,
            "info",
          );
          return;
        }
        this.#pendingRemoval = undefined;
        await this.service.deleteAccount(account.id);
        this.#setStatus(
          `Removed ${accountName(account)} and its stored data.`,
          "info",
        );
      });
    });
    return button;
  }

  #renderAddForm(document: Document): HTMLFormElement {
    const form = element(document, "form", "joyfox-panel__form");
    form.setAttribute("aria-label", "Add an account");
    const identifier = this.#field(
      document,
      "joyfox-account-identifier",
      "JoyClub account identifier",
      true,
    );
    const label = this.#field(
      document,
      "joyfox-account-label",
      "Display label (optional)",
      false,
    );
    const submit = element(
      document,
      "button",
      "joyfox-panel__submit",
      "Add account",
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
        this.#setStatus(`Added ${accountName(account)}.`, "info");
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

  /**
   * The class list stays constant and the state rides on `data-kind`, so
   * styling and tests key off an attribute rather than a mutated class.
   */
  #setStatus(message: string, kind: "info" | "error"): void {
    this.#status.dataset.kind = kind;
    this.#status.setAttribute("role", kind === "error" ? "alert" : "status");
    this.#status.textContent = message;
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
      this.#setStatus(
        isExtensionError(error)
          ? `${error.message}. Nothing was changed.`
          : "That change could not be saved. Nothing was changed.",
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
