import { ACTIVE_ACCOUNT_SETTING_KEY } from "../accounts/account-service";
import { extractInboxRows } from "../extraction/joyclub";
import { hasVerifiedSelectors, VERIFIED_HOSTS } from "../selectors/registry";
import { runtimeSettingsArea } from "../storage/local-settings";
import { TRIAGE_REVISION_KEY } from "../storage/triage-revision";
import {
  DIAGNOSTICS_KEY,
  DiagnosticsFlag,
  summarizeInbox,
} from "./diagnostics";
import { InboxTriage } from "./inbox-triage";
import { MemberPanel } from "./member-panel";
import { NavigationCoordinator } from "./navigation-coordinator";
import { detectPage } from "./page-detector";
import { runtimeTriageClient } from "./triage-client";

/**
 * Start only on a host with verified selectors. The manifest also injects
 * this script on JOYCE and other JoyClub subdomains, where detection can
 * never succeed, so no observer or timer is installed there.
 */
if (hasVerifiedSelectors() && VERIFIED_HOSTS.includes(location.hostname)) {
  const coordinator = new NavigationCoordinator(detectPage);
  const storageEvents = (globalThis as { browser?: typeof browser }).browser
    ?.storage?.onChanged;
  const diagnostics = new DiagnosticsFlag(
    () => runtimeSettingsArea.get([DIAGNOSTICS_KEY]),
    storageEvents,
  );
  const client = runtimeTriageClient();
  const inbox = new InboxTriage(document, client);
  const panel = new MemberPanel(document, client);
  let lastSummary = "";
  coordinator.subscribe(({ page }) => {
    const type = page.status === "found" ? page.value : undefined;
    if (type === "inbox") inbox.update();
    else inbox.teardown();
    if (type === "conversation" || type === "profile") panel.update(type);
    else panel.leave();
  });
  coordinator.subscribe(({ page }) => {
    // Checked on every event, so removing the flag stops output at once.
    if (!diagnostics.enabled) return;
    if (page.status !== "found" || page.value !== "inbox") return;
    const summary = summarizeInbox(extractInboxRows(document, location.href));
    // Mutations fire often; log only when the counts change.
    if (summary === lastSummary) return;
    lastSummary = summary;
    console.debug(`JoyFox ${summary}`);
  });
  // A rule, placement, trust or snapshot write, or an account switch, in
  // any tab or the options page: re-evaluate what this page shows.
  storageEvents?.addListener((changes, area) => {
    if (area !== "local") return;
    if (ACTIVE_ACCOUNT_SETTING_KEY in changes) {
      inbox.accountChanged();
      panel.accountChanged();
    } else if (TRIAGE_REVISION_KEY in changes) {
      inbox.invalidate();
      panel.invalidate();
    }
  });
  // Start after the initial flag is known, so the first event is not missed.
  void diagnostics.ready.then(() => coordinator.start());
}
