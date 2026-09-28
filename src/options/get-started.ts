import { AccountService } from "../accounts/account-service";
import type { PlainKey } from "../i18n/catalog/en";
import { message } from "../i18n/message";
import { t } from "../i18n/translator";
import type { RuleNode } from "../rules/contact-rule";
import { RuleService } from "../rules/rule-service";
import { FOCUS_KEY, rememberFocus, restoreFocus } from "../ui/focus";
import { StatusLine } from "./status-line";

export type StepState = "done" | "off" | "todo";

export interface SetupProgress {
  account: StepState;
  /** Accounts are stored, but none is active (the active one was removed). */
  chooseAccount: boolean;
  rule: StepState;
  /** The rule is on and has no conditions, so every sender qualifies. */
  openRule: boolean;
}

const STATE_TEXT: Record<StepState, PlainKey> = {
  done: "start.state.done",
  off: "start.state.off",
  todo: "start.state.todo",
};

/**
 * The site JoyFox asks Firefox for. Only JoyClub: the JOYCE host permission
 * stays as the manifest declares it, and no step asks for it.
 */
export const JOYCLUB_ORIGINS = ["*://*.joyclub.de/*"];

/**
 * The part of `browser.permissions` the site-access step uses. The user can
 * turn off JoyFox's access to a site at any time (about:addons, the
 * Extensions panel), and Firefox 121 to 126 did not grant it at install for
 * a Manifest V3 extension.
 */
export interface SiteAccess {
  contains(permissions: { origins: string[] }): Promise<boolean>;
  request(permissions: { origins: string[] }): Promise<boolean>;
  onAdded?: { addListener(listener: () => void): void };
  onRemoved?: { addListener(listener: () => void): void };
}

/** Whether Firefox lets JoyFox run on joyclub.de. `unknown` never blocks. */
export type AccessState = "granted" | "missing" | "unknown";

/** Firefox's permissions API, where this page has one. */
const browserSiteAccess = (): SiteAccess | undefined =>
  (globalThis as { browser?: typeof browser }).browser?.permissions;

/** Whether a rule tree holds at least one condition. */
const hasCondition = (node: RuleNode): boolean =>
  node.type === "condition" || node.children.some(hasCondition);

/**
 * What a cold install still needs before the inbox is triaged (build plan
 * Section 28, PRD Section 21.1): an active account, and a contact rule that
 * is turned on. JoyFox cannot see whether the inbox was opened, so the third
 * step has no state.
 */
export async function setupProgress(
  accounts: Pick<AccountService, "getActiveAccount" | "listAccounts">,
  rules: Pick<RuleService, "getGlobalRule">,
): Promise<SetupProgress> {
  const active = await accounts.getActiveAccount();
  if (!active)
    return {
      account: "todo",
      chooseAccount: (await accounts.listAccounts()).length > 0,
      rule: "todo",
      openRule: false,
    };
  const rule = await rules.getGlobalRule(active.id);
  return {
    account: "done",
    chooseAccount: false,
    rule: !rule ? "todo" : rule.enabled ? "done" : "off",
    // An empty rule is legitimate (the "Open" preset), so the step is done.
    openRule: rule?.enabled === true && !hasCondition(rule.root),
  };
}

/**
 * The "Get started" checklist at the top of the options page. Each step's
 * state is written out in words, never shown by color alone. Rendering
 * replaces the contents, so a second render never adds a second copy.
 */
export class GetStartedPanel {
  #generation = 0;
  /** The answer to an access request. Created once, kept across draws. */
  readonly #status: StatusLine;
  /** What the status says about access, until Firefox's state disagrees. */
  #accessNote: "granted" | "refused" | undefined;
  /** An access request is open in Firefox. */
  #requesting = false;

  constructor(
    private readonly root: HTMLElement,
    private readonly accounts = new AccountService(),
    private readonly rules = new RuleService(),
    private readonly access: SiteAccess | undefined = browserSiteAccess(),
  ) {
    this.#status = new StatusLine(root.ownerDocument);
    // The user can turn access on or off in Firefox while this page is open.
    const redraw = () => void this.render().catch(() => undefined);
    access?.onAdded?.addListener(redraw);
    access?.onRemoved?.addListener(redraw);
  }

  async render(): Promise<void> {
    const generation = ++this.#generation;
    const [progress, access] = await Promise.all([
      setupProgress(this.accounts, this.rules).catch(() => undefined),
      this.#readAccess(),
    ]);
    // An older render that finishes late must not replace a newer one.
    if (generation !== this.#generation) return;
    const document = this.root.ownerDocument;
    const text = (tag: keyof HTMLElementTagNameMap, value: string) => {
      const node = document.createElement(tag);
      node.textContent = value;
      return node;
    };
    const heading = text("h2", t("options.tabs.start"));
    heading.className = "joyfox-panel__heading";
    heading.id = "joyfox-get-started-heading";
    this.root.setAttribute("aria-labelledby", heading.id);
    if (!progress) {
      this.root.replaceChildren(heading, text("p", t("start.readFailed")));
      return;
    }
    const missing = access === "missing";
    // A request's answer stays until Firefox's state says otherwise.
    if (
      (this.#accessNote === "granted" && missing) ||
      (this.#accessNote === "refused" && !missing)
    ) {
      this.#accessNote = undefined;
      this.#status.clear();
    }
    this.#status.redraw();
    const ready =
      !missing && progress.account === "done" && progress.rule === "done";
    const summary = text(
      "p",
      t(ready ? "start.ready" : missing ? "start.introAccess" : "start.intro"),
    );
    const list = document.createElement("ol");
    list.className = "joyfox-get-started__steps";
    /** `[Name](#tab)` in a label becomes a link to that options tab. */
    const withLinks = (label: string) => {
      const span = document.createElement("span");
      for (const part of label.split(/(\[[^\]]+\]\(#[a-z]+\))/)) {
        const link = /^\[([^\]]+)\]\((#[a-z]+)\)$/.exec(part);
        if (!link) {
          if (part) span.append(part);
          continue;
        }
        const anchor = document.createElement("a");
        anchor.textContent = link[1] ?? "";
        anchor.href = link[2] ?? "";
        anchor.setAttribute(FOCUS_KEY, `link:${link[2] ?? ""}`);
        span.append(anchor);
      }
      return span;
    };
    const step = (label: string, state?: StepState, stateText?: PlainKey) => {
      const item = document.createElement("li");
      if (state) item.dataset.state = state;
      item.append(withLinks(label));
      if (state) {
        const status = text("strong", ` ${t(stateText ?? STATE_TEXT[state])}.`);
        status.className = "joyfox-get-started__state";
        item.append(status);
      }
      return item;
    };
    if (missing)
      list.append(this.#withAllowButton(step(t("start.step.access"), "todo")));
    list.append(
      step(
        t(
          progress.chooseAccount
            ? "start.step.chooseAccount"
            : "start.step.account",
        ),
        progress.account,
      ),
      step(
        t("start.step.rule"),
        progress.rule,
        progress.openRule ? "start.state.doneOpen" : undefined,
      ),
      step(t("start.step.inbox")),
    );
    const focus = rememberFocus(this.root);
    this.root.replaceChildren(heading, summary, list, this.#status.node);
    // After access is allowed its button is gone: the next step's link.
    restoreFocus(this.root, focus, ["access:allow", "link:#accounts"]);
  }

  /** The first step, while Firefox blocks JoyFox on joyclub.de. */
  #withAllowButton(item: HTMLLIElement): HTMLLIElement {
    const allow = item.ownerDocument.createElement("button");
    allow.type = "button";
    allow.className = "joyfox-get-started__allow";
    allow.textContent = t("access.allow");
    allow.setAttribute(FOCUS_KEY, "access:allow");
    allow.addEventListener("click", () => this.#requestAccess());
    item.append(allow);
    return item;
  }

  /** Whether Firefox lets JoyFox run on joyclub.de. A failed check never blocks. */
  async #readAccess(): Promise<AccessState> {
    if (!this.access) return "unknown";
    try {
      const granted = await this.access.contains({ origins: JOYCLUB_ORIGINS });
      return granted ? "granted" : "missing";
    } catch {
      return "unknown";
    }
  }

  /**
   * Ask Firefox for access, then draw again. The request runs inside the
   * click, as Firefox shows its prompt only for a user action.
   */
  #requestAccess(): void {
    const access = this.access;
    // A second click while Firefox's prompt is open asks nothing more.
    if (!access || this.#requesting) return;
    this.#requesting = true;
    let asked: Promise<boolean>;
    try {
      asked = access.request({ origins: JOYCLUB_ORIGINS });
    } catch {
      asked = Promise.resolve(false);
    }
    void asked
      .catch(() => false)
      .then((granted) => {
        this.#requesting = false;
        this.#accessNote = granted ? "granted" : "refused";
        this.#status.set(
          message(granted ? "access.granted" : "access.refused"),
          granted ? "info" : "error",
        );
        return this.render();
      })
      .catch(() => undefined);
  }
}
