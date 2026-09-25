import { AccountService } from "../accounts/account-service";
import {
  CONDITION_KINDS,
  CONDITION_TEXT,
  NUMERIC_CONDITION_KINDS,
  RULE_LIMITS,
  type ConditionKind,
  type ContactRuleDefinition,
  type FailPlacement,
  type UnknownHandling,
} from "../rules/contact-rule";
import {
  advancedToBuilder,
  builderToAdvanced,
  fromAdvancedForm,
  fromBuilderForm,
  MAX_ADVANCED_RULES,
  toAdvancedForm,
  toBuilderForm,
  type AdvancedEntry,
  type AdvancedForm,
  type AdvancedRule,
  type BoxEntry,
  type BuilderForm,
} from "../rules/rule-builder";
import { RuleService } from "../rules/rule-service";
import { withAccountLock } from "../storage/account-lock";

type BoxName = "all" | "any";

type EditorView = "simple" | "advanced";

/** A form read for saving: the rule, and a note on what it means. */
interface ReadRule {
  definition: ContactRuleDefinition;
  notice?: string;
}

const MATCH_TEXT: Record<"all" | "any", string> = { all: "ALL", any: "ANY" };

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

function numberInput(
  document: Document,
  kind: ConditionKind,
  value: number | undefined,
): HTMLInputElement {
  const input = document.createElement("input");
  input.type = "number";
  input.step = "1";
  input.min = String(
    kind === "minimumTrustScore" ? RULE_LIMITS.minTrustValue : 0,
  );
  input.max = String(RULE_LIMITS.maxValue);
  input.value = String(value ?? "");
  input.setAttribute("aria-label", `${CONDITION_TEXT[kind]} value`);
  return input;
}

function unknownSelect(
  document: Document,
  selected: UnknownHandling = "needs-review",
): HTMLSelectElement {
  const select = document.createElement("select");
  for (const handling of Object.keys(UNKNOWN_TEXT) as UnknownHandling[])
    select.append(
      new Option(
        UNKNOWN_TEXT[handling],
        handling,
        false,
        handling === selected,
      ),
    );
  return select;
}

function matchSelect(
  document: Document,
  selected: "all" | "any",
  label: string,
): HTMLSelectElement {
  const select = document.createElement("select");
  select.setAttribute("aria-label", label);
  for (const match of ["any", "all"] as const)
    select.append(
      new Option(MATCH_TEXT[match], match, false, match === selected),
    );
  return select;
}

/** The number in a field, or the problem in words. */
function readNumber(
  input: HTMLInputElement,
  kind: ConditionKind,
): number | string {
  const raw = input.value.trim();
  const minimum = kind === "minimumTrustScore" ? RULE_LIMITS.minTrustValue : 0;
  const value = Number(raw);
  if (
    raw === "" ||
    !Number.isSafeInteger(value) ||
    value < minimum ||
    value > RULE_LIMITS.maxValue
  )
    return `Enter a whole number from ${minimum} to ${RULE_LIMITS.maxValue} for "${CONDITION_TEXT[kind]}".`;
  return value;
}

/** A default threshold for a condition just added in the advanced editor. */
const NEW_VALUE: Partial<Record<ConditionKind, number>> = {
  minimumPhotos: 3,
  minimumProfileWords: 50,
  minimumAccountAgeDays: 180,
  minimumTrustScore: 1,
};

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
  /** The editor this panel shows, once the owner picked one. */
  #view?: EditorView;
  #editor?: HTMLElement;
  /** The advanced editor's rule list, read in order when saving. */
  #rules?: HTMLElement;
  #topMatch?: HTMLSelectElement;
  #simpleButton?: HTMLButtonElement;
  #simpleReason?: HTMLSpanElement;
  #advancedButton?: HTMLButtonElement;
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
    const simple = stored ? toBuilderForm(stored) : EMPTY_FORM;
    const advanced = stored
      ? toAdvancedForm(stored)
      : builderToAdvanced(EMPTY_FORM);
    if (!simple && !advanced) {
      this.root.append(
        element(
          document,
          "p",
          "joyfox-panel__empty",
          "This rule was made in a newer version of JoyFox and cannot be edited here. Delete it to start a new one.",
        ),
        this.#removeButton(document, account.id),
        this.#status,
      );
      return;
    }
    this.#note = element(document, "p", "", noteText(stored !== undefined));
    // The simple editor when the rule fits it, unless the owner chose the
    // advanced one. A rule saved from the advanced editor with several
    // rules does not read as two boxes, so it opens there again.
    const view: EditorView =
      simple && (this.#view !== "advanced" || !advanced)
        ? "simple"
        : "advanced";
    this.#form = this.#renderForm(
      document,
      account.id,
      view === "simple" && simple
        ? { view, form: simple }
        : { view: "advanced", form: advanced! },
      stored !== undefined,
    );
    this.root.append(this.#note, this.#form, this.#status);
  }

  #renderForm(
    document: Document,
    accountId: string,
    shown:
      | { view: "simple"; form: BuilderForm }
      | { view: "advanced"; form: AdvancedForm },
    saved: boolean,
  ): HTMLFormElement {
    const { form } = shown;
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

    this.#editor = element(document, "div", "joyfox-rule__editor");
    node.append(
      enabledLabel,
      placementWrapper,
      this.#renderSwitch(document),
      this.#editor,
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
    this.#autosave = () => {
      // Read the form now, at change time, then queue the write.
      const form = this.#readForm();
      const version = this.#version();
      void this.#serial(() => this.#save(accountId, form, version));
    };
    node.addEventListener("change", (event) => {
      // Adding a condition is a change of its own, handled by its select.
      if ((event.target as Element).matches(".joyfox-rule__add-condition"))
        return;
      this.#updateSimpleReason();
      this.#autosave();
    });
    node.addEventListener("submit", (event) => {
      event.preventDefault();
      this.#autosave();
    });
    if (shown.view === "simple") this.#showSimple(document, shown.form);
    else this.#showAdvanced(document, shown.form);
    return node;
  }

  #autosave: () => void = () => undefined;

  /** The Simple / Advanced switch, and why Simple is not available. */
  #renderSwitch(document: Document): HTMLElement {
    const row = element(document, "div", "joyfox-rule__switch-row");
    const label = element(document, "span", "", "Editor:");
    label.id = "joyfox-rule-editor-label";
    const group = element(document, "div", "joyfox-rule__switch");
    group.setAttribute("role", "group");
    group.setAttribute("aria-labelledby", label.id);
    const button = (text: string, view: EditorView) => {
      const node = element(document, "button", "", text);
      node.type = "button";
      node.dataset.view = view;
      node.addEventListener("click", () => this.#switchTo(document, view));
      group.append(node);
      return node;
    };
    this.#simpleButton = button("Simple", "simple");
    this.#advancedButton = button("Advanced", "advanced");
    this.#simpleReason = element(document, "span", "joyfox-rule__simple-why");
    this.#simpleReason.id = "joyfox-rule-simple-why";
    this.#simpleButton.setAttribute("aria-describedby", this.#simpleReason.id);
    row.append(label, group, this.#simpleReason);
    return row;
  }

  #switchTo(document: Document, view: EditorView): void {
    const current = this.#rules ? "advanced" : "simple";
    if (view === current) return;
    if (view === "advanced") {
      const form = this.#readSimple();
      if (typeof form === "string") return this.#setStatus(form, "error");
      this.#view = "advanced";
      this.#showAdvanced(document, builderToAdvanced(form));
      return;
    }
    const advanced = this.#readAdvanced();
    if (typeof advanced === "string") return this.#setStatus(advanced, "error");
    const form = advancedToBuilder(advanced);
    if (typeof form === "string") return this.#setStatus(form, "error");
    this.#view = "simple";
    this.#showSimple(document, form);
  }

  #markView(view: EditorView): void {
    this.#simpleButton?.setAttribute("aria-pressed", String(view === "simple"));
    this.#advancedButton?.setAttribute(
      "aria-pressed",
      String(view === "advanced"),
    );
    if (view === "simple") this.#setSimpleReason(undefined);
  }

  /** Simple stays offered only while the advanced rule fits two boxes. */
  #setSimpleReason(reason: string | undefined): void {
    if (this.#simpleButton) this.#simpleButton.disabled = reason !== undefined;
    if (this.#simpleReason) this.#simpleReason.textContent = reason ?? "";
  }

  #showSimple(document: Document, form: BuilderForm): void {
    this.#controls = new Map();
    this.#rules = undefined;
    this.#topMatch = undefined;
    this.#editor?.replaceChildren(
      this.#renderBox(document, "all", form.all),
      this.#renderBox(document, "any", form.any),
    );
    this.#markView("simple");
  }

  #showAdvanced(document: Document, form: AdvancedForm): void {
    this.#controls = new Map();
    const intro = element(document, "p", "joyfox-rule__combine");
    const top = matchSelect(document, form.match, "How the rules combine");
    top.id = "joyfox-rule-top-match";
    top.addEventListener("change", () => this.#renumber());
    this.#topMatch = top;
    intro.append(
      element(document, "strong", "", "A sender is qualified if "),
      top,
      element(document, "strong", "", " of these rules match."),
    );
    const hint = element(
      document,
      "p",
      "joyfox-panel__hint",
      'Each rule is met when ALL or ANY of its conditions are met, as you choose. Tick "not" to turn a condition around: "not Minimum photos 3" means fewer than 3 photos. A rule without conditions is not saved.',
    );
    const rules = element(document, "div", "joyfox-rule__rules");
    this.#rules = rules;
    for (const rule of form.rules.length > 0
      ? form.rules
      : [{ match: "all" as const, conditions: {} }])
      rules.append(this.#renderRule(document, rule));
    const add = element(
      document,
      "button",
      "joyfox-rule__add-rule",
      "+ Add rule",
    );
    add.type = "button";
    add.addEventListener("click", () => {
      rules.append(
        this.#renderRule(document, { match: "all", conditions: {} }),
      );
      this.#renumber();
      rules.lastElementChild
        ?.querySelector<HTMLSelectElement>(".joyfox-rule__add-condition")
        ?.focus();
    });
    const count = element(document, "span", "joyfox-rule__rule-count");
    const addRow = element(document, "div", "joyfox-rule__add-row");
    addRow.append(add, count);
    this.#editor?.replaceChildren(intro, hint, rules, addRow);
    this.#markView("advanced");
    this.#renumber();
  }

  #renderRule(document: Document, rule: AdvancedRule): HTMLElement {
    const fieldset = element(document, "fieldset", "joyfox-rule__box");
    fieldset.dataset.rule = "";
    const head = element(document, "legend", "joyfox-rule__rule-head");
    const title = element(document, "strong", "joyfox-rule__rule-title");
    const match = matchSelect(document, rule.match, "");
    match.className = "joyfox-rule__rule-match";
    const remove = element(
      document,
      "button",
      "joyfox-panel__remove joyfox-rule__remove-rule",
      "Remove rule",
    );
    remove.type = "button";
    remove.addEventListener("click", () => {
      fieldset.remove();
      this.#renumber();
      this.#autosave();
    });
    head.append(
      title,
      match,
      element(document, "strong", "", " of these are met"),
      remove,
    );
    const list = element(document, "div", "joyfox-rule__conditions");
    const empty = element(
      document,
      "p",
      "joyfox-panel__hint joyfox-rule__empty",
      "No conditions yet. Add one below.",
    );
    for (const kind of CONDITION_KINDS) {
      const entry = rule.conditions[kind];
      if (entry) list.append(this.#renderCondition(document, kind, entry));
    }
    const add = document.createElement("select");
    add.className = "joyfox-rule__add-condition";
    add.addEventListener("change", () => {
      const kind = add.value as ConditionKind;
      add.value = "";
      if (!CONDITION_KINDS.includes(kind)) return;
      const row = this.#renderCondition(document, kind, {
        whenUnknown: "needs-review",
        ...(NUMERIC_CONDITION_KINDS.has(kind)
          ? { value: NEW_VALUE[kind] }
          : {}),
      });
      list.append(row);
      this.#renumber();
      row.querySelector<HTMLElement>("input[type=number], select")?.focus();
      this.#autosave();
    });
    fieldset.append(head, list, empty, add);
    return fieldset;
  }

  #renderCondition(
    document: Document,
    kind: ConditionKind,
    entry: AdvancedEntry,
  ): HTMLElement {
    const row = element(
      document,
      "div",
      "joyfox-rule__condition joyfox-rule__condition--advanced",
    );
    row.dataset.kind = kind;
    const remove = element(
      document,
      "button",
      "joyfox-panel__remove joyfox-rule__remove-condition",
      "✕",
    );
    remove.type = "button";
    remove.title = "Remove condition";
    remove.setAttribute("aria-label", `Remove ${CONDITION_TEXT[kind]}`);
    remove.addEventListener("click", () => {
      row.remove();
      this.#renumber();
      this.#autosave();
    });
    // "not" is quiet until ticked, then marked in the danger colour and in
    // bold, so a turned-around condition stands out.
    const notLabel = element(document, "label", "joyfox-rule__not");
    const not = document.createElement("input");
    not.type = "checkbox";
    not.className = "joyfox-rule__negate";
    not.checked = entry.negate === true;
    not.setAttribute(
      "aria-label",
      `not: turn "${CONDITION_TEXT[kind]}" around`,
    );
    notLabel.title = "Turn this condition around";
    notLabel.append(not, document.createTextNode("not"));
    const mark = () =>
      notLabel.classList.toggle("joyfox-rule__not--on", not.checked);
    not.addEventListener("change", mark);
    mark();
    row.append(
      remove,
      notLabel,
      element(document, "span", "joyfox-rule__name", CONDITION_TEXT[kind]),
    );
    if (NUMERIC_CONDITION_KINDS.has(kind))
      row.append(numberInput(document, kind, entry.value));
    else row.append(element(document, "span", "joyfox-rule__no-value"));
    const unknown = unknownSelect(document, entry.whenUnknown);
    unknown.className = "joyfox-rule__unknown";
    unknown.setAttribute(
      "aria-label",
      `${CONDITION_TEXT[kind]}: if JoyFox cannot see this`,
    );
    row.append(
      element(
        document,
        "span",
        "joyfox-rule__unknown-label",
        "If JoyFox cannot see this:",
      ),
      unknown,
    );
    return row;
  }

  /**
   * After a rule or condition is added or removed: number the rules, show
   * AND or OR between them, and offer only the conditions a rule lacks.
   */
  #renumber(): void {
    const rules = this.#rules;
    if (!rules) return;
    const document = rules.ownerDocument;
    const fieldsets = Array.from(
      rules.querySelectorAll<HTMLElement>(":scope > [data-rule]"),
    );
    rules
      .querySelectorAll(":scope > .joyfox-rule__joiner")
      .forEach((node) => node.remove());
    const joiner = this.#topMatch?.value === "all" ? "AND" : "OR";
    fieldsets.forEach((fieldset, index) => {
      const number = index + 1;
      if (index > 0)
        fieldset.before(element(document, "p", "joyfox-rule__joiner", joiner));
      fieldset.querySelector(".joyfox-rule__rule-title")!.textContent =
        `Rule ${number}: met if `;
      fieldset
        .querySelector(".joyfox-rule__rule-match")!
        .setAttribute(
          "aria-label",
          `How rule ${number} combines its conditions`,
        );
      const remove = fieldset.querySelector<HTMLButtonElement>(
        ".joyfox-rule__remove-rule",
      )!;
      remove.disabled = fieldsets.length === 1;
      remove.setAttribute("aria-label", `Remove rule ${number}`);
      const used = new Set(
        Array.from(
          fieldset.querySelectorAll<HTMLElement>("[data-kind]"),
          (row) => row.dataset.kind,
        ),
      );
      (fieldset.querySelector(".joyfox-rule__empty") as HTMLElement).hidden =
        used.size > 0;
      const add = fieldset.querySelector<HTMLSelectElement>(
        ".joyfox-rule__add-condition",
      )!;
      add.setAttribute("aria-label", `Add a condition to rule ${number}`);
      add.replaceChildren(new Option("+ Add condition…", "", true, true));
      for (const kind of CONDITION_KINDS)
        if (!used.has(kind)) add.append(new Option(CONDITION_TEXT[kind], kind));
      add.hidden = used.size === CONDITION_KINDS.length;
    });
    const button = this.#editor?.querySelector<HTMLButtonElement>(
      ".joyfox-rule__add-rule",
    );
    if (button) button.disabled = fieldsets.length >= MAX_ADVANCED_RULES;
    const count = this.#editor?.querySelector(".joyfox-rule__rule-count");
    if (count)
      count.textContent = `${fieldsets.length} of ${MAX_ADVANCED_RULES} rules`;
    this.#updateSimpleReason();
  }

  #updateSimpleReason(): void {
    const form = this.#readAdvanced();
    if (typeof form === "string") return;
    const simple = advancedToBuilder(form);
    this.#setSimpleReason(typeof simple === "string" ? simple : undefined);
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

  /** Read the shown editor, or return the first problem in words. */
  #readForm(): ReadRule | string {
    if (this.#rules) {
      const form = this.#readAdvanced();
      if (typeof form === "string") return form;
      const definition = fromAdvancedForm(form);
      return {
        definition,
        ...(definition.root.children.length === 0
          ? {
              notice:
                "Rule saved. It has no conditions yet, so every sender qualifies.",
            }
          : {}),
      };
    }
    const form = this.#readSimple();
    if (typeof form === "string") return form;
    const vacuous =
      Object.keys(form.all).length === 0 && Object.keys(form.any).length > 0;
    return {
      definition: fromBuilderForm(form),
      ...(vacuous
        ? {
            notice:
              "Rule saved. With nothing in the ALL box, every sender qualifies, so the ANY box has no effect.",
          }
        : {}),
    };
  }

  #readSimple(): BuilderForm | string {
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
          const value = readNumber(controls.value, kind);
          if (typeof value === "string") return value;
          entry.value = value;
        }
        form[box][kind] = entry;
      }
    return form;
  }

  #readAdvanced(): AdvancedForm | string {
    const form: AdvancedForm = {
      enabled: this.#enabled?.checked ?? true,
      defaultPlacement: (this.#placement?.value ??
        "quarantined") as FailPlacement,
      match: this.#topMatch?.value === "all" ? "all" : "any",
      rules: [],
    };
    const fieldsets = this.#rules
      ? Array.from(
          this.#rules.querySelectorAll<HTMLElement>(":scope > [data-rule]"),
        )
      : [];
    for (const fieldset of fieldsets) {
      const match = fieldset.querySelector<HTMLSelectElement>(
        ".joyfox-rule__rule-match",
      )?.value;
      const rule: AdvancedRule = {
        match: match === "any" ? "any" : "all",
        conditions: {},
      };
      for (const row of Array.from(
        fieldset.querySelectorAll<HTMLElement>("[data-kind]"),
      )) {
        const kind = row.dataset.kind as ConditionKind;
        const entry: AdvancedEntry = {
          whenUnknown: row.querySelector<HTMLSelectElement>(
            ".joyfox-rule__unknown",
          )!.value as UnknownHandling,
        };
        if (
          row.querySelector<HTMLInputElement>(".joyfox-rule__negate")?.checked
        )
          entry.negate = true;
        const input = row.querySelector<HTMLInputElement>("input[type=number]");
        if (input) {
          const value = readNumber(input, kind);
          if (typeof value === "string") return value;
          entry.value = value;
        }
        rule.conditions[kind] = entry;
      }
      form.rules.push(rule);
    }
    return form;
  }

  async #save(
    accountId: string,
    form: ReadRule | string,
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
          form.definition,
        );
        this.#recordOwnWrite(rule.updatedAt);
        // The form already shows what was saved, so it is not redrawn: a
        // redraw would move focus and drop changes made while this saved.
        this.#drawnStamp = rule.updatedAt;
        return "saved";
      });
      if (saved !== "saved") return this.#reportStale("saved", saved);
      this.#markSaved(accountId);
      this.#setStatus(
        form.notice ?? "Rule saved. Open JoyClub tabs update at once.",
        "info",
      );
    } catch {
      this.#setStatus(
        "JoyFox could not save the rule. Nothing was changed.",
        "error",
      );
    }
  }

  /** After the first save, say so and offer to delete the rule, in place. */
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
      "Delete whole contact rule",
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
