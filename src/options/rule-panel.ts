import { AccountService } from "../accounts/account-service";
import {
  CONDITION_KINDS,
  CONDITION_TEXT,
  NUMERIC_CONDITION_KINDS,
  RULE_LIMITS,
  type ConditionKind,
  type FailPlacement,
  type UnknownHandling,
} from "../rules/contact-rule";
import {
  fromBuilderForm,
  toBuilderForm,
  type BoxEntry,
  type BuilderForm,
} from "../rules/rule-builder";
import { RuleService } from "../rules/rule-service";

type BoxName = "all" | "any";

const BOX_LEGEND: Record<BoxName, string> = {
  all: "A sender qualifies when ALL of these are met",
  any: "Or a sender qualifies when ANY of these is met",
};

const UNKNOWN_TEXT: Record<UnknownHandling, string> = {
  "needs-review": "Send to Needs Review",
  met: "Count as met",
  "not-met": "Count as not met",
};

const EMPTY_FORM: BuilderForm = {
  enabled: true,
  defaultPlacement: "quarantined",
  all: {},
  any: {},
};

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

interface ConditionControls {
  on: HTMLInputElement;
  value?: HTMLInputElement;
  unknown: HTMLSelectElement;
}

/**
 * The M4 rule builder: one global contact rule for the active account, shown
 * as PRD Section 11.5's two boxes in plain language, never as logic
 * notation. Every condition states what happens when JoyFox cannot see its
 * fact (build plan Section 11). Saving re-evaluates open JoyClub tabs at
 * once through the triage revision.
 */
export class RulePanel {
  readonly #status: HTMLParagraphElement;
  #controls = new Map<string, ConditionControls>();
  #enabled?: HTMLInputElement;
  #placement?: HTMLSelectElement;
  /**
   * Save and remove run one after another, in click order, so a quick
   * "Save" then "Remove" can never end with the rule saved again.
   */
  #mutations: Promise<void> = Promise.resolve();
  /** Bumped per render, so a slower, older render never replaces a newer one. */
  #generation = 0;

  constructor(
    private readonly root: HTMLElement,
    private readonly rules = new RuleService(),
    private readonly accounts = new AccountService(),
  ) {
    this.#status = root.ownerDocument.createElement("p");
    this.#status.className = "joyfox-panel__status";
    this.#status.setAttribute("aria-live", "polite");
  }

  async render(): Promise<void> {
    const generation = (this.#generation += 1);
    const document = this.root.ownerDocument;
    // Read everything first, then build: storage reads are the only awaits,
    // and a render overtaken by a newer one (for example after an account
    // switch) stops here without touching the page.
    const account = await this.accounts.getActiveAccount();
    const stored = account
      ? await this.rules.getGlobalRule(account.id)
      : undefined;
    if (generation !== this.#generation) return;
    this.root.replaceChildren();
    this.#controls = new Map();
    const heading = element(
      document,
      "h2",
      "joyfox-panel__heading",
      "Contact rule",
    );
    heading.id = "joyfox-rule-heading";
    this.root.setAttribute("aria-labelledby", heading.id);
    this.root.append(heading);
    this.root.append(
      element(
        document,
        "p",
        "joyfox-panel__hint",
        "The rule only changes how JoyFox groups your own inbox into Qualified, Needs Review and Quarantined. It never stops a message, never deletes anything, and the sender sees nothing.",
      ),
    );
    if (!account) {
      this.root.append(
        element(
          document,
          "p",
          "joyfox-panel__empty",
          "Select or add an account first. Each account has its own rule.",
        ),
        this.#status,
      );
      return;
    }
    const form = stored ? toBuilderForm(stored) : EMPTY_FORM;
    if (!form) {
      this.root.append(
        element(
          document,
          "p",
          "joyfox-panel__empty",
          "This rule was made in a newer version of JoyFox and cannot be edited here. Remove it to start a new one.",
        ),
        this.#removeButton(document, account.id),
        this.#status,
      );
      return;
    }
    this.root.append(
      element(
        document,
        "p",
        "",
        stored
          ? "A rule is saved for the active account."
          : "No rule is saved for the active account, so JoyFox does not sort the inbox.",
      ),
      this.#renderForm(document, account.id, form, stored !== undefined),
      this.#status,
    );
  }

  #renderForm(
    document: Document,
    accountId: string,
    form: BuilderForm,
    saved: boolean,
  ): HTMLFormElement {
    const node = element(document, "form", "joyfox-panel__form");
    node.setAttribute("aria-label", "Contact rule");

    const enabledLabel = element(document, "label", "joyfox-rule__toggle");
    const enabled = document.createElement("input");
    enabled.type = "checkbox";
    enabled.checked = form.enabled;
    enabled.id = "joyfox-rule-enabled";
    enabledLabel.append(
      enabled,
      document.createTextNode(" Sort my JoyClub inbox with this rule"),
    );
    this.#enabled = enabled;

    const placementWrapper = element(document, "div", "joyfox-panel__field");
    const placementLabel = element(
      document,
      "label",
      "",
      "A sender who does not meet the rule goes to",
    );
    placementLabel.htmlFor = "joyfox-rule-placement";
    const placement = document.createElement("select");
    placement.id = "joyfox-rule-placement";
    for (const [value, text] of [
      ["quarantined", "Quarantined"],
      ["needs-review", "Needs Review"],
    ] as const)
      placement.append(
        new Option(text, value, false, value === form.defaultPlacement),
      );
    placementWrapper.append(placementLabel, placement);
    this.#placement = placement;

    node.append(
      enabledLabel,
      placementWrapper,
      this.#renderBox(document, "all", form.all),
      this.#renderBox(document, "any", form.any),
      element(
        document,
        "p",
        "joyfox-panel__hint",
        'Spam status is unknown for now: JoyFox does not read message text yet. Only your own "not spam" corrections count. The inbox shows only the verification shield; photos, profile words and account age come from profiles you opened before.',
      ),
    );
    const submit = element(
      document,
      "button",
      "joyfox-panel__submit",
      "Save rule",
    );
    submit.type = "submit";
    node.append(submit);
    if (saved) node.append(this.#removeButton(document, accountId));
    node.addEventListener("submit", (event) => {
      event.preventDefault();
      // Read the form now, at click time, then queue the write.
      const form = this.#readForm();
      void this.#serial(() => this.#save(accountId, form));
    });
    return node;
  }

  #renderBox(
    document: Document,
    box: BoxName,
    entries: Partial<Record<ConditionKind, BoxEntry>>,
  ): HTMLFieldSetElement {
    const fieldset = element(document, "fieldset", "joyfox-rule__box");
    fieldset.append(element(document, "legend", "", BOX_LEGEND[box]));
    for (const kind of CONDITION_KINDS) {
      const entry = entries[kind];
      const id = `joyfox-rule-${box}-${kind}`;
      const row = element(document, "div", "joyfox-rule__condition");
      const on = document.createElement("input");
      on.type = "checkbox";
      on.id = `${id}-on`;
      on.checked = entry !== undefined;
      const label = element(document, "label", "", CONDITION_TEXT[kind]);
      label.htmlFor = on.id;
      row.append(on, label);
      const controls: ConditionControls = {
        on,
        unknown: document.createElement("select"),
      };
      if (NUMERIC_CONDITION_KINDS.has(kind)) {
        const value = document.createElement("input");
        value.type = "number";
        value.step = "1";
        value.min = String(
          kind === "minimumTrustScore" ? RULE_LIMITS.minTrustValue : 0,
        );
        value.max = String(RULE_LIMITS.maxValue);
        value.id = `${id}-value`;
        value.value = String(entry?.value ?? "");
        value.setAttribute("aria-label", `${CONDITION_TEXT[kind]} value`);
        controls.value = value;
        row.append(value);
      }
      const unknownLabel = element(
        document,
        "label",
        "",
        "If JoyFox cannot see this:",
      );
      unknownLabel.htmlFor = `${id}-unknown`;
      controls.unknown.id = `${id}-unknown`;
      for (const handling of Object.keys(UNKNOWN_TEXT) as UnknownHandling[])
        controls.unknown.append(
          new Option(
            UNKNOWN_TEXT[handling],
            handling,
            false,
            handling === (entry?.whenUnknown ?? "needs-review"),
          ),
        );
      row.append(unknownLabel, controls.unknown);
      this.#controls.set(`${box}:${kind}`, controls);
      fieldset.append(row);
    }
    return fieldset;
  }

  /** Read the form, or return the first problem in words. */
  #readForm(): BuilderForm | string {
    const form: BuilderForm = {
      enabled: this.#enabled?.checked ?? true,
      defaultPlacement: (this.#placement?.value ??
        "quarantined") as FailPlacement,
      all: {},
      any: {},
    };
    for (const box of ["all", "any"] as const)
      for (const kind of CONDITION_KINDS) {
        const controls = this.#controls.get(`${box}:${kind}`);
        if (!controls?.on.checked) continue;
        const entry: BoxEntry = {
          whenUnknown: controls.unknown.value as UnknownHandling,
        };
        if (controls.value) {
          const raw = controls.value.value.trim();
          const minimum =
            kind === "minimumTrustScore" ? RULE_LIMITS.minTrustValue : 0;
          const value = Number(raw);
          if (
            raw === "" ||
            !Number.isSafeInteger(value) ||
            value < minimum ||
            value > RULE_LIMITS.maxValue
          )
            return `Enter a whole number from ${minimum} to ${RULE_LIMITS.maxValue} for "${CONDITION_TEXT[kind]}".`;
          entry.value = value;
        }
        form[box][kind] = entry;
      }
    return form;
  }

  async #save(accountId: string, form: BuilderForm | string): Promise<void> {
    if (typeof form === "string") {
      this.#setStatus(`${form} The rule was not saved.`, "error");
      return;
    }
    try {
      // The form belongs to the account it was drawn for. If another account
      // became active meanwhile, nothing is written to either.
      if (!(await this.#confirmAccount(accountId, "saved"))) return;
      await this.rules.saveGlobalRule(accountId, fromBuilderForm(form));
      await this.render();
      const vacuous =
        Object.keys(form.all).length === 0 && Object.keys(form.any).length > 0;
      this.#setStatus(
        vacuous
          ? "Rule saved. With nothing in the ALL box, every sender qualifies, so the ANY box has no effect."
          : "Rule saved. Open JoyClub tabs update at once.",
        "info",
      );
    } catch {
      this.#setStatus(
        "JoyFox could not save the rule. Nothing was changed.",
        "error",
      );
    }
  }

  #removeButton(document: Document, accountId: string): HTMLButtonElement {
    const button = element(
      document,
      "button",
      "joyfox-panel__remove",
      "Remove rule",
    );
    button.type = "button";
    button.addEventListener("click", () => {
      void this.#serial(async () => {
        try {
          if (!(await this.#confirmAccount(accountId, "removed"))) return;
          await this.rules.deleteGlobalRule(accountId);
          await this.render();
          this.#setStatus(
            "Rule removed. JoyFox no longer sorts the inbox for this account.",
            "info",
          );
        } catch {
          this.#setStatus(
            "JoyFox could not remove the rule. Nothing was changed.",
            "error",
          );
        }
      });
    });
    return button;
  }

  /**
   * Whether the form's account is still the active one. A form drawn for
   * another account stays clickable until the new render finishes; if it
   * is stale, nothing is written to either account and the form is redrawn.
   */
  async #confirmAccount(
    accountId: string,
    action: "saved" | "removed",
  ): Promise<boolean> {
    if ((await this.accounts.getActiveAccount())?.id === accountId) return true;
    await this.render();
    this.#setStatus(
      `The active account changed. The rule was not ${action}. Check the form and try again.`,
      "error",
    );
    return false;
  }

  #serial(action: () => Promise<void>): Promise<void> {
    const run = this.#mutations.then(action);
    this.#mutations = run.catch(() => undefined);
    return run;
  }

  #setStatus(text: string, kind: "info" | "error"): void {
    this.#status.dataset.kind = kind;
    this.#status.setAttribute("role", kind === "error" ? "alert" : "status");
    this.#status.textContent = text;
  }
}
