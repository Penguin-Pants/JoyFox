import { AccountService } from "../accounts/account-service";
import type { PlainKey } from "../i18n/catalog/en";
import { message, type Message } from "../i18n/message";
import { t } from "../i18n/translator";
import {
  CONDITION_KINDS,
  CONDITION_TEXT,
  NUMERIC_CONDITION_KINDS,
  PLACEMENT_TEXT,
  RULE_LIMITS,
  TEXT_CONDITION_KINDS,
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
  isProblem,
  MAX_ADVANCED_RULES,
  toAdvancedForm,
  toBuilderForm,
  type AdvancedEntry,
  type AdvancedForm,
  type AdvancedRule,
  type BoxEntry,
  type BuilderForm,
} from "../rules/rule-builder";
import {
  MAX_NORMALIZED_PHRASE_LENGTH,
  normalizePhrase,
} from "../rules/message-phrase";
import {
  COMPLETE_PROFILE,
  HIGH_TRUST_ACCOUNT_DAYS,
  isRulePresetId,
  PRESET_TEXT,
  presetForm,
  RULE_PRESET_IDS,
  type RulePresetId,
} from "../rules/presets";
import { RuleService } from "../rules/rule-service";
import { withAccountLock } from "../storage/account-lock";
import { FOCUS_KEY, rememberFocus, restoreFocus } from "../ui/focus";
import { confirmAllowed, confirmTiming } from "./confirm";
import { StatusLine } from "./status-line";

type BoxName = "all" | "any";

type EditorView = "simple" | "advanced";

/** A form read for saving: the rule, and a note on what it means. */
interface ReadRule {
  definition: ContactRuleDefinition;
  notice?: Message;
}

/** Whether a read answered with the problem instead of a value. */
const failed = <T extends object>(value: T | Message): value is Message =>
  "key" in value;

const MATCH_TEXT: Record<"all" | "any", PlainKey> = {
  all: "rule.match.all",
  any: "rule.match.any",
};

/** The stored-rule version a click acted on, and this panel's write count. */
interface FormVersion {
  stamp: string;
  sequence: number;
}

const BOX_LEGEND: Record<BoxName, PlainKey> = {
  all: "rule.box.all",
  any: "rule.box.any",
};

const UNKNOWN_TEXT: Record<UnknownHandling, PlainKey> = {
  "needs-review": "rule.unknown.needs-review",
  met: "rule.unknown.met",
  "not-met": "rule.unknown.not-met",
};

const EMPTY_FORM: BuilderForm = {
  enabled: true,
  defaultPlacement: "quarantined",
  all: {},
  any: {},
};

const noteText = (saved: boolean) =>
  t(saved ? "rule.note.saved" : "rule.note.none");

/** A condition's name, as a param of another message. */
const conditionName = (kind: ConditionKind) => message(CONDITION_TEXT[kind]);

/** The smallest number a condition takes. */
const numberMinimum = (kind: ConditionKind) =>
  kind === "minimumTrustScore" ? RULE_LIMITS.minTrustValue : 0;

/** The fields that hold a condition's number or text, in both editors. */
const VALUE_FIELDS = "input[type=number], input.joyfox-rule__text";

/**
 * An Advanced condition row. A status line in a group carries `data-kind`
 * too (its state), so the class keeps it out.
 */
const CONDITION_ROW = ".joyfox-rule__condition[data-kind]";

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
  text?: HTMLInputElement;
  unknown: HTMLSelectElement;
}

/**
 * A Simple row's fields follow its box: an unticked condition does not
 * count, so nothing can be typed or chosen for it.
 */
function followBox(controls: ConditionControls): void {
  for (const field of [controls.value, controls.text, controls.unknown])
    if (field) field.disabled = !controls.on.checked;
}

/**
 * JoyFox does not check messages for templates yet (`rule.spamHint`), so
 * "Not flagged as template spam" is always unknown. The row says so.
 */
function spamNote(document: Document, id: string): HTMLSpanElement {
  const note = element(
    document,
    "span",
    "joyfox-rule__condition-note",
    t("rule.spamNote"),
  );
  note.id = id;
  return note;
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
  input.dataset.condition = kind;
  input.setAttribute(
    "aria-label",
    t("rule.valueLabel", { condition: conditionName(kind) }),
  );
  return input;
}

/** The word, phrase or emoji field of a text condition. */
function textInput(
  document: Document,
  kind: ConditionKind,
  text: string | undefined,
): HTMLInputElement {
  const input = document.createElement("input");
  input.type = "text";
  input.className = "joyfox-rule__text";
  input.maxLength = RULE_LIMITS.maxTextLength;
  input.placeholder = t("rule.textPlaceholder");
  input.autocomplete = "off";
  input.spellcheck = false;
  input.value = text ?? "";
  input.dataset.condition = kind;
  input.setAttribute(
    "aria-label",
    t("rule.textLabel", { condition: conditionName(kind) }),
  );
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
        t(UNKNOWN_TEXT[handling]),
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
      new Option(t(MATCH_TEXT[match]), match, false, match === selected),
    );
  return select;
}

/** The number in a field, or the problem as a message. */
function readNumber(
  input: HTMLInputElement,
  kind: ConditionKind,
): number | Message {
  const raw = input.value.trim();
  const minimum = numberMinimum(kind);
  const value = Number(raw);
  if (
    raw === "" ||
    !Number.isSafeInteger(value) ||
    value < minimum ||
    value > RULE_LIMITS.maxValue
  )
    return message("rule.numberProblem", {
      minimum,
      maximum: RULE_LIMITS.maxValue,
      condition: conditionName(kind),
    });
  return value;
}

/**
 * Read a number field for a redraw: a value that is not valid yet reads as
 * none, and the redraw puts back what was typed.
 */
const numberOrNone = (value: number | Message) =>
  typeof value === "number" ? value : undefined;

/** The trimmed text in a field, or the problem as a message. */
function readText(
  input: HTMLInputElement,
  kind: ConditionKind,
): { text: string } | Message {
  const text = input.value.trim();
  const phrase = normalizePhrase(text);
  if (
    phrase.length === 0 ||
    phrase.length > MAX_NORMALIZED_PHRASE_LENGTH ||
    text.length > RULE_LIMITS.maxTextLength
  )
    return message("rule.textProblem", {
      maximum: RULE_LIMITS.maxTextLength,
      condition: conditionName(kind),
    });
  return { text };
}

/**
 * A default threshold for a condition just added in the advanced editor, or
 * ticked with an empty field in the simple one.
 */
const NEW_VALUE: Partial<Record<ConditionKind, number>> = {
  minimumPhotos: 3,
  minimumProfileWords: 50,
  minimumAccountAgeDays: 180,
  minimumTrustScore: 1,
};

/** What a preset sets, in words, shown under the preset choice. */
function presetDescription(id: RulePresetId): string {
  const { photos, words } = COMPLETE_PROFILE;
  switch (id) {
    case "open":
      return t("rule.preset.describe.open");
    case "complete":
      return t("rule.preset.describe.complete", { photos, words });
    case "verified":
      return t("rule.preset.describe.verified");
    case "highTrust":
      return t("rule.preset.describe.highTrust", {
        photos,
        words,
        days: HIGH_TRUST_ACCOUNT_DAYS,
      });
    case "custom":
      return t("rule.preset.describe.custom");
  }
}

/** The status after a preset is saved. */
function presetNotice(id: RulePresetId): Message {
  if (id === "open") return message("rule.preset.appliedOpen");
  if (id === "custom") return message("rule.preset.appliedCustom");
  return message("rule.preset.applied", { preset: message(PRESET_TEXT[id]) });
}

/**
 * The M4 rule builder: one global contact rule for the active account, shown
 * as PRD Section 11.5's two boxes in plain language, never as logic
 * notation. Every condition states what happens when JoyFox cannot see its
 * fact (build plan Section 11). Saving re-evaluates open JoyClub tabs at
 * once through the triage revision.
 */
export class RulePanel {
  readonly #status: StatusLine;
  /**
   * The prompt and failures of "Delete whole contact rule", right under the
   * button at the end of the form, where the user is when they click it.
   */
  readonly #deleteLine: StatusLine;
  /**
   * The button that waits for its second click (a preset that replaces
   * conditions, removing a group, deleting the whole rule), when it was
   * armed, and how to put it back. Any other click or change disarms it.
   */
  #armed?: { button: HTMLButtonElement; at: number; disarm: () => void };
  /** Each number or text field's note: why a save refuses it, or a hint. */
  #notes = new WeakMap<HTMLInputElement, HTMLElement>();
  /** Makes each note's ID unique, for `aria-describedby`. */
  #noteCount = 0;
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
  /** The account the panel was drawn for, and whether a rule is saved. */
  #accountId?: string;
  #saved = false;
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
    this.#status = new StatusLine(root.ownerDocument);
    this.#deleteLine = new StatusLine(root.ownerDocument);
    this.#deleteLine.node.classList.add("joyfox-rule__prompt");
    // Any other action disarms a button that waits for its second click,
    // so that click can never act on what the user saw before.
    root.addEventListener("click", (event) => {
      if (this.#armed && !this.#armed.button.contains(event.target as Node))
        this.#disarm();
    });
    root.addEventListener("change", () => this.#disarm());
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
        this.root.textContent = t("rule.readFailed");
      return;
    }
    if (generation !== this.#generation) return;
    // Another account's status (a save, a refusal) must never carry over:
    // it would contradict the note drawn for this account.
    if (account?.id !== this.#accountId) {
      this.#status.clear();
      this.#deleteLine.clear();
    }
    this.#accountId = account?.id;
    this.#drawnStamp = stored?.updatedAt ?? "none";
    this.#saved = stored !== undefined;
    if (!account) {
      this.#drawShell(document);
      this.root.append(
        element(document, "p", "joyfox-panel__empty", t("rule.noAccount")),
        this.#status.node,
      );
      return;
    }
    const simple = stored ? toBuilderForm(stored) : EMPTY_FORM;
    const advanced = stored
      ? toAdvancedForm(stored)
      : builderToAdvanced(EMPTY_FORM);
    if (!simple && !advanced) {
      this.#drawShell(document);
      this.root.append(
        element(document, "p", "joyfox-panel__empty", t("rule.newer")),
        this.#status.node,
        this.#removeButton(document, account.id),
        this.#deleteLine.node,
      );
      return;
    }
    // The simple editor when the rule fits it, unless the owner chose the
    // advanced one. A rule saved from the advanced editor with several
    // rules does not read as two boxes, so it opens there again.
    const view: EditorView =
      simple && (this.#view !== "advanced" || !advanced)
        ? "simple"
        : "advanced";
    this.#drawForm(
      document,
      account.id,
      view === "simple" && simple
        ? { view, form: simple }
        : { view: "advanced", form: advanced! },
    );
  }

  /**
   * The language changed: draw the panel again. A form on screen is drawn
   * from what it shows now, not from storage, so unsaved input stays,
   * including a number that is not valid yet.
   */
  async localeChanged(): Promise<void> {
    const document = this.root.ownerDocument;
    const accountId = this.#accountId;
    if (!this.#form?.isConnected || !accountId) return this.render();
    const shown:
      | { view: "simple"; form: BuilderForm }
      | { view: "advanced"; form: AdvancedForm } = this.#rules
      ? { view: "advanced", form: this.#readAdvanced(numberOrNone) }
      : { view: "simple", form: this.#readSimple(numberOrNone) };
    // Number and phrase fields, as typed: a value that is not valid yet, or
    // one in a condition that is not ticked, is not in the form read above.
    const fields = Array.from(
      this.#form.querySelectorAll<HTMLInputElement>(VALUE_FIELDS),
    );
    const typed = fields.map((input) => input.value);
    const noted = fields.map((input) => this.#notes.has(input));
    const focused = document.activeElement?.id;
    this.#drawForm(document, accountId, shown);
    // The same form gives the same fields in the same order.
    this.#form
      .querySelectorAll<HTMLInputElement>(VALUE_FIELDS)
      .forEach((input, index) => {
        input.value = typed[index] ?? input.value;
        // A field's note shows again, in the new language.
        if (noted[index]) this.#checkField(input);
      });
    this.#updateSimpleReason();
    if (focused) document.getElementById(focused)?.focus();
  }

  /** The heading and hint every state of the panel starts with. */
  #drawShell(document: Document): void {
    // Every button is drawn again, unarmed.
    this.#disarm();
    this.root.replaceChildren();
    this.#controls = new Map();
    this.#form = undefined;
    this.#rules = undefined;
    this.#status.redraw();
    this.#deleteLine.redraw();
    const heading = element(
      document,
      "h2",
      "joyfox-panel__heading",
      t("options.tabs.rule"),
    );
    heading.id = "joyfox-rule-heading";
    this.root.setAttribute("aria-labelledby", heading.id);
    this.root.append(heading);
    this.root.append(
      element(document, "p", "joyfox-panel__hint", t("rule.hint")),
    );
  }

  #drawForm(
    document: Document,
    accountId: string,
    shown:
      | { view: "simple"; form: BuilderForm }
      | { view: "advanced"; form: AdvancedForm },
  ): void {
    this.#drawShell(document);
    this.#accountId = accountId;
    this.#note = element(document, "p", "", noteText(this.#saved));
    this.#form = this.#renderForm(document, accountId, shown, this.#saved);
    // The status sits under the note, where the form starts: after the
    // form's last field it would be out of view for most changes.
    this.root.append(this.#note, this.#status.node, this.#form);
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
    node.setAttribute("aria-label", t("options.tabs.rule"));

    const enabledLabel = element(document, "label", "joyfox-rule__toggle");
    const enabled = document.createElement("input");
    enabled.type = "checkbox";
    enabled.checked = form.enabled;
    enabled.id = "joyfox-rule-enabled";
    enabled.setAttribute(FOCUS_KEY, "rule:enabled");
    enabledLabel.append(
      enabled,
      document.createTextNode(` ${t("rule.enabled")}`),
    );
    this.#enabled = enabled;

    const placementWrapper = element(document, "div", "joyfox-panel__field");
    const placementLabel = element(
      document,
      "label",
      "",
      t("rule.placementLabel"),
    );
    placementLabel.htmlFor = "joyfox-rule-placement";
    const placement = document.createElement("select");
    placement.id = "joyfox-rule-placement";
    for (const value of ["quarantined", "needs-review"] as const)
      placement.append(
        new Option(
          t(PLACEMENT_TEXT[value]),
          value,
          false,
          value === form.defaultPlacement,
        ),
      );
    placementWrapper.append(placementLabel, placement);
    this.#placement = placement;

    this.#editor = element(document, "div", "joyfox-rule__editor");
    node.append(
      // How saving works, before the first field.
      element(document, "p", "joyfox-panel__hint", t("rule.autosaveHint")),
      enabledLabel,
      placementWrapper,
      this.#renderPresets(document, accountId),
      this.#renderSwitch(document),
      this.#editor,
      element(document, "p", "joyfox-panel__hint", t("rule.spamHint")),
      element(document, "p", "joyfox-panel__hint", t("rule.firstMessageHint")),
    );
    if (saved)
      node.append(
        this.#removeButton(document, accountId),
        this.#deleteLine.node,
      );
    // Autosave: checkboxes and choices report `change` at once, a number
    // field when it loses focus or on Enter. Submitting (Enter) saves too.
    this.#autosave = () => {
      // Read the form now, at change time, then queue the write.
      const form = this.#readForm();
      this.#checkFields();
      const version = this.#version();
      void this.#serial(() => this.#save(accountId, form, version));
    };
    // A preset confirmation covers the conditions as they were: the
    // panel's own `change` listener disarms it (see the constructor).
    node.addEventListener("change", (event) => {
      // Adding a condition and choosing a preset are changes of their own,
      // handled by their selects.
      if (
        (event.target as Element).matches(
          ".joyfox-rule__add-condition, .joyfox-rule__preset",
        )
      )
        return;
      this.#updateSimpleReason();
      // A ticked text condition waits for its text: nothing is saved yet,
      // so no error shows, only the field's hint.
      if (this.#boxChanged(event.target)) return this.#checkFields();
      this.#autosave();
    });
    // A field with a note is checked again as the user types, so an error
    // goes as soon as the value is valid.
    node.addEventListener("input", (event) => {
      const field = event.target as HTMLInputElement;
      if (this.#notes.has(field)) this.#checkField(field);
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

  /**
   * PRD 11.3's presets (V1-11, ADR 0016). A preset fills the Simple editor
   * with its conditions and saves at once; the user can then change them
   * like any other rule. Replacing conditions already shown takes a second
   * click, as the autosave leaves no other way back.
   */
  #renderPresets(document: Document, accountId: string): HTMLElement {
    const wrapper = element(
      document,
      "div",
      "joyfox-panel__field joyfox-rule__presets",
    );
    const label = element(document, "label", "", t("rule.preset.label"));
    label.htmlFor = "joyfox-rule-preset";
    const choice = document.createElement("select");
    choice.id = "joyfox-rule-preset";
    choice.className = "joyfox-rule__preset";
    choice.append(new Option(t("rule.preset.choose"), "", true, true));
    for (const id of RULE_PRESET_IDS)
      choice.append(new Option(t(PRESET_TEXT[id]), id));
    const apply = element(
      document,
      "button",
      "joyfox-rule__preset-apply",
      t("rule.preset.apply"),
    );
    apply.type = "button";
    apply.disabled = true;
    const description = element(
      document,
      "p",
      "joyfox-panel__hint joyfox-rule__preset-description",
    );
    description.id = "joyfox-rule-preset-description";
    choice.setAttribute("aria-describedby", description.id);
    // The confirm prompt sits under its button and goes when it disarms.
    const prompt = new StatusLine(document);
    prompt.node.classList.add("joyfox-rule__prompt");
    // Another choice disarms the button: the panel's `change` listener.
    const show = () => {
      const id = choice.value;
      apply.disabled = !isRulePresetId(id);
      description.textContent = isRulePresetId(id) ? presetDescription(id) : "";
    };
    choice.addEventListener("change", show);
    apply.addEventListener("click", (event) => {
      const id = choice.value;
      if (!isRulePresetId(id)) return;
      if (
        this.#shownConditionCount() > 0 &&
        !this.#secondClick(apply, event, () => {
          apply.textContent = t("rule.preset.confirm");
          prompt.set(message("rule.preset.confirmPrompt"), "info");
          return () => {
            apply.textContent = t("rule.preset.apply");
            prompt.clear();
          };
        })
      )
        return;
      // Focus stays on the choice, as the button turns disabled.
      choice.focus();
      choice.value = "";
      show();
      this.#applyPreset(document, accountId, id);
    });
    const row = element(document, "div", "joyfox-rule__preset-row");
    row.append(choice, apply);
    wrapper.append(
      label,
      row,
      prompt.node,
      description,
      element(document, "p", "joyfox-panel__hint", t("rule.preset.hint")),
    );
    return wrapper;
  }

  /** How many conditions the shown editor holds, valid or not. */
  #shownConditionCount(): number {
    if (this.#rules)
      return this.#readAdvanced(numberOrNone).rules.reduce(
        (count, rule) => count + Object.keys(rule.conditions).length,
        0,
      );
    const form = this.#readSimple(numberOrNone);
    return Object.keys(form.all).length + Object.keys(form.any).length;
  }

  /** Show a preset in the Simple editor and save it. */
  #applyPreset(document: Document, accountId: string, id: RulePresetId): void {
    const form = presetForm(id, {
      enabled: this.#enabled?.checked ?? true,
      defaultPlacement: (this.#placement?.value ??
        "quarantined") as FailPlacement,
    });
    this.#view = "simple";
    this.#showSimple(document, form);
    const version = this.#version();
    const read: ReadRule = {
      definition: fromBuilderForm(form),
      notice: presetNotice(id),
    };
    void this.#serial(() => this.#save(accountId, read, version));
    // Custom has no conditions yet: start at the first box to tick.
    if (id === "custom")
      this.#editor
        ?.querySelector<HTMLInputElement>("input[type=checkbox]")
        ?.focus();
  }

  /** The Simple / Advanced switch, and why Simple is not available. */
  #renderSwitch(document: Document): HTMLElement {
    const row = element(document, "div", "joyfox-rule__switch-row");
    const label = element(document, "span", "", t("rule.editor"));
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
    this.#simpleButton = button(t("rule.simple"), "simple");
    this.#advancedButton = button(t("rule.advanced"), "advanced");
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
      // A ticked text condition without text comes along: the Advanced
      // editor shows it as a condition that waits for its text.
      const form = this.#readSimple(undefined, true);
      if (failed(form)) {
        this.#checkFields();
        return this.#setStatus(form, "error");
      }
      this.#view = "advanced";
      this.#showAdvanced(document, builderToAdvanced(form));
      return;
    }
    const advanced = this.#readAdvanced();
    if (failed(advanced)) {
      this.#checkFields();
      return this.#setStatus(advanced, "error");
    }
    const form = advancedToBuilder(advanced);
    if (isProblem(form)) return this.#setStatus(form, "error");
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
  #setSimpleReason(reason: Message | undefined): void {
    if (this.#simpleButton) this.#simpleButton.disabled = reason !== undefined;
    if (this.#simpleReason)
      this.#simpleReason.textContent = reason ? t(reason) : "";
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
    const top = matchSelect(document, form.match, t("rule.combine.label"));
    top.id = "joyfox-rule-top-match";
    top.addEventListener("change", () => this.#renumber());
    this.#topMatch = top;
    intro.append(
      element(document, "strong", "", t("rule.combine.prefix")),
      top,
      element(document, "strong", "", t("rule.combine.suffix")),
    );
    const hint = element(
      document,
      "p",
      "joyfox-panel__hint",
      t("rule.advancedHint"),
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
      t("rule.addRule"),
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
      t("rule.removeRule"),
    );
    remove.type = "button";
    // The group's own prompt line, next to its button.
    const prompt = new StatusLine(document);
    prompt.node.classList.add("joyfox-rule__prompt");
    remove.addEventListener("click", (event) => {
      // A group with conditions goes only on a second click. The text
      // changes in place, so keyboard focus stays on the button.
      if (
        fieldset.querySelector(CONDITION_ROW) &&
        !this.#secondClick(remove, event, () => {
          const number = this.#groupNumber(fieldset);
          remove.textContent = t("rule.confirmRemoveGroup");
          remove.setAttribute(
            "aria-label",
            t("rule.confirmRemoveGroupLabel", { number }),
          );
          prompt.set(message("rule.removeGroupPrompt", { number }), "info");
          return () => {
            remove.textContent = t("rule.removeRule");
            remove.setAttribute(
              "aria-label",
              t("rule.removeRuleLabel", {
                number: this.#groupNumber(fieldset),
              }),
            );
            prompt.clear();
          };
        })
      )
        return;
      fieldset.remove();
      this.#renumber();
      this.#autosave();
      // The button is gone: focus moves to adding a group, under the list.
      this.#editor
        ?.querySelector<HTMLButtonElement>(".joyfox-rule__add-rule")
        ?.focus();
    });
    head.append(
      title,
      match,
      element(document, "strong", "", t("rule.ruleSuffix")),
      remove,
    );
    const list = element(document, "div", "joyfox-rule__conditions");
    const empty = element(
      document,
      "p",
      "joyfox-panel__hint joyfox-rule__empty",
      t("rule.noConditions"),
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
      // A text condition has no default: it is saved when its text is
      // entered, so an empty field never shows as a save error.
      if (TEXT_CONDITION_KINDS.has(kind)) {
        row.querySelector<HTMLElement>(".joyfox-rule__text")?.focus();
        return;
      }
      row.querySelector<HTMLElement>("input[type=number], select")?.focus();
      this.#autosave();
    });
    fieldset.append(head, prompt.node, list, empty, add);
    return fieldset;
  }

  /** A group's number, as the Advanced editor shows it. */
  #groupNumber(fieldset: HTMLElement): number {
    const groups = this.#rules?.querySelectorAll(":scope > [data-rule]");
    return Array.from(groups ?? []).indexOf(fieldset) + 1;
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
    const condition = conditionName(kind);
    remove.title = t("rule.removeCondition");
    remove.setAttribute(
      "aria-label",
      t("rule.removeConditionLabel", { condition }),
    );
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
    not.setAttribute("aria-label", t("rule.notLabel", { condition }));
    notLabel.title = t("rule.notTitle");
    notLabel.append(not, document.createTextNode(t("rule.not")));
    const mark = () =>
      notLabel.classList.toggle("joyfox-rule__not--on", not.checked);
    not.addEventListener("change", mark);
    mark();
    const name = element(
      document,
      "span",
      "joyfox-rule__name",
      t(CONDITION_TEXT[kind]),
    );
    row.append(remove, notLabel, name);
    if (NUMERIC_CONDITION_KINDS.has(kind))
      row.append(numberInput(document, kind, entry.value));
    else row.append(element(document, "span", "joyfox-rule__no-value"));
    if (TEXT_CONDITION_KINDS.has(kind)) {
      row.classList.add("joyfox-rule__condition--text");
      row.append(textInput(document, kind, entry.text));
    }
    const unknown = unknownSelect(document, entry.whenUnknown);
    unknown.className = "joyfox-rule__unknown";
    unknown.setAttribute("aria-label", t("rule.unknownLabel", { condition }));
    if (kind === "notTemplateSpam") {
      const note = spamNote(document, this.#noteId());
      name.append(" ", note);
      unknown.setAttribute("aria-describedby", note.id);
    }
    row.append(
      element(
        document,
        "span",
        "joyfox-rule__unknown-label",
        t("rule.unknownPrompt"),
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
    const joiner = t(
      this.#topMatch?.value === "all" ? "rule.joiner.all" : "rule.joiner.any",
    );
    fieldsets.forEach((fieldset, index) => {
      const number = index + 1;
      if (index > 0)
        fieldset.before(element(document, "p", "joyfox-rule__joiner", joiner));
      fieldset.querySelector(".joyfox-rule__rule-title")!.textContent = t(
        "rule.ruleTitle",
        { number },
      );
      fieldset
        .querySelector(".joyfox-rule__rule-match")!
        .setAttribute("aria-label", t("rule.ruleMatchLabel", { number }));
      const remove = fieldset.querySelector<HTMLButtonElement>(
        ".joyfox-rule__remove-rule",
      )!;
      remove.disabled = fieldsets.length === 1;
      remove.setAttribute("aria-label", t("rule.removeRuleLabel", { number }));
      const used = new Set(
        Array.from(
          fieldset.querySelectorAll<HTMLElement>(CONDITION_ROW),
          (row) => row.dataset.kind,
        ),
      );
      (fieldset.querySelector(".joyfox-rule__empty") as HTMLElement).hidden =
        used.size > 0;
      const add = fieldset.querySelector<HTMLSelectElement>(
        ".joyfox-rule__add-condition",
      )!;
      add.setAttribute("aria-label", t("rule.addConditionLabel", { number }));
      add.replaceChildren(new Option(t("rule.addCondition"), "", true, true));
      for (const kind of CONDITION_KINDS)
        if (!used.has(kind))
          add.append(new Option(t(CONDITION_TEXT[kind]), kind));
      add.hidden = used.size === CONDITION_KINDS.length;
    });
    const button = this.#editor?.querySelector<HTMLButtonElement>(
      ".joyfox-rule__add-rule",
    );
    if (button) button.disabled = fieldsets.length >= MAX_ADVANCED_RULES;
    const count = this.#editor?.querySelector(".joyfox-rule__rule-count");
    if (count)
      count.textContent = t("rule.ruleCount", {
        count: fieldsets.length,
        maximum: MAX_ADVANCED_RULES,
      });
    this.#updateSimpleReason();
  }

  #updateSimpleReason(): void {
    const form = this.#readAdvanced();
    if (failed(form)) return;
    const simple = advancedToBuilder(form);
    this.#setSimpleReason(isProblem(simple) ? simple : undefined);
  }

  #renderBox(
    document: Document,
    box: BoxName,
    entries: Partial<Record<ConditionKind, BoxEntry>>,
  ): HTMLFieldSetElement {
    const fieldset = element(document, "fieldset", "joyfox-rule__box");
    fieldset.append(element(document, "legend", "", t(BOX_LEGEND[box])));
    for (const kind of CONDITION_KINDS) {
      const entry = entries[kind];
      const id = `joyfox-rule-${box}-${kind}`;
      const row = element(document, "div", "joyfox-rule__condition");
      const on = document.createElement("input");
      on.type = "checkbox";
      on.id = `${id}-on`;
      on.checked = entry !== undefined;
      const label = element(document, "label", "", t(CONDITION_TEXT[kind]));
      label.htmlFor = on.id;
      row.append(on, label);
      const controls: ConditionControls = {
        on,
        unknown: document.createElement("select"),
      };
      if (kind === "notTemplateSpam") {
        // In the label, so the box's name says it too.
        const note = spamNote(document, `${id}-note`);
        label.append(" ", note);
        controls.unknown.setAttribute("aria-describedby", note.id);
      }
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
        value.dataset.condition = kind;
        value.setAttribute(
          "aria-label",
          t("rule.valueLabel", { condition: conditionName(kind) }),
        );
        controls.value = value;
        row.append(value);
      } else {
        // Keeps the columns in line with the rows that have a number.
        const gap = document.createElement("span");
        gap.className = "joyfox-rule__no-value";
        row.append(gap);
      }
      if (TEXT_CONDITION_KINDS.has(kind)) {
        // On a line of its own under the name, so a phrase has room.
        row.classList.add("joyfox-rule__condition--text");
        const text = textInput(document, kind, entry?.text);
        text.id = `${id}-text`;
        controls.text = text;
        row.append(text);
      }
      const unknownLabel = element(
        document,
        "label",
        "",
        t("rule.unknownPrompt"),
      );
      unknownLabel.htmlFor = `${id}-unknown`;
      controls.unknown.id = `${id}-unknown`;
      for (const handling of Object.keys(UNKNOWN_TEXT) as UnknownHandling[])
        controls.unknown.append(
          new Option(
            t(UNKNOWN_TEXT[handling]),
            handling,
            false,
            handling === (entry?.whenUnknown ?? "needs-review"),
          ),
        );
      row.append(unknownLabel, controls.unknown);
      followBox(controls);
      this.#controls.set(`${box}:${kind}`, controls);
      fieldset.append(row);
    }
    return fieldset;
  }

  /**
   * A Simple row's box was ticked or cleared, and its fields follow it. A
   * ticked number without a value gets the Advanced editor's default, so
   * the tick saves at once. Returns true when a ticked text condition waits
   * for its text: focus moves there, and nothing is saved yet.
   */
  #boxChanged(target: EventTarget | null): boolean {
    for (const [key, controls] of this.#controls) {
      if (controls.on !== target) continue;
      followBox(controls);
      if (!controls.on.checked) return false;
      const kind = key.slice(key.indexOf(":") + 1) as ConditionKind;
      const { value, text } = controls;
      if (value && value.value.trim() === "") {
        value.value = String(NEW_VALUE[kind] ?? "");
        value.focus();
      }
      if (text && text.value.trim() === "") {
        text.focus();
        return true;
      }
      return false;
    }
    return false;
  }

  /**
   * Mark each number and text field in use whose value a save refuses, and
   * clear the others. A ticked Simple text condition without text shows a
   * hint instead: a save leaves it out until text is typed.
   */
  #checkFields(): void {
    this.#form
      ?.querySelectorAll<HTMLInputElement>(VALUE_FIELDS)
      .forEach((field) => this.#checkField(field));
  }

  #checkField(field: HTMLInputElement): void {
    const kind = field.dataset.condition as ConditionKind;
    // An unticked Simple row: its condition does not count.
    if (field.disabled) return this.#fieldNote(field, undefined);
    if (field.type === "number")
      return this.#fieldNote(
        field,
        typeof readNumber(field, kind) === "number"
          ? undefined
          : message("rule.fieldNumberProblem", {
              minimum: numberMinimum(kind),
              maximum: RULE_LIMITS.maxValue,
            }),
      );
    if (!this.#rules && field.value.trim() === "")
      return this.#fieldNote(field, message("rule.textHint"), "hint");
    this.#fieldNote(
      field,
      failed(readText(field, kind))
        ? message("rule.fieldTextProblem", {
            maximum: RULE_LIMITS.maxTextLength,
          })
        : undefined,
    );
  }

  /**
   * Show a note under a field's row, linked to the field, or remove it. An
   * error also marks the field as invalid.
   */
  #fieldNote(
    field: HTMLInputElement,
    note: Message | undefined,
    kind: "error" | "hint" = "error",
  ): void {
    let node = this.#notes.get(field);
    if (!note) {
      node?.remove();
      this.#notes.delete(field);
      field.removeAttribute("aria-invalid");
      field.removeAttribute("aria-describedby");
      return;
    }
    if (!node) {
      node = element(field.ownerDocument, "span", "joyfox-rule__field-note");
      node.id = this.#noteId();
      // Last in the row: the grid puts it under the row's fields, so the
      // columns stay in line.
      field.closest(".joyfox-rule__condition")?.append(node);
      this.#notes.set(field, node);
    }
    node.dataset.note = kind;
    node.textContent = t(note);
    field.setAttribute("aria-describedby", node.id);
    if (kind === "error") field.setAttribute("aria-invalid", "true");
    else field.removeAttribute("aria-invalid");
  }

  #noteId(): string {
    return `joyfox-rule-note-${(this.#noteCount += 1)}`;
  }

  /** Read the shown editor, or return the first problem as a message. */
  #readForm(): ReadRule | Message {
    if (this.#rules) {
      const form = this.#readAdvanced();
      if (failed(form)) return form;
      const definition = fromAdvancedForm(form);
      return {
        definition,
        ...(definition.root.children.length === 0
          ? { notice: message("rule.savedNoConditions") }
          : {}),
      };
    }
    const form = this.#readSimple();
    if (failed(form)) return form;
    const all = Object.keys(form.all).length;
    const any = Object.keys(form.any).length;
    // An empty rule is legitimate (the "Open" preset), but lets every
    // sender through, so the status says so.
    const notice =
      all + any === 0
        ? message("rule.savedNoConditions")
        : all === 0
          ? message("rule.savedVacuous")
          : undefined;
    return {
      definition: fromBuilderForm(form),
      ...(notice ? { notice } : {}),
    };
  }

  /**
   * Read the simple editor. By default a field that is not valid ends the
   * read with its problem, and a ticked text condition without text is left
   * out (`keepEmptyText` keeps it, for the Advanced editor). For a redraw,
   * `number` decides what a number field gives, and text is read exactly as
   * typed.
   */
  #readSimple(): BuilderForm | Message;
  #readSimple(
    number: (value: number | Message) => number | undefined,
  ): BuilderForm;
  #readSimple(number: undefined, keepEmptyText: boolean): BuilderForm | Message;
  #readSimple(
    number?: (value: number | Message) => number | undefined,
    keepEmptyText = false,
  ): BuilderForm | Message {
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
          const read = readNumber(controls.value, kind);
          const value = number ? number(read) : read;
          if (typeof value === "object") return value;
          if (value !== undefined) entry.value = value;
        }
        if (controls.text) {
          // A redraw (`number` given) keeps the text exactly as typed,
          // valid or not.
          if (number) entry.text = controls.text.value;
          else if (controls.text.value.trim() === "") {
            // Ticked, but no text yet: a save leaves the condition out, so
            // other changes still save. The field shows a hint meanwhile.
            if (!keepEmptyText) continue;
            entry.text = "";
          } else {
            const text = readText(controls.text, kind);
            if (failed(text)) return text;
            entry.text = text.text;
          }
        }
        form[box][kind] = entry;
      }
    return form;
  }

  #readAdvanced(): AdvancedForm | Message;
  #readAdvanced(
    number: (value: number | Message) => number | undefined,
  ): AdvancedForm;
  #readAdvanced(
    number?: (value: number | Message) => number | undefined,
  ): AdvancedForm | Message {
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
        fieldset.querySelectorAll<HTMLElement>(CONDITION_ROW),
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
          const read = readNumber(input, kind);
          const value = number ? number(read) : read;
          if (typeof value === "object") return value;
          if (value !== undefined) entry.value = value;
        }
        const textField =
          row.querySelector<HTMLInputElement>(".joyfox-rule__text");
        if (textField) {
          // A redraw (`number` given) keeps the text exactly as typed,
          // valid or not.
          if (number) entry.text = textField.value;
          else {
            const text = readText(textField, kind);
            if (failed(text)) return text;
            entry.text = text.text;
          }
        }
        rule.conditions[kind] = entry;
      }
      form.rules.push(rule);
    }
    return form;
  }

  async #save(
    accountId: string,
    form: ReadRule | Message,
    version: FormVersion,
  ): Promise<void> {
    if (failed(form)) {
      this.#setStatus(message("rule.notSaved", { problem: form }), "error");
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
      this.#setStatus(form.notice ?? message("rule.saved"), "info");
    } catch {
      this.#setStatus(message("rule.saveFailed"), "error");
    }
  }

  /** After the first save, say so and offer to delete the rule, in place. */
  #markSaved(accountId: string): void {
    this.#saved = true;
    if (this.#note) this.#note.textContent = noteText(true);
    if (this.#form && !this.#form.querySelector(".joyfox-rule__delete-all"))
      this.#form.append(
        this.#removeButton(this.root.ownerDocument, accountId),
        this.#deleteLine.node,
      );
  }

  /**
   * Deleting the whole rule stops the inbox sorting, so it takes a second
   * click. The prompt and any failure show right under the button.
   */
  #removeButton(document: Document, accountId: string): HTMLButtonElement {
    const button = element(
      document,
      "button",
      "joyfox-panel__remove joyfox-rule__delete-all",
      t("rule.deleteAll"),
    );
    button.type = "button";
    button.setAttribute(FOCUS_KEY, "rule:delete-all");
    button.addEventListener("click", (event) => {
      // The text changes in place, so keyboard focus stays on the button.
      const confirmed = this.#secondClick(button, event, () => {
        button.textContent = t("rule.confirmDeleteAll");
        this.#deleteLine.set(message("rule.deletePrompt"), "info");
        return () => {
          button.textContent = t("rule.deleteAll");
          this.#deleteLine.clear();
        };
      });
      if (!confirmed) return;
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
          const focus = rememberFocus(this.root);
          await this.render();
          this.#setStatus(message("rule.removed"), "info");
          // The button is gone: focus goes to the form's first control,
          // under the result. The result sits at the top of the form, far
          // above the button, so it is scrolled into view as well (a mouse
          // click on macOS leaves no focus to follow).
          restoreFocus(this.root, focus, ["rule:enabled"]);
          this.#status.node.scrollIntoView?.({ block: "nearest" });
        } catch {
          this.#deleteLine.set(message("rule.removeFailed"), "error");
        }
      });
    });
    return button;
  }

  /**
   * A click on a button that acts only on its second click (`confirm.ts`).
   * Returns true when this click confirms: the button is armed, and the
   * click is a single one after the grace period, so a double-click can
   * never arm and confirm in one gesture. Otherwise an unarmed button arms
   * (`arm` shows the prompt and returns how to take it back), and an armed
   * one waits.
   */
  #secondClick(
    button: HTMLButtonElement,
    event: MouseEvent,
    arm: () => () => void,
  ): boolean {
    const armed = this.#armed;
    if (armed?.button === button) {
      if (!confirmAllowed(event, armed.at)) return false;
      this.#disarm();
      return true;
    }
    if (event.detail > 1) return false;
    this.#disarm();
    this.#armed = { button, at: confirmTiming.now(), disarm: arm() };
    return false;
  }

  #disarm(): void {
    const armed = this.#armed;
    this.#armed = undefined;
    armed?.disarm();
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
    this.#setStatus(message(`rule.stale.${reason}.${action}`), "error");
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
    this.#setStatus(message("rule.changedElsewhere"), "info");
  }

  #serial(action: () => Promise<void>): Promise<void> {
    const run = this.#mutations.then(action);
    this.#mutations = run.catch(() => undefined);
    return run;
  }

  #setStatus(text: Message, kind: "info" | "error"): void {
    this.#status.set(text, kind);
  }
}
