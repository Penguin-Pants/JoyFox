import { message } from "../i18n/message";
import { formatWallTime, t } from "../i18n/translator";
import type {
  ExtensionMessage,
  ExtensionResponse,
  ListingSummary,
  MessageContract,
} from "../messaging/protocol";
import { request, type MessageSender } from "../messaging/request";
import { MAX_EVENT_ATTENDEES } from "../events/listing";
import { ATTENDANCE_TEXT } from "./listing-panel";
import { memberCards } from "./member-cards";
import { pageMember } from "./member-panel";
import { isPlaced, placeInStrip, removeEmptyStrip } from "./member-strip";
import { element, UI_ATTRIBUTE } from "./triage-ui";
import { selectorRegistry } from "../selectors/registry";

type AttendeesAnswer = MessageContract["listing.attendees"]["response"];
type ForMemberAnswer = MessageContract["listing.forMember"]["response"];

export interface SharedEventsClient {
  recordAttendees(
    accountId: string,
    eventId: string,
    memberIds: string[],
  ): Promise<AttendeesAnswer>;
  forMember(memberId: string): Promise<ForMemberAnswer>;
}

export function messageSharedEventsClient(
  sender: MessageSender,
): SharedEventsClient {
  return {
    recordAttendees: (accountId, eventId, memberIds) =>
      request(sender, "listing.attendees", { accountId, eventId, memberIds }),
    forMember: (memberId) => request(sender, "listing.forMember", { memberId }),
  };
}

export function runtimeSharedEventsClient(): SharedEventsClient {
  return messageSharedEventsClient(
    (message: ExtensionMessage) =>
      browser.runtime.sendMessage(message) as Promise<ExtensionResponse>,
  );
}

/** A failed request is tried again on later redraws, this many times. */
const MAX_TRIES = 3;

/** The section on a profile page that lists the shared tracked events. */
export const SHARED_EVENTS_SECTION = "shared-events";

/** The event ID in an event page's address (14-events.md). */
function pageEventId(document: Document): string | undefined {
  const path = selectorRegistry.event.path;
  if (!path) return undefined;
  try {
    return new RegExp(path).exec(new URL(document.URL).pathname)?.[1];
  } catch {
    return undefined;
  }
}

/**
 * V1-13 (PRD 9.3): on a tracked event's page, the member IDs its guest list
 * shows are stored with the event; JoyFox reads only what JoyClub already
 * loaded and never clicks "Mehr Ergebnisse". On a profile page, a section
 * lists the tracked events whose stored guest list names the member.
 */
export class SharedEvents {
  /** What was sent per event, so an unchanged list is not sent again. */
  #sent = new Map<string, string>();
  /** Set after a refusal or an untracked event, until a change. */
  #stopped = new Set<string>();
  /** Failed requests per event or member, so a transient error retries. */
  #failures = new Map<string, number>();
  #profileSession = 0;
  #profileMember?: string;
  #profileData?: { memberId: string; listings: ListingSummary[] };
  #rendered = "";
  #version = 0;

  constructor(
    private readonly document: Document,
    private readonly client: SharedEventsClient,
    /** The account active now, as `storage.local` holds it. */
    private readonly activeAccount: () => string | undefined,
  ) {}

  update(type: string | undefined): void {
    if (type === "event") this.#captureGuests();
    if (type === "profile") this.#drawProfile();
    else this.#removeSection();
  }

  /** Event notes changed, or the account: read and send again. */
  invalidate(): void {
    this.#sent.clear();
    this.#stopped.clear();
    this.#failures.clear();
    this.#profileSession += 1;
    this.#profileData = undefined;
    this.#profileMember = undefined;
    this.#rendered = "";
  }

  localeChanged(): void {
    this.#version += 1;
    this.#rendered = "";
  }

  #captureGuests(): void {
    const eventId = pageEventId(this.document);
    const accountId = this.activeAccount();
    if (!eventId || !accountId) return;
    const key = `${accountId}|${eventId}`;
    if (this.#stopped.has(key)) return;
    const shown = memberCards(this.document, "event").find(
      ([surface]) => surface === "attendees",
    )?.[1];
    const ids = [...new Set((shown ?? []).map((card) => card.memberId))]
      .sort()
      .slice(0, MAX_EVENT_ATTENDEES);
    if (ids.length === 0) return;
    const version = ids.join(",");
    if (this.#sent.get(key) === version) return;
    this.#sent.set(key, version);
    void this.client
      .recordAttendees(accountId, eventId, ids)
      .then((answer) => {
        // Not tracked, or the account changed: nothing is kept; ask again
        // once the notes or the account change.
        if (answer.status === "untracked" || answer.status === "refused")
          this.#stopped.add(key);
      })
      .catch(() => {
        // A failed send is tried again on a later redraw, a few times.
        this.#sent.delete(key);
        if (this.#failed(key)) this.#stopped.add(key);
      });
  }

  /** Counts a failure; true once the key has failed `MAX_TRIES` times. */
  #failed(key: string): boolean {
    const count = (this.#failures.get(key) ?? 0) + 1;
    this.#failures.set(key, count);
    return count >= MAX_TRIES;
  }

  #section(): HTMLElement | null {
    return this.document.querySelector<HTMLElement>(
      `[${UI_ATTRIBUTE}="${SHARED_EVENTS_SECTION}"]`,
    );
  }

  #removeSection(): void {
    this.#section()?.remove();
    removeEmptyStrip(this.document);
    this.#rendered = "";
  }

  #drawProfile(): void {
    const member = pageMember(this.document, "profile");
    if (!member) return this.#removeSection();
    if (this.#profileMember !== member.memberId) {
      this.#profileMember = member.memberId;
      this.#profileData = undefined;
      const session = (this.#profileSession += 1);
      const memberId = member.memberId;
      void this.client
        .forMember(memberId)
        .then((answer) => {
          if (session !== this.#profileSession) return;
          this.#profileData = {
            memberId,
            listings: answer.status === "ok" ? answer.listings : [],
          };
          this.#drawProfile();
        })
        .catch(() => {
          if (session !== this.#profileSession) return;
          // Read again on a later redraw, a few times.
          if (!this.#failed(`profile|${memberId}`))
            this.#profileMember = undefined;
        });
    }
    const data = this.#profileData;
    if (
      !data ||
      data.memberId !== member.memberId ||
      data.listings.length === 0
    )
      return this.#removeSection();
    const key = JSON.stringify([data, this.#version]);
    const existing = this.#section();
    if (existing && key === this.#rendered && isPlaced(existing, member.anchor))
      return;
    this.#rendered = key;
    const section = element(
      this.document,
      "section",
      "joyfox-panel joyfox-shared-events",
    );
    section.setAttribute(UI_ATTRIBUTE, SHARED_EVENTS_SECTION);
    // A group inside the strip's one "JoyFox" region, not a landmark.
    section.setAttribute("role", "group");
    section.setAttribute("aria-label", t("sharedEvents.heading"));
    section.append(
      element(this.document, "strong", "", t("sharedEvents.heading")),
      element(this.document, "p", "joyfox-note", t("sharedEvents.intro")),
    );
    const list = element(this.document, "ul", "joyfox-shared-events__list");
    for (const listing of data.listings) {
      const parts = [
        listing.title ?? t(message("events.untitled", { id: listing.eventId })),
      ];
      if (listing.startLocal) parts.push(formatWallTime(listing.startLocal));
      if (listing.attendance !== "unknown")
        parts.push(t(ATTENDANCE_TEXT[listing.attendance]));
      list.append(element(this.document, "li", "", parts.join(" · ")));
    }
    section.append(list);
    existing?.remove();
    placeInStrip(this.document, member.anchor, section);
  }
}
