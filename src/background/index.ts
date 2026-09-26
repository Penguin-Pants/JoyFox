import { AccountService } from "../accounts/account-service";
import { ActionLogService } from "../actions/action-log-service";
import { CompatibilityService } from "../compatibility/compatibility-service";
import { MessageRouter } from "../messaging/router";
import { runtimeSessionArea } from "../storage/session-area";
import { EventTrackerService } from "../events/event-service";
import { NotesService } from "../notes/notes-service";
import { SavedSearchService } from "../search/saved-search-service";
import { TemplateService } from "../templates/template-service";
import { TriageService } from "../triage/triage-service";
import { TrustService } from "../trust/trust-service";
import { registerActionHandlers } from "./action-handlers";
import { incrementPersistentWakeCounter } from "./lifecycle";
import { registerCompatibilityHandlers } from "./compatibility-handlers";
import { registerListingHandlers } from "./listing-handlers";
import { registerNotesHandlers } from "./notes-handlers";
import { registerOnboarding } from "./onboarding";
import { registerSearchHandlers } from "./search-handlers";
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
registerCompatibilityHandlers(router, {
  compatibility: new CompatibilityService(),
  activeAccountId,
});
// M9's ActionLog and the hand-off marker for its move to the profile page.
registerActionHandlers(router, {
  actions: new ActionLogService(),
  activeAccountId,
  session: runtimeSessionArea,
});
registerTemplateHandlers(router, {
  templates: new TemplateService(),
  activeAccountId,
});
registerSearchHandlers(router, {
  searches: new SavedSearchService(),
  activeAccountId,
});
registerListingHandlers(router, {
  listings: new EventTrackerService(),
  activeAccountId,
});
registerOnboarding(browser.runtime);
browser.runtime.onMessage.addListener(
  (message: unknown, sender: browser.runtime.MessageSender) =>
    router.route(message as never, {
      ...(typeof sender?.tab?.id === "number" ? { tabId: sender.tab.id } : {}),
      ...(typeof sender?.url === "string" ? { url: sender.url } : {}),
    }),
);
