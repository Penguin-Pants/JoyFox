import { AccountService } from "../accounts/account-service";
import { RuleService } from "../rules/rule-service";

export type StepState = "done" | "off" | "todo";

export interface SetupProgress {
  account: StepState;
  rule: StepState;
}

const STATE_TEXT: Record<StepState, string> = {
  done: "Done",
  off: "Saved, but turned off",
  todo: "Not done yet",
};

/**
 * What a cold install still needs before the inbox is triaged (build plan
 * Section 28, PRD Section 21.1): an active account, and a contact rule that
 * is turned on. JoyFox cannot see whether the inbox was opened, so the third
 * step has no state.
 */
export async function setupProgress(
  accounts: Pick<AccountService, "getActiveAccount">,
  rules: Pick<RuleService, "getGlobalRule">,
): Promise<SetupProgress> {
  const active = await accounts.getActiveAccount();
  if (!active) return { account: "todo", rule: "todo" };
  const rule = await rules.getGlobalRule(active.id);
  return {
    account: "done",
    rule: !rule ? "todo" : rule.enabled ? "done" : "off",
  };
}

/**
 * The "Get started" checklist at the top of the options page. Each step's
 * state is written out in words, never shown by color alone. Rendering
 * replaces the contents, so a second render never adds a second copy.
 */
export class GetStartedPanel {
  #generation = 0;

  constructor(
    private readonly root: HTMLElement,
    private readonly accounts = new AccountService(),
    private readonly rules = new RuleService(),
  ) {}

  async render(): Promise<void> {
    const generation = ++this.#generation;
    const progress = await setupProgress(this.accounts, this.rules);
    // An older render that finishes late must not replace a newer one.
    if (generation !== this.#generation) return;
    const document = this.root.ownerDocument;
    const text = (tag: keyof HTMLElementTagNameMap, value: string) => {
      const node = document.createElement(tag);
      node.textContent = value;
      return node;
    };
    const heading = text("h2", "Get started");
    heading.className = "joyfox-panel__heading";
    heading.id = "joyfox-get-started-heading";
    this.root.setAttribute("aria-labelledby", heading.id);
    const ready = progress.account === "done" && progress.rule === "done";
    const summary = text(
      "p",
      ready
        ? "JoyFox is set up. Open your JoyClub inbox to see it sorted."
        : "Three steps, a few minutes. Everything stays in this browser.",
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
        span.append(anchor);
      }
      return span;
    };
    const step = (label: string, state?: StepState) => {
      const item = document.createElement("li");
      if (state) item.dataset.state = state;
      item.append(withLinks(label));
      if (state) {
        const status = text("strong", ` ${STATE_TEXT[state]}.`);
        status.className = "joyfox-get-started__state";
        item.append(status);
      }
      return item;
    };
    list.append(
      step(
        "Add your JoyClub account under [Accounts](#accounts). JoyFox makes the first one active.",
        progress.account,
      ),
      step(
        "Save a contact rule under [Contact rule](#rule). Inbox triage stays off until a rule is saved and turned on.",
        progress.rule,
      ),
      step(
        "Open your JoyClub inbox (www.joyclub.de, ClubMail). JoyFox adds its tabs above the list.",
      ),
    );
    this.root.replaceChildren(heading, summary, list);
  }
}
