export type PageType =
  | "inbox"
  | "conversation"
  | "profile"
  | "search"
  | "event"
  | "event-calendar"
  | "venue"
  | "unknown";
export type SelectorStatus = "unverified" | "verified";

export interface PageSelectorDefinition {
  status: SelectorStatus;
  /** Evidence file in `docs/live-evidence/` that verified this definition. */
  evidence?: string;
  /** Regular expression source matched against `location.pathname`. */
  path?: string;
  /** An element that exists once the page's content has rendered. */
  root?: string;
  fields: Readonly<Record<string, string>>;
}

/**
 * Field value meaning "read from the page URL, not from an element". The
 * profile page carries its member ID only in the URL (03-profile.md).
 */
export const FROM_URL = "url:pathname";

/**
 * Only hosts the evidence was captured on. JOYCE (joyce.app) is permitted by
 * the manifest but has no evidence, so no page is detected there.
 */
export const VERIFIED_HOSTS: readonly string[] = ["www.joyclub.de"];

/**
 * Every verified entry cites the sanitized evidence it came from. Prefer the
 * site's `data-e2e` test hooks and BEM class names; never use the `data-v-*`
 * attributes, which are build hashes that change with each site release.
 */
export const selectorRegistry: Readonly<
  Record<Exclude<PageType, "unknown">, PageSelectorDefinition>
> = {
  inbox: {
    status: "verified",
    evidence: "01-inbox.md",
    path: "^/clubmail/?$",
    root: ".cm-conversation-list",
    fields: {
      row: ".cm-conversation-list-item",
      // Display only (F2). Never an identity: resolveMemberIdentity refuses it.
      senderName: '[data-e2e="conversation-list-item-name"]',
      memberId: ".cm-conversation-list-item__avatar[href]",
      verificationCode: "j-veri-icon[verification-status]",
      genderCode: "j-gender-icon[universal-gender]",
      readStatus: ".cm-conversation-list-item__read-status",
      // Compared with the rule's phrases (ADR 0013). Never stored or logged.
      messagePreview: ".cm-conversation-list-item__text",
    },
  },
  conversation: {
    status: "verified",
    evidence: "02-conversation.md",
    path: "^/clubmail/conversation/conversation-wrapper-(personal-\\d+-\\d+)/?$",
    root: ".cm-conversation-header",
    fields: {
      memberId: "a.cm-conversation-header[href]",
      verificationCode:
        ".cm-conversation-header j-veri-icon[verification-status]",
      genderCode: ".cm-conversation-header j-gender-icon[universal-gender]",
      profileDescription: ".cm-conversation-header__description",
      messageItem: "li.cm-message-list-item",
      composer: "textarea.joy-input-wonder__input",
      sendButton: 'button.joy-input-wonder__button[data-e2e="button-submit"]',
    },
  },
  profile: {
    status: "verified",
    evidence: "03-profile.md",
    path: "^/profile/(\\d+)\\.[^/]+\\.html$",
    root: '[data-e2e="profile-header-base-info"]',
    fields: {
      memberId: FROM_URL,
      verificationCode:
        '[data-e2e="profile-header-base-info"] j-veri-icon[verification-status]',
      genderCode:
        '[data-e2e="profile-header-base-info"] j-gender-icon[universal-gender]',
      photoCount: ".amount-badge[aria-label]",
      // One badge in this list reads "Angemeldet seit <n> <unit>"; the
      // extractor picks it by that text, as the badges share one structure.
      memberSinceBadge: ".profile-sidebar-container__badge-list j-list-item",
      // Only the main text is counted; the motto above it is not.
      profileMainText: ".profile-description-maintext__text",
      // V1-2, from 13-preferences.md. The "Vorlieben" checklist: one level
      // group per level that has tags, each tag a `j-tag` whose label is in
      // its shadow root. Each person has a visible and a hidden copy.
      preferenceSection: "div.profile-erotic-prefs",
      preferenceLevel: "div.profile-erotic-prefs__category",
      preferenceLevelTitle: "h4.profile-erotic-prefs__category-title",
      preferenceTag: "div.profile-erotic-prefs__category-item-list > j-tag",
      preferenceTagLabel: "a.j-tag",
      // Only the viewer's own profile has the "Account" headline.
      ownProfileHeadline: "h2.profile-headline",
    },
  },
  search: {
    status: "verified",
    evidence: "11-search.md",
    // `/member/` and its filtered form `/member/<place>-as-r/is-<genders>/`.
    // Filters apply in place: the address changes without a page load.
    path: "^/member/(?:[^/]+/)*$",
    root: "div.member_search_list",
    fields: {
      resultList: "div.member_search_list",
      filterButton: '[data-e2e="search-filter-button"]',
      // The member ID is in the link (V1-2 reads it for the shared count).
      resultLink: 'a[data-e2e="result-item"]',
      resultCard: "j-member-card",
    },
  },
  event: {
    status: "verified",
    evidence: "14-events.md",
    // The event ID is the number in the path; no attribute holds it.
    path: "^/event/(\\d+)\\.[^/]+\\.html$",
    root: "h1.event_name",
    fields: {
      eventId: FROM_URL,
      title: "h1.event_name",
      infoBox: ".event_info_box",
      startText: ".event_info_box .event-time",
      venueLink: ".event_location_detail a.event_club",
      // V1-2: the guest list tabs; each entry is a link to a profile.
      attendeeEntry: '.tab-pane[id^="guest_"] a.card.normal',
      attendeeName: "div.date_moreinfo",
    },
  },
  // "Dates & Events" and its sub-tabs; one list holds event and date cards.
  "event-calendar": {
    status: "verified",
    evidence: "14-events.md",
    path: "^/dates_partys/",
    root: "div.card-list-ui",
    fields: {
      list: "div.card-list-ui",
      item: "div.card-list-ui-list-item",
      eventItem: "div.card-list-ui-list-item.event-card-ui[data-element-id]",
      headline: ".card-ui-detail-right-headline",
    },
  },
  // A venue ("Club") uses the profile template; its ID is a member ID.
  venue: {
    status: "verified",
    evidence: "15-venues.md",
    path: "^/club/(\\d+)\\.[^/]+\\.html$",
    root: "h1.profile_name",
    fields: {
      venueId: FROM_URL,
      name: "h1.profile_name",
    },
  },
};

export function verifiedSelector(
  page: Exclude<PageType, "unknown">,
  field: string,
): string | undefined {
  const definition = selectorRegistry[page];
  return definition.status === "verified"
    ? definition.fields[field]
    : undefined;
}

export function hasVerifiedSelectors(): boolean {
  return Object.values(selectorRegistry).some(
    (definition) => definition.status === "verified",
  );
}
