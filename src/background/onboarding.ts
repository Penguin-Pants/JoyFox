/** The part of `browser.runtime` onboarding uses; tests supply their own. */
export interface InstallEvents {
  onInstalled: {
    addListener(listener: (details: { reason: string }) => void): void;
  };
  openOptionsPage(): Promise<void>;
}

/**
 * Onboarding (build plan Section 28, PRD Section 21.1): on a fresh install,
 * open the options page once, where "Get started" lists the steps to a
 * triaged inbox. An update or a browser update opens nothing. Registered at
 * the top level of the background script, as event pages require.
 */
export function registerOnboarding(runtime: InstallEvents): void {
  runtime.onInstalled.addListener(({ reason }) => {
    if (reason === "install")
      void runtime.openOptionsPage().catch(() => undefined);
  });
}
