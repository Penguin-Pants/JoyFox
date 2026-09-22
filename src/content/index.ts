import { extractInboxRows } from "../extraction/joyclub";
import { hasVerifiedSelectors, VERIFIED_HOSTS } from "../selectors/registry";
import { runtimeSettingsArea } from "../storage/local-settings";
import {
  DIAGNOSTICS_KEY,
  DiagnosticsFlag,
  summarizeInbox,
} from "./diagnostics";
import { NavigationCoordinator } from "./navigation-coordinator";
import { detectPage } from "./page-detector";

/**
 * Start only on a host with verified selectors. The manifest also injects
 * this script on JOYCE and other JoyClub subdomains, where detection can
 * never succeed, so no observer or timer is installed there.
 */
if (hasVerifiedSelectors() && VERIFIED_HOSTS.includes(location.hostname)) {
  const coordinator = new NavigationCoordinator(detectPage);
  const diagnostics = new DiagnosticsFlag(
    () => runtimeSettingsArea.get([DIAGNOSTICS_KEY]),
    (globalThis as { browser?: typeof browser }).browser?.storage?.onChanged,
  );
  let lastSummary = "";
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
  // Start after the initial flag is known, so the first event is not missed.
  void diagnostics.ready.then(() => coordinator.start());
}
