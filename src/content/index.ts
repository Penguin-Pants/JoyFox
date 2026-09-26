import { ACTIVE_ACCOUNT_SETTING_KEY } from "../accounts/account-service";
import { readPreferences } from "../extraction/preferences";
import { extractInboxRows } from "../extraction/joyclub";
import { LOCALE_KEY, localeFromSetting, readLocale } from "../i18n/locale";
import { onLocaleChange, setLocale } from "../i18n/translator";
import { hasVerifiedSelectors, VERIFIED_HOSTS } from "../selectors/registry";
import { runtimeSettingsArea } from "../storage/local-settings";
import { ACTION_REVISION_KEY } from "../storage/action-revision";
import { EVENT_REVISION_KEY } from "../storage/event-revision";
import { NOTES_REVISION_KEY } from "../storage/notes-revision";
import { SAVED_SEARCH_REVISION_KEY } from "../storage/saved-search-revision";
import { TRIAGE_REVISION_KEY } from "../storage/triage-revision";
import {
  DIAGNOSTICS_KEY,
  DiagnosticsFlag,
  logDiagnostic,
  summarizeInbox,
} from "./diagnostics";
import { InboxTriage, inboxListShown, inboxListState } from "./inbox-triage";
import {
  CompatibilityOverlay,
  runtimeCompatibilityClient,
} from "./compatibility";
import { EventListFilter } from "./event-list-filter";
import { PreferenceRetry } from "./preference-retry";
import { ListingPanel, runtimeListingClient } from "./listing-panel";
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
import { runtimeSavedSearchClient, SavedSearchBar } from "./saved-searches";
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
  const searches = new SavedSearchBar(document, runtimeSavedSearchClient());
  const listingClient = runtimeListingClient();
  const listing = new ListingPanel(document, listingClient);
  const eventFilter = new EventListFilter(document, listingClient);
  const compatibility = new CompatibilityOverlay(
    document,
    runtimeCompatibilityClient(),
  );
  const quick = new QuickIgnoreDelete(
    document,
    runtimeQuickActionClient(),
    liveQuickActionDriver,
  );
  // A language picked on the options page redraws every JoyFox surface in
  // this tab at once, with no reload. Unsaved input stays.
  onLocaleChange(() => {
    inbox.localeChanged();
    panel.localeChanged();
    notes.localeChanged();
    picker.localeChanged();
    quick.localeChanged();
    searches.localeChanged();
    listing.localeChanged();
    eventFilter.localeChanged();
    compatibility.localeChanged();
  });
  const preferenceRetry = new PreferenceRetry(() => coordinator.refresh());
  let lastType: string | undefined;
  const updatePicker = () => {
    if (lastType === "conversation" && templatePicker.enabled) picker.update();
    else picker.leave();
  };
  const updateQuickAction = () => {
    // Turning the flag off also stops a run before its next click.
    if (!quickAction.enabled) {
      quick.turnOff();
      return;
    }
    quick.pageSeen();
    if (lastType === "conversation") quick.update();
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
    if (type === "search") searches.update();
    else searches.leave();
    if (type === "event" || type === "venue") listing.update(type);
    else listing.leave();
    if (type === "event-calendar") eventFilter.update();
    else eventFilter.leave();
    // Profile, search results, the inbox list and event guest lists (V1-2).
    compatibility.update(type);
    // Labels still drawing in their shadow roots wake no observer.
    preferenceRetry.check(
      document.URL,
      type === "profile" && readPreferences(document).status === "unreadable",
    );
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
      logDiagnostic(pageLine);
    }
    if (!inboxListShown(document)) return;
    const summary = summarizeInbox(extractInboxRows(document, location.href));
    // Mutations fire often; log only when the counts change.
    if (summary === lastSummary) return;
    lastSummary = summary;
    logDiagnostic(summary);
  });
  // A rule, placement, trust or snapshot write, or an account switch, in
  // any tab or the options page: re-evaluate what this page shows.
  let localeChanged = false;
  storageEvents?.addListener((changes, area) => {
    if (area !== "local") return;
    if (LOCALE_KEY in changes) {
      localeChanged = true;
      // A removed value ("delete all JoyFox data") means Firefox's language.
      setLocale(localeFromSetting(changes[LOCALE_KEY]?.newValue));
    }
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
      searches.accountChanged();
      listing.accountChanged();
      eventFilter.accountChanged();
      compatibility.accountChanged();
    } else if (TRIAGE_REVISION_KEY in changes) {
      // Also set by every delete in the data inspector, so a deleted note,
      // tag or saved search leaves an open page at once.
      inbox.invalidate();
      panel.invalidate();
      notes.invalidate();
      quick.invalidate();
      searches.invalidate();
      listing.invalidate();
      eventFilter.invalidate();
      // A snapshot capture: a profile's preferences, or the viewer's own.
      compatibility.invalidate();
    } else if (NOTES_REVISION_KEY in changes) {
      // A note or tag saved in another tab.
      notes.invalidate();
    }
    // A search saved or deleted in another tab.
    if (SAVED_SEARCH_REVISION_KEY in changes) searches.invalidate();
    // Event or venue notes saved in another tab.
    if (EVENT_REVISION_KEY in changes) {
      listing.invalidate();
      eventFilter.invalidate();
    }
  });
  // Start after the initial flag and language are known, so the first event
  // is not missed and the first drawing is already in the right language.
  const language = readLocale(runtimeSettingsArea).then((locale) => {
    // A change heard while reading is newer than what was read.
    if (!localeChanged) setLocale(locale);
  });
  void Promise.all([
    diagnostics.ready,
    templatePicker.ready,
    quickAction.ready,
    language,
  ]).then(() => coordinator.start());
}
