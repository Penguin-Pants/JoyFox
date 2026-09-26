import type { ExtractionResult } from "../domain/types";
import {
  extractInboxRows,
  memberIdFromProfileHref,
} from "../extraction/joyclub";
import type { ProfileFacts } from "../qualification/facts";
import { verifiedSelector, type PageType } from "../selectors/registry";
import { inboxListShown } from "./inbox-triage";
import { observedFromInboxRow, observedFromShield } from "./observed-facts";
import { UI_ATTRIBUTE } from "./triage-ui";

/**
 * The surfaces where JoyClub shows a member as a card (PRD 8.3): search
 * results (11-search.md), inbox rows (01-inbox.md) and event guest lists
 * (14-events.md). V1-2's shared count and V1-10's signals both read them
 * here, so every feature sees the same cards.
 */
export type Surface = "search" | "inbox" | "attendees";

export interface MemberCard {
  surface: Surface;
  memberId: string;
  /** What the card itself shows, such as its verification shield. */
  observed: Partial<ProfileFacts>;
  /** The shared-count badge's host, to find one already placed (V1-2). */
  badgeHost: Element;
  placeBadge(badge: HTMLElement): void;
  /** The signals group's host, to find one already placed (V1-10). */
  signalsHost: Element;
  placeSignals(group: HTMLElement): void;
}

/** The `data-joyfox-ui` value of the shared-count badge (V1-2). */
export const COMPAT_BADGE = "compat-badge";

function linkMember(
  document: Document,
  link: Element,
  source: string,
): string | undefined {
  const id = memberIdFromProfileHref(
    link.getAttribute("href"),
    document.URL,
    source,
  );
  return id.status === "found" ? id.value : undefined;
}

/** A card's shield code, as the inbox reads it (08-attribute-matrix.md). */
function shieldCode(element: Element): ExtractionResult<number> {
  const raw = element.getAttribute("verification-status");
  const value = raw === null ? Number.NaN : Number(raw);
  return Number.isInteger(value) && value >= 0
    ? { status: "found", value, source: "search.resultCard" }
    : { status: "missing", source: "search.resultCard" };
}

function searchCards(document: Document): MemberCard[] {
  const linkSelector = verifiedSelector("search", "resultLink");
  const cardSelector = verifiedSelector("search", "resultCard");
  if (!linkSelector) return [];
  const cards: MemberCard[] = [];
  for (const link of Array.from(document.querySelectorAll(linkSelector))) {
    const memberId = linkMember(document, link, "search.resultLink");
    if (!memberId) continue;
    const card = cardSelector ? link.querySelector(cardSelector) : null;
    const badgeHost = card ?? link;
    cards.push({
      surface: "search",
      memberId,
      observed: card ? observedFromShield(shieldCode(card)) : {},
      badgeHost,
      // A light-DOM child with this slot draws over the card's photo
      // (11-search.md, "Badge slots").
      placeBadge: (badge) => {
        badge.setAttribute("slot", "badge-top-right");
        badgeHost.append(badge);
      },
      // After the card, inside the link: a light-DOM child of the card
      // itself has no place to draw without a slot.
      signalsHost: link,
      placeSignals: (group) => link.append(group),
    });
  }
  return cards;
}

function inboxCards(document: Document): MemberCard[] {
  const nameSelector = verifiedSelector("inbox", "senderName");
  const cards: MemberCard[] = [];
  for (const row of extractInboxRows(document, document.URL)) {
    if (row.memberId.status !== "found") continue;
    const host = row.row;
    // After the name, the triage badge and the shared count, in that order.
    const after = (...marks: string[]) =>
      marks
        .map((mark) => host.querySelector(`[${UI_ATTRIBUTE}="${mark}"]`))
        .find((node) => node !== null) ??
      (nameSelector ? host.querySelector(nameSelector) : null);
    cards.push({
      surface: "inbox",
      memberId: row.memberId.value,
      observed: observedFromInboxRow(row),
      badgeHost: host,
      placeBadge: (badge) => {
        const anchor = after("badge");
        if (anchor) anchor.after(badge);
        else host.append(badge);
      },
      signalsHost: host,
      placeSignals: (group) => {
        const anchor = after(COMPAT_BADGE, "badge");
        if (anchor) anchor.after(group);
        else host.append(group);
      },
    });
  }
  return cards;
}

function attendeeCards(document: Document): MemberCard[] {
  const entrySelector = verifiedSelector("event", "attendeeEntry");
  const nameSelector = verifiedSelector("event", "attendeeName");
  if (!entrySelector) return [];
  const cards: MemberCard[] = [];
  for (const entry of Array.from(document.querySelectorAll(entrySelector))) {
    const memberId = linkMember(document, entry, "event.attendeeEntry");
    if (!memberId) continue;
    const name = nameSelector ? entry.querySelector(nameSelector) : null;
    const host = name ?? entry;
    cards.push({
      surface: "attendees",
      memberId,
      // A guest entry shows a check icon, but no shield code (14-events.md).
      observed: {},
      badgeHost: host,
      placeBadge: (badge) => host.append(badge),
      signalsHost: host,
      placeSignals: (group) => host.append(group),
    });
  }
  return cards;
}

/** The cards each surface on the page shows, surface by surface. */
export function memberCards(
  document: Document,
  type: PageType | undefined,
): Array<[Surface, MemberCard[]]> {
  const surfaces: Array<[Surface, MemberCard[]]> = [];
  if (type === "search") surfaces.push(["search", searchCards(document)]);
  if (inboxListShown(document)) surfaces.push(["inbox", inboxCards(document)]);
  if (type === "event") surfaces.push(["attendees", attendeeCards(document)]);
  return surfaces;
}

/**
 * The element that holds the loaded search results, and each result's own
 * item in it: the child of that element that contains the result's link.
 */
export function resultItems(
  document: Document,
): { container: Element; items: Element[] } | undefined {
  const linkSelector = verifiedSelector("search", "resultLink");
  if (!linkSelector) return undefined;
  const links = Array.from(document.querySelectorAll(linkSelector));
  let container = links[0]?.parentElement ?? null;
  while (container && !links.every((link) => container?.contains(link)))
    container = container.parentElement;
  if (!container) return undefined;
  const items: Element[] = [];
  for (const link of links) {
    let item: Element | null = link;
    while (item && item.parentElement !== container) item = item.parentElement;
    if (item && !items.includes(item)) items.push(item);
  }
  return { container, items };
}
