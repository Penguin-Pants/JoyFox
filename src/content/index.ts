import { ACTIVE_ACCOUNT_SETTING_KEY } from "../accounts/account-service";
import { extractInboxRows } from "../extraction/joyclub";
import { hasVerifiedSelectors, VERIFIED_HOSTS } from "../selectors/registry";
import { runtimeSettingsArea } from "../storage/local-settings";
import { ACTION_REVISION_KEY } from "../storage/action-revision";
import { NOTES_REVISION_KEY } from "../storage/notes-revision";
import { TRIAGE_REVISION_KEY } from "../storage/triage-revision";
import {
  DIAGNOSTICS_KEY,
  DiagnosticsFlag,
  summarizeInbox,
} from "./diagnostics";
import { InboxTriage, inboxListShown, inboxListState } from "./inbox-triage";
import { MemberNotes, runtimeNotesClient } from "./member-notes";
import { MemberPanel } from "./member-panel";
import { NavigationCoordinator } from "./navigation-coordinator";
import { detectPage } from "./page-detector";
import {
  liveQuickActionDriver,
  QUICK_ACTION_KEY,
  QuickIgnoreDelete,
  runtimeQuickActionClient,
} from "./quick-action";
import {
  runtimeTemplateClient,
  TEMPLATE_PICKER_KEY,
  TemplatePicker,
} from "./template-picker";
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
  const templatePicker = new DiagnosticsFlag(
    () => runtimeSettingsArea.get([TEMPLATE_PICKER_KEY]),
    storageEvents,
    TEMPLATE_PICKER_KEY,
    true,
  );
  // M9 is experimental and off unless set to `true` (ADR 0008, ADR 0011).
  const quickAction = new DiagnosticsFlag(
    () => runtimeSettingsArea.get([QUICK_ACTION_KEY]),
    storageEvents,
    QUICK_ACTION_KEY,
  );
  const client = runtimeTriageClient();
  const inbox = new InboxTriage(document, client);
  const panel = new MemberPanel(document, client);
  const notes = new MemberNotes(document, runtimeNotesClient());
  const picker = new TemplatePicker(document, runtimeTemplateClient());
  const quick = new QuickIgnoreDelete(
    document,
    runtimeQuickActionClient(),
    liveQuickActionDriver,
  );
  let lastType: string | undefined;
  const updatePicker = () => {
    if (lastType === "conversation" && templatePicker.enabled) picker.update();
    else picker.leave();
  };
  const updateQuickAction = () => {
    // Turning the flag off also stops a run before its next click.
    if (!quickAction.enabled) quick.turnOff();
    else if (lastType === "conversation") quick.update();
    // A run handed off from a conversation continues here (ADR 0011).
    else if (lastType === "profile") quick.updateProfile();
    else quick.leave();
  };
  let lastSummary = "";
  coordinator.subscribe(({ page }) => {
    const type = page.status === "found" ? page.value : undefined;
    // Triage follows the conversation list itself, not the URL: JoyClub shows
    // the list beside an open conversation, also after a reply is sent.
    if (inboxListShown(document)) inbox.update();
    else inbox.leave();
    if (type === "conversation" || type === "profile") {
      panel.update(type);
      notes.update(type);
    } else {
      panel.leave();
      notes.leave();
    }
    lastType = type;
    updatePicker();
    updateQuickAction();
  });
  let lastPageLine = "";
  coordinator.subscribe(({ page }) => {
    // Checked on every event, so removing the flag stops output at once.
    if (!diagnostics.enabled) return;
    // Page detection and list state, for diagnosing triage on live pages.
    // Holds only page types and detection sources, never a URL or an ID.
    const pageLine = `page=${
      page.status === "found"
        ? page.value
        : `${page.status}:${page.source ?? ""}`
    } inboxList=${inboxListState(document)}`;
    if (pageLine !== lastPageLine) {
      lastPageLine = pageLine;
      console.debug(`JoyFox ${pageLine}`);
    }
    if (!inboxListShown(document)) return;
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
    // The flag listener registered first, so it already holds the new value.
    if (TEMPLATE_PICKER_KEY in changes) updatePicker();
    if (QUICK_ACTION_KEY in changes) updateQuickAction();
    // A Quick Ignore and Delete run moved, in this tab or another one.
    if (ACTION_REVISION_KEY in changes) quick.invalidate();
    if (ACTIVE_ACCOUNT_SETTING_KEY in changes) {
      inbox.accountChanged();
      panel.accountChanged();
      notes.accountChanged();
      picker.accountChanged();
      quick.accountChanged();
    } else if (TRIAGE_REVISION_KEY in changes) {
      // Also set by every delete in the data inspector, so a deleted note
      // or tag leaves an open page at once.
      inbox.invalidate();
      panel.invalidate();
      notes.invalidate();
      quick.invalidate();
    } else if (NOTES_REVISION_KEY in changes) {
      // A note or tag saved in another tab.
      notes.invalidate();
    }
  });
  // Start after the initial flag is known, so the first event is not missed.
  void Promise.all([
    diagnostics.ready,
    templatePicker.ready,
    quickAction.ready,
  ]).then(() => coordinator.start());
}
