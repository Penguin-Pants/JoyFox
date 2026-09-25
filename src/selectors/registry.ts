export type PageType =
  | "inbox"
  | "conversation"
  | "profile"
  | "search"
  | "event"
  | "event-calendar"
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

const unverified = (): PageSelectorDefinition => ({
  status: "unverified",
  fields: {},
});

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
    },
  },
  search: unverified(),
  event: unverified(),
  "event-calendar": unverified(),
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
