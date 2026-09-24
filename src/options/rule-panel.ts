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
import { withAccountLock } from "../storage/account-lock";

type BoxName = "all" | "any";

/** The stored-rule version a click acted on, and this panel's write count. */
interface FormVersion {
  stamp: string;
  sequence: number;
}

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

const noteText = (saved: boolean) =>
  saved
    ? "A rule is saved for the active account."
    : "No rule is saved for the active account, so JoyFox does not sort the inbox.";

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
  /** The line saying whether a rule is saved, updated after an autosave. */
  #note?: HTMLParagraphElement;
  #form?: HTMLFormElement;
  /**
   * Save and remove run one after another, in click order, so a quick
   * "Save" then "Remove" can never end with the rule saved again.
   */
  #mutations: Promise<void> = Promise.resolve();
  /**
   * The stored rule's `updatedAt` the form was drawn from (`none` for no
   * rule). A save or remove checks it inside the account lock, so a form
   * left open in a second tab cannot overwrite or recreate a rule another
   * tab changed since.
   */
  #drawnStamp = "none";
  /** Writes this panel made, so a queued click can tell them from others'. */
  #ownWrites: Array<{ stamp: string; sequence: number }> = [];
  #writeSequence = 0;
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
    let account: Awaited<ReturnType<AccountService["getActiveAccount"]>>;
    let stored: Awaited<ReturnType<RuleService["getGlobalRule"]>>;
    try {
      account = await this.accounts.getActiveAccount();
      stored = account ? await this.rules.getGlobalRule(account.id) : undefined;
    } catch {
      // Only the newest render may show a failure: an older render's late
      // error must not replace a form a newer render already drew.
      if (generation === this.#generation)
        this.root.textContent =
          "JoyFox could not read the contact rule. No rule was changed.";
      return;
    }
    if (generation !== this.#generation) return;
    this.#drawnStamp = stored?.updatedAt ?? "none";
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
    this.#note = element(document, "p", "", noteText(stored !== undefined));
    this.#form = this.#renderForm(
      document,
      account.id,
      form,
      stored !== undefined,
    );
    this.root.append(this.#note, this.#form, this.#status);
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
    node.append(
      element(
        document,
        "p",
        "joyfox-panel__hint",
        "Changes are saved automatically: a box or choice at once, a number when you leave its field.",
      ),
    );
    if (saved) node.append(this.#removeButton(document, accountId));
    // Autosave: checkboxes and choices report `change` at once, a number
    // field when it loses focus or on Enter. Submitting (Enter) saves too.
    const autosave = () => {
      // Read the form now, at change time, then queue the write.
      const form = this.#readForm();
      const version = this.#version();
      void this.#serial(() => this.#save(accountId, form, version));
    };
    node.addEventListener("change", autosave);
    node.addEventListener("submit", (event) => {
      event.preventDefault();
      autosave();
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
      } else {
        // Keeps the columns in line with the rows that have a number.
        const gap = document.createElement("span");
        gap.className = "joyfox-rule__no-value";
        row.append(gap);
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

  async #save(
    accountId: string,
    form: BuilderForm | string,
    version: FormVersion,
  ): Promise<void> {
    if (typeof form === "string") {
      this.#setStatus(`${form} The rule was not saved.`, "error");
      return;
    }
    try {
      // The form belongs to the account it was drawn for. If another account
      // became active meanwhile, nothing is written to either.
      const saved = await withAccountLock(accountId, async () => {
        if (!(await this.#isActive(accountId))) return "account";
        if (!(await this.#isCurrent(accountId, version))) return "rule";
        const rule = await this.rules.saveGlobalRule(
          accountId,
          fromBuilderForm(form),
        );
        this.#recordOwnWrite(rule.updatedAt);
        // The form already shows what was saved, so it is not redrawn: a
        // redraw would move focus and drop changes made while this saved.
        this.#drawnStamp = rule.updatedAt;
        return "saved";
      });
      if (saved !== "saved") return this.#reportStale("saved", saved);
      this.#markSaved(accountId);
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

  /** After the first save, say so and offer "Remove rule", in place. */
  #markSaved(accountId: string): void {
    if (this.#note) this.#note.textContent = noteText(true);
    if (this.#form && !this.#form.querySelector(".joyfox-panel__remove"))
      this.#form.append(this.#removeButton(this.root.ownerDocument, accountId));
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
      const version = this.#version();
      void this.#serial(async () => {
        try {
          const removed = await withAccountLock(accountId, async () => {
            if (!(await this.#isActive(accountId))) return "account";
            if (!(await this.#isCurrent(accountId, version))) return "rule";
            await this.rules.deleteGlobalRule(accountId);
            this.#recordOwnWrite("none");
            return "removed";
          });
          if (removed !== "removed")
            return this.#reportStale("removed", removed);
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
   * another account stays clickable until the new render finishes. Checked
   * inside the account lock, so the answer holds for the write that follows.
   */
  async #isActive(accountId: string): Promise<boolean> {
    return (await this.accounts.getActiveAccount())?.id === accountId;
  }

  /** The form version a click acts on, captured at click time. */
  #version(): FormVersion {
    return { stamp: this.#drawnStamp, sequence: this.#writeSequence };
  }

  #recordOwnWrite(stamp: string): void {
    this.#writeSequence += 1;
    this.#ownWrites.push({ stamp, sequence: this.#writeSequence });
    // Only recent writes can matter to a queued click.
    if (this.#ownWrites.length > 20) this.#ownWrites.shift();
  }

  /**
   * Whether the stored rule is still the version the click acted on, or one
   * this panel itself wrote after that click (a quick "Save" then "Remove"
   * in the same tab). Any other change came from another tab, even if this
   * panel redrew meanwhile, so the queued write is refused.
   */
  async #isCurrent(accountId: string, version: FormVersion): Promise<boolean> {
    const stored = (await this.rules.getGlobalRule(accountId))?.updatedAt;
    const current = stored ?? "none";
    if (current === version.stamp) return true;
    return this.#ownWrites.some(
      (write) => write.sequence > version.sequence && write.stamp === current,
    );
  }

  /** Nothing was written; redraw from storage and say why. */
  async #reportStale(
    action: "saved" | "removed",
    reason: "account" | "rule",
  ): Promise<void> {
    await this.render();
    this.#setStatus(
      reason === "account"
        ? `The active account changed. The rule was not ${action}. Check the form and try again.`
        : `The rule was changed in another tab. It was not ${action}. The form now shows the saved rule.`,
      "error",
    );
  }

  /**
   * Redraw when the stored rule changed elsewhere (another options tab),
   * but not on unrelated changes, so edits in progress are kept.
   */
  async refreshIfChanged(): Promise<void> {
    const account = await this.accounts.getActiveAccount();
    const stored = account
      ? await this.rules.getGlobalRule(account.id)
      : undefined;
    if ((stored?.updatedAt ?? "none") === this.#drawnStamp) return;
    await this.render();
    this.#setStatus(
      "The rule was changed in another tab. The form now shows the saved rule.",
      "info",
    );
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
