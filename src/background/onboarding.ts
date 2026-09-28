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

/** The part of `browser.action` the toolbar button uses; tests supply their own. */
export interface ToolbarButton {
  onClicked: { addListener(listener: () => void): void };
}

/**
 * The toolbar button: a click opens the options page, where the active
 * account, the contact rule, message search and the events calendar live.
 * Without it the page is reachable only through about:addons. It has no popup
 * and needs no permission. Registered at the top level, as event pages
 * require; a Firefox without `browser.action` simply has no button.
 */
export function registerToolbarButton(
  action: ToolbarButton | undefined,
  openOptionsPage: () => Promise<void>,
): void {
  action?.onClicked.addListener(() => {
    void openOptionsPage().catch(() => undefined);
  });
}
