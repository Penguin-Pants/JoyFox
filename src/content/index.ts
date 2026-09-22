import { extractInboxRows } from "../extraction/joyclub";
import { hasVerifiedSelectors, VERIFIED_HOSTS } from "../selectors/registry";
import { runtimeSettingsArea } from "../storage/local-settings";
import { DIAGNOSTICS_KEY, summarizeInbox } from "./diagnostics";
import { NavigationCoordinator } from "./navigation-coordinator";
import { detectPage } from "./page-detector";

/**
 * Start only on a host with verified selectors. The manifest also injects
 * this script on JOYCE and other JoyClub subdomains, where detection can
 * never succeed, so no observer or timer is installed there.
 */
if (hasVerifiedSelectors() && VERIFIED_HOSTS.includes(location.hostname)) {
  const coordinator = new NavigationCoordinator(detectPage);
  let lastSummary = "";
  // Read the diagnostics flag before starting, so a listener subscribes in
  // time for the initial event. A storage failure leaves diagnostics off.
  void runtimeSettingsArea
    .get([DIAGNOSTICS_KEY])
    .then((settings) => settings[DIAGNOSTICS_KEY] === true)
    .catch(() => false)
    .then((diagnostics) => {
      if (diagnostics)
        coordinator.subscribe(({ page }) => {
          if (page.status !== "found" || page.value !== "inbox") return;
          const summary = summarizeInbox(
            extractInboxRows(document, location.href),
          );
          // Mutations fire often; log only when the counts change.
          if (summary === lastSummary) return;
          lastSummary = summary;
          console.debug(`JoyFox ${summary}`);
        });
      coordinator.start();
    });
}
