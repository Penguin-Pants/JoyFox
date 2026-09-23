import { ACTIVE_ACCOUNT_SETTING_KEY } from "../accounts/account-service";
import { mountAccountPanel } from "./account-panel";
import { RulePanel } from "./rule-panel";

const root = document.querySelector<HTMLElement>("#joyfox-accounts");
if (root)
  void mountAccountPanel(root).catch(() => {
    root.textContent =
      "JoyFox could not read its stored accounts. No account was changed.";
  });

const ruleRoot = document.querySelector<HTMLElement>("#joyfox-rule");
if (ruleRoot) {
  const rules = new RulePanel(ruleRoot);
  const render = () =>
    rules.render().catch(() => {
      ruleRoot.textContent =
        "JoyFox could not read the contact rule. No rule was changed.";
    });
  void render();
  // The rule belongs to the active account, so a switch shows that account's.
  browser.storage.onChanged.addListener((changes, area) => {
    if (area === "local" && ACTIVE_ACCOUNT_SETTING_KEY in changes)
      void render();
  });
}
