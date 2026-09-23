import { AccountService } from "../accounts/account-service";
import { ActionLogService } from "../actions/action-log-service";
import { MessageRouter } from "../messaging/router";
import { NotesService } from "../notes/notes-service";
import { TemplateService } from "../templates/template-service";
import { TriageService } from "../triage/triage-service";
import { TrustService } from "../trust/trust-service";
import { registerActionHandlers } from "./action-handlers";
import { incrementPersistentWakeCounter } from "./lifecycle";
import { registerNotesHandlers } from "./notes-handlers";
import { registerOnboarding } from "./onboarding";
import { registerTemplateHandlers } from "./template-handlers";
import { registerTriageHandlers } from "./triage-handlers";

const router = new MessageRouter();
router.register("diagnostic.ping", ({ value }) => ({ value }));
// Exercises the persisted wake counter from the packaged background bundle so
// the forced-restart verification in docs/manual-verification-needed.md can be
// performed against a real background event.
router.register("diagnostic.wake", async ({ accountId }) => ({
  wakeCount: await incrementPersistentWakeCounter(accountId),
}));
const accounts = new AccountService();
// Resolved on every request, so switching accounts in the options page
// takes effect without a restart, and a dangling pointer means no account.
const activeAccountId = async () => (await accounts.getActiveAccount())?.id;
registerTriageHandlers(router, {
  triage: new TriageService(),
  trust: new TrustService(),
  activeAccountId,
  openOptions: () => browser.runtime.openOptionsPage(),
});
registerNotesHandlers(router, { notes: new NotesService(), activeAccountId });
// M9's ActionLog. No page starts an operation until F7 verifies a live path.
registerActionHandlers(router, {
  actions: new ActionLogService(),
  activeAccountId,
});
registerTemplateHandlers(router, {
  templates: new TemplateService(),
  activeAccountId,
});
registerOnboarding(browser.runtime);
browser.runtime.onMessage.addListener((message: unknown) =>
  router.route(message as never),
);
