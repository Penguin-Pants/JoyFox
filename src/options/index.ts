import { ACTIVE_ACCOUNT_SETTING_KEY } from "../accounts/account-service";
import { applyStaticText } from "../i18n/dom";
import {
  isLocale,
  LOCALE_KEY,
  localeFromSetting,
  readLocale,
} from "../i18n/locale";
import {
  currentLocale,
  onLocaleChange,
  setLocale,
  t,
} from "../i18n/translator";
import { runtimeSettingsArea } from "../storage/local-settings";
import { TRIAGE_REVISION_KEY } from "../storage/triage-revision";
import { mountAccountPanel, type AccountPanel } from "./account-panel";
import { EVENT_REVISION_KEY } from "../storage/event-revision";
import { DataPanel } from "./data-panel";
import {
  MESSAGE_CACHING_KEY,
  MESSAGE_RETENTION_KEY,
} from "../messages/message-settings";
import { MESSAGE_REVISION_KEY } from "../storage/message-revision";
import { EventsPanel } from "./events-panel";
import { MessagesPanel } from "./messages-panel";
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
// Import sits on the Accounts tab, under the account list; the data panel
// still runs it, so export, import and delete share one set of checks.
const data = dataRoot
  ? new DataPanel(
      dataRoot,
      undefined,
      undefined,
      undefined,
      () => refreshAll(),
      find("joyfox-import") ?? undefined,
    )
  : undefined;
const renderData = quietly(async () => data?.render());

const templateRoot = find("joyfox-templates");
const templates = templateRoot
  ? new TemplatePanel(templateRoot, undefined, undefined, renderData)
  : undefined;
const renderTemplates = quietly(async () => templates?.render());

const eventsRoot = find("joyfox-events");
const events = eventsRoot ? new EventsPanel(eventsRoot) : undefined;
const renderEvents = quietly(async () => events?.render());

const messagesRoot = find("joyfox-messages");
const messages = messagesRoot ? new MessagesPanel(messagesRoot) : undefined;
const renderMessages = quietly(async () => messages?.render());

const ruleRoot = find("joyfox-rule");
const rules = ruleRoot ? new RulePanel(ruleRoot) : undefined;
const renderRules = quietly(async () => rules?.render());

let accounts: AccountPanel | undefined;
const accountRoot = find("joyfox-accounts");
let accountsFailed = false;
function mountAccounts(): void {
  if (!accountRoot) return;
  void mountAccountPanel(accountRoot, undefined, renderData)
    .then((panel) => {
      accounts = panel;
    })
    .catch(() => {
      accountsFailed = true;
      accountRoot.textContent = t("accounts.readFailed");
    });
}

/** After a delete in the data panel, every other panel shows what is left. */
function refreshAll(): void {
  if (accounts) void accounts.render().catch(() => undefined);
  renderStart();
  renderRules();
  renderTemplates();
  renderEvents();
  renderMessages();
}

/**
 * The language toggle (docs/i18n-spec.md, Section 3.9). A choice is only
 * written: the page follows through `storage.onChanged`, the same path
 * every other tab takes.
 */
const language = document.querySelector<HTMLSelectElement>("#joyfox-language");
language?.addEventListener("change", () => {
  const value = language.value;
  if (!isLocale(value)) return;
  void runtimeSettingsArea.set({ [LOCALE_KEY]: value }).catch(() => {
    // Not saved: show the language that is still in use.
    language.value = currentLocale();
  });
});

/** Every panel draws again in the new language. Unsaved input stays. */
onLocaleChange((locale) => {
  applyStaticText(document);
  if (language) language.value = locale;
  if (accounts) void accounts.render().catch(() => undefined);
  else if (accountsFailed && accountRoot)
    accountRoot.textContent = t("accounts.readFailed");
  renderStart();
  if (rules) void rules.localeChanged().catch(() => undefined);
  renderTemplates();
  renderEvents();
  renderMessages();
  renderData();
});

let localeHeard = false;
browser.storage.onChanged.addListener((changes, area) => {
  if (area !== "local") return;
  if (LOCALE_KEY in changes) {
    localeHeard = true;
    // A removed value ("delete all JoyFox data") means Firefox's language.
    setLocale(localeFromSetting(changes[LOCALE_KEY]?.newValue));
  }
  // The rule and templates belong to the active account, so a switch (or a
  // "delete all" in another tab, which clears the pointer) redraws them.
  if (ACTIVE_ACCOUNT_SETTING_KEY in changes) {
    if (accounts) void accounts.render().catch(() => undefined);
    renderStart();
    renderRules();
    renderTemplates();
    renderEvents();
    renderMessages();
    renderData();
  }
  // Another tab may have saved or removed the rule. Redraw only if the
  // stored rule differs from the form, so edits in progress are kept.
  else if (TRIAGE_REVISION_KEY in changes) {
    // Also set by a rule save, which "Get started" reports.
    renderStart();
    if (rules) void rules.refreshIfChanged().catch(() => undefined);
    renderEvents();
    renderMessages();
    renderData();
  }
  // Messages stored from a conversation, or the message settings (V1-4).
  if (
    MESSAGE_REVISION_KEY in changes ||
    MESSAGE_CACHING_KEY in changes ||
    MESSAGE_RETENTION_KEY in changes
  ) {
    renderMessages();
    if (MESSAGE_REVISION_KEY in changes) renderData();
  }
  // Event notes saved on a JoyClub page.
  if (EVENT_REVISION_KEY in changes) {
    renderEvents();
    renderData();
  }
});

// The language is known before the first drawing, so the page never flashes
// English text for a German user. The English in the HTML is the fallback
// until then.
void readLocale(runtimeSettingsArea).then((locale) => {
  // A change heard while reading is newer than what was read.
  if (!localeHeard) setLocale(locale);
  applyStaticText(document);
  if (language) language.value = currentLocale();
  mountAccounts();
  renderStart();
  renderRules();
  renderTemplates();
  renderEvents();
  renderMessages();
  renderData();
});
