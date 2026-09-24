import { ACTIVE_ACCOUNT_SETTING_KEY } from "../accounts/account-service";
import { TRIAGE_REVISION_KEY } from "../storage/triage-revision";
import { mountAccountPanel, type AccountPanel } from "./account-panel";
import { DataPanel } from "./data-panel";
import { GetStartedPanel } from "./get-started";
import { RulePanel } from "./rule-panel";
import { OptionsTabs } from "./tabs";
import { TemplatePanel } from "./template-panel";

const find = (id: string) => document.querySelector<HTMLElement>(`#${id}`);

const tablist = document.querySelector<HTMLElement>('[role="tablist"]');
if (tablist) new OptionsTabs(document, tablist);

// Each panel reports its own read failures, and only for its newest render.
const quietly = (render: () => Promise<void>) => () =>
  void render().catch(() => undefined);

const startRoot = find("joyfox-get-started");
const start = startRoot ? new GetStartedPanel(startRoot) : undefined;
const renderStart = quietly(async () => start?.render());

const dataRoot = find("joyfox-data");
const data = dataRoot
  ? new DataPanel(dataRoot, undefined, undefined, undefined, () => refreshAll())
  : undefined;
const renderData = quietly(async () => data?.render());

const templateRoot = find("joyfox-templates");
const templates = templateRoot
  ? new TemplatePanel(templateRoot, undefined, undefined, renderData)
  : undefined;
const renderTemplates = quietly(async () => templates?.render());

const ruleRoot = find("joyfox-rule");
const rules = ruleRoot ? new RulePanel(ruleRoot) : undefined;
const renderRules = quietly(async () => rules?.render());

let accounts: AccountPanel | undefined;
const accountRoot = find("joyfox-accounts");
if (accountRoot)
  void mountAccountPanel(accountRoot, undefined, renderData)
    .then((panel) => {
      accounts = panel;
    })
    .catch(() => {
      accountRoot.textContent =
        "JoyFox could not read its stored accounts. No account was changed.";
    });

/** After a delete in the data panel, every other panel shows what is left. */
function refreshAll(): void {
  if (accounts) void accounts.render().catch(() => undefined);
  renderStart();
  renderRules();
  renderTemplates();
}

renderStart();
renderRules();
renderTemplates();
renderData();

browser.storage.onChanged.addListener((changes, area) => {
  if (area !== "local") return;
  // The rule and templates belong to the active account, so a switch (or a
  // "delete all" in another tab, which clears the pointer) redraws them.
  if (ACTIVE_ACCOUNT_SETTING_KEY in changes) {
    if (accounts) void accounts.render().catch(() => undefined);
    renderStart();
    renderRules();
    renderTemplates();
    renderData();
  }
  // Another tab may have saved or removed the rule. Redraw only if the
  // stored rule differs from the form, so edits in progress are kept.
  else if (TRIAGE_REVISION_KEY in changes) {
    // Also set by a rule save, which "Get started" reports.
    renderStart();
    if (rules) void rules.refreshIfChanged().catch(() => undefined);
    renderData();
  }
});
