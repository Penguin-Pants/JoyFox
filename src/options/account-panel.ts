import type { ExtensionAccount } from "../domain/types";
import { AccountService } from "../accounts/account-service";
import { message, type Message } from "../i18n/message";
import { errorDisplay, t } from "../i18n/translator";
import {
  FOCUS_KEY,
  rememberFocus,
  restoreFocus,
  type FocusMemo,
} from "../ui/focus";
import { confirmAllowed, confirmTiming } from "./confirm";
import { StatusLine } from "./status-line";

export const PANEL_CLASS = "joyfox-account-panel";
const MOUNTED = "data-joyfox-account-panel";
const mounted = new WeakMap<HTMLElement, AccountPanel>();

/** The inline field for a new label; one is open at a time. */
const RENAME_FIELD_ID = "joyfox-account-rename";

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

/**
 * An account's name wherever the panel shows it: the label with the JoyClub
 * identifier beside it ("Me (drclaw)"), so two accounts with similar labels
 * can be told apart. Only the identifier when there is no other label.
 */
function fullName(account: ExtensionAccount): string {
  const label = account.label?.trim();
  return label && label !== account.joyClubAccountId
    ? t("accounts.nameWithIdentifier", {
        label,
        identifier: account.joyClubAccountId,
      })
    : account.joyClubAccountId;
}

/** Focus fell to the page, as when the focused control was disabled. */
const focusFell = (document: Document) =>
  !document.activeElement || document.activeElement === document.body;

/**
 * The options account switcher. The extension cannot detect which JoyClub
 * login a tab belongs to yet, so the active account is whatever the user chose
 * here, and the panel states that plainly rather than implying detection.
 *
 * Rendering is idempotent: a second call replaces the panel contents instead of
 * appending a second copy. Each draw keeps keyboard focus on the same control
 * (`src/ui/focus.ts`), or on the nearest sensible one when it is gone.
 */
export class AccountPanel {
  #pendingRemoval: string | undefined;
  /** When the pending removal was armed, for the confirm grace period. */
  #armedAt = 0;
  /** The account whose label is being edited, if any. */
  #renaming: string | undefined;
  /** Set while an add runs, so a double submit cannot add the account twice. */
  #adding = false;
  /** Where the next draw puts focus, whatever had it before. */
  #focusNext: FocusMemo | undefined;
  /**
   * The control that had focus when an action started. A control disabled
   * while the action runs drops focus to the page; the draw after the
   * action puts it back.
   */
  #focusBefore: FocusMemo | undefined;
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
    const accounts = await this.service.listAccounts();
    const activeId = (await this.service.getActiveAccount())?.id;
    if (
      this.#pendingRemoval &&
      !accounts.some((a) => a.id === this.#pendingRemoval)
    )
      this.#pendingRemoval = undefined;
    if (this.#renaming && !accounts.some((a) => a.id === this.#renaming))
      this.#renaming = undefined;
    // A redraw (a language change, another tab's change) keeps what the
    // user is typing into the add form. Read after the storage reads, so
    // text typed while they ran is kept too.
    const typed = Array.from(
      this.root.querySelectorAll<HTMLInputElement>(".joyfox-panel__form input"),
      (input) => [input.id, input.value] as const,
    );
    // The same for a new label, while it is for the same account.
    const renameInput = this.root.querySelector<HTMLInputElement>(
      `#${RENAME_FIELD_ID}`,
    );
    const renameDraft =
      renameInput && renameInput.dataset.accountId === this.#renaming
        ? renameInput.value
        : undefined;
    const focus =
      rememberFocus(this.root) ??
      (focusFell(document) ? this.#focusBefore : undefined);
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
    this.root.append(
      this.#renderList(document, accounts, activeId, renameDraft),
    );
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
    const next = this.#focusNext;
    this.#focusNext = undefined;
    if (next) restoreFocus(this.root, next);
    else restoreFocus(this.root, focus, this.#fallbacks(focus));
  }

  /**
   * Where focus goes when its control is gone after a draw: the same row's
   * next control, else the account list, else the add form (no account is
   * left).
   */
  #fallbacks(focus: FocusMemo | undefined): string[] {
    const [kind, ...rest] = focus?.key.split(":") ?? [];
    const id = rest.join(":");
    const list = ["accounts-list", "add:identifier"];
    switch (kind) {
      case "use":
        // The account is active now and has no "Use" button.
        return [`rename:${id}`, `remove:${id}`, ...list];
      case "rename-field":
      case "rename-save":
      case "rename-cancel":
        return [`rename:${id}`, ...list];
      case "rename":
      case "remove":
        return list;
      default:
        return [];
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
      active ? fullName(active) : t("accounts.noneSelected"),
    );
    summary.append(label, document.createTextNode(" "), value);
    return summary;
  }

  #renderList(
    document: Document,
    accounts: ExtensionAccount[],
    activeId: string | undefined,
    renameDraft: string | undefined,
  ): HTMLElement {
    if (accounts.length === 0)
      return element(document, "p", "joyfox-panel__empty", t("accounts.empty"));
    const list = element(document, "ul", "joyfox-panel__list");
    list.setAttribute("aria-label", t("accounts.list"));
    // Takes focus when the control that had it is gone (a removed account).
    list.tabIndex = -1;
    list.setAttribute(FOCUS_KEY, "accounts-list");
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
        fullName(account),
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
      const renaming = this.#renaming === account.id;
      if (!renaming) item.append(this.#renameButton(document, account));
      item.append(this.#removeButton(document, account));
      if (renaming)
        item.append(this.#renderRenameForm(document, account, renameDraft));
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
    button.setAttribute(FOCUS_KEY, `use:${account.id}`);
    button.setAttribute(
      "aria-label",
      t("accounts.useLabel", { name: fullName(account) }),
    );
    button.addEventListener("click", () => {
      void this.#run(async () => {
        this.#pendingRemoval = undefined;
        await this.service.setActiveAccount(account.id);
        this.#setStatus(
          message("accounts.nowActive", { name: fullName(account) }),
          "info",
        );
      });
    });
    return button;
  }

  /**
   * Opens a field for a new display label. Only the label changes: the
   * JoyClub identifier is how an import finds the account, so it stays.
   */
  #renameButton(
    document: Document,
    account: ExtensionAccount,
  ): HTMLButtonElement {
    const button = element(
      document,
      "button",
      "joyfox-account__rename",
      t("accounts.rename"),
    );
    button.type = "button";
    button.setAttribute(FOCUS_KEY, `rename:${account.id}`);
    button.setAttribute(
      "aria-label",
      t("accounts.renameLabel", { name: fullName(account) }),
    );
    button.addEventListener("click", () => {
      // A removal armed before is disarmed, and its prompt goes with it.
      if (this.#pendingRemoval) this.#status.clear();
      this.#pendingRemoval = undefined;
      this.#renaming = account.id;
      const label = account.label ?? "";
      // The field opens with the whole label selected, ready to type over.
      this.#focusNext = {
        key: `rename-field:${account.id}`,
        start: 0,
        end: label.length,
      };
      void this.render();
    });
    return button;
  }

  #renderRenameForm(
    document: Document,
    account: ExtensionAccount,
    draft: string | undefined,
  ): HTMLFormElement {
    const form = element(document, "form", "joyfox-account__rename-form");
    const field = element(document, "p", "joyfox-panel__field");
    const label = element(
      document,
      "label",
      "joyfox-panel__field-label",
      t("accounts.renameField", { identifier: account.joyClubAccountId }),
    );
    label.htmlFor = RENAME_FIELD_ID;
    const input = element(document, "input", "joyfox-panel__field-input");
    input.id = RENAME_FIELD_ID;
    input.name = RENAME_FIELD_ID;
    input.type = "text";
    input.autocomplete = "off";
    input.value = draft ?? account.label ?? "";
    input.dataset.accountId = account.id;
    input.setAttribute(FOCUS_KEY, `rename-field:${account.id}`);
    const hint = element(
      document,
      "span",
      "joyfox-panel__hint",
      t("accounts.labelHint"),
    );
    hint.id = `${RENAME_FIELD_ID}-hint`;
    input.setAttribute("aria-describedby", hint.id);
    field.append(label, input, hint);
    const save = element(
      document,
      "button",
      "joyfox-panel__submit",
      t("accounts.renameSave"),
    );
    save.type = "submit";
    save.setAttribute(FOCUS_KEY, `rename-save:${account.id}`);
    const cancel = element(
      document,
      "button",
      "joyfox-account__rename-cancel",
      t("accounts.renameCancel"),
    );
    cancel.type = "button";
    cancel.setAttribute(FOCUS_KEY, `rename-cancel:${account.id}`);
    const close = () => {
      this.#renaming = undefined;
      this.#status.clear();
      this.#focusNext = { key: `rename:${account.id}` };
      void this.render();
    };
    cancel.addEventListener("click", close);
    input.addEventListener("keydown", (event) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      close();
    });
    form.addEventListener("submit", (event) => {
      event.preventDefault();
      const value = input.value;
      void this.#run(async () => {
        this.#pendingRemoval = undefined;
        const renamed = await this.service.renameAccount(account.id, value);
        // Saved: the next draw closes the field. On failure it stays open
        // with what the user typed.
        this.#renaming = undefined;
        this.#setStatus(
          message("accounts.renamed", { name: fullName(renamed) }),
          "info",
        );
      });
    });
    form.append(field, save, document.createTextNode(" "), cancel);
    return form;
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
    // The same key armed and unarmed, so focus stays on it when it arms.
    button.setAttribute(FOCUS_KEY, `remove:${account.id}`);
    button.setAttribute(
      "aria-label",
      t(confirming ? "accounts.confirmRemoveLabel" : "accounts.removeLabel", {
        name: fullName(account),
      }),
    );
    button.addEventListener("click", (event) => {
      if (!confirming) {
        if (event.detail > 1) return;
        void this.#run(async () => {
          this.#pendingRemoval = account.id;
          this.#armedAt = confirmTiming.now();
          this.#setStatus(
            message("accounts.removePrompt", { name: fullName(account) }),
            "info",
          );
        });
        return;
      }
      if (this.#pendingRemoval !== account.id) return;
      if (!confirmAllowed(event, this.#armedAt)) return;
      this.#pendingRemoval = undefined;
      void this.#run(async () => {
        const wasActive = await this.service.deleteAccount(account.id);
        // No other account becomes active on its own, so say what is next.
        // The account is gone either way: a failed count must not report
        // the removal as failed.
        const left = await this.service.listAccounts().then(
          (all) => all.length,
          () => undefined,
        );
        const name = fullName(account);
        this.#setStatus(
          left === 0
            ? message("accounts.removedNoneLeft", { name })
            : wasActive
              ? message("accounts.removedNoneActive", { name })
              : message("accounts.removed", { name }),
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
      "add:identifier",
      t("accounts.identifier"),
      t("accounts.identifierHint"),
      true,
    );
    const label = this.#field(
      document,
      "joyfox-account-label",
      "add:label",
      t("accounts.label"),
      t("accounts.labelHint"),
      false,
    );
    const submit = element(
      document,
      "button",
      "joyfox-panel__submit",
      t("accounts.add"),
    );
    submit.type = "submit";
    submit.setAttribute(FOCUS_KEY, "add:submit");
    form.append(identifier.wrapper, label.wrapper, submit);
    form.addEventListener("submit", (event) => {
      event.preventDefault();
      // A second submit while the first is saved would find the account
      // already registered and report that as an error.
      if (this.#adding) return;
      this.#adding = true;
      // Before the button is disabled, which drops its focus.
      const focus = rememberFocus(this.root);
      submit.disabled = true;
      void this.#run(async () => {
        this.#pendingRemoval = undefined;
        const account = await this.service.createAccount({
          joyClubAccountId: identifier.input.value,
          label: label.input.value,
        });
        this.#setStatus(
          message("accounts.added", { name: fullName(account) }),
          "info",
        );
        // Added: the next render starts from an empty form.
        identifier.input.value = "";
        label.input.value = "";
      }, focus).finally(() => {
        this.#adding = false;
        submit.disabled = false;
      });
    });
    return form;
  }

  #field(
    document: Document,
    id: string,
    focusKey: string,
    labelText: string,
    hintText: string,
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
    input.setAttribute(FOCUS_KEY, focusKey);
    // The hint sits under the field and is read with it.
    const hint = element(document, "span", "joyfox-panel__hint", hintText);
    hint.id = `${id}-hint`;
    input.setAttribute("aria-describedby", hint.id);
    wrapper.append(label, input, hint);
    return { wrapper, input };
  }

  #setStatus(message: Message, kind: "info" | "error"): void {
    this.#status.set(message, kind);
  }

  /**
   * Every action re-renders from storage afterwards, so the panel always shows
   * committed state rather than what the click was expected to do. `focus` is
   * the control that started it, for when its focus drops meanwhile.
   */
  async #run(
    action: () => Promise<void>,
    focus: FocusMemo | undefined = rememberFocus(this.root),
  ): Promise<void> {
    this.#focusBefore = focus;
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
    try {
      await this.render();
    } finally {
      if (this.#focusBefore === focus) this.#focusBefore = undefined;
    }
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
