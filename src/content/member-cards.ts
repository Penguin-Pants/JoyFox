import type { ExtractionResult } from "../domain/types";
import {
  extractInboxRows,
  memberIdFromProfileHref,
} from "../extraction/joyclub";
import type { ProfileFacts } from "../qualification/facts";
import { verifiedSelector, type PageType } from "../selectors/registry";
import { placeInCardLine, placeInInboxLine } from "./card-line";
import { inboxListShown } from "./inbox-triage";
import { observedFromInboxRow, observedFromShield } from "./observed-facts";

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
  /**
   * The nickname the card shows, for JoyFox's own texts. Display only: the
   * member ID is the identity.
   */
  name?: string;
}

/** A nickname as the page shows it, or `undefined` for an empty one. */
function shownName(value: string | null | undefined): string | undefined {
  const name = value?.replace(/\s+/gu, " ").trim();
  return name ? name : undefined;
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
    const nameSelector = verifiedSelector("search", "resultName");
    const named = nameSelector ? link.querySelector(nameSelector) : null;
    const name = shownName(named?.getAttribute("user-name"));
    cards.push({
      surface: "search",
      memberId,
      ...(name ? { name } : {}),
      observed: card ? observedFromShield(shieldCode(card)) : {},
      badgeHost,
      // A light-DOM child with this slot draws over the card's photo
      // (11-search.md, "Badge slots").
      placeBadge: (badge) => {
        badge.setAttribute("slot", "badge-top-right");
        badgeHost.append(badge);
      },
      // The JoyFox line goes over the photo, in the card's `media-overlay`
      // slot. Placed after the card, it overflowed JoyClub's grid row and the
      // next row covered it (owner's live check, 2026-09-27).
      signalsHost: badgeHost,
      placeSignals: (group) =>
        placeInCardLine(
          badgeHost,
          group,
          card ? { slot: "media-overlay" } : {},
        ),
    });
  }
  return cards;
}

function inboxCards(document: Document): MemberCard[] {
  const cards: MemberCard[] = [];
  for (const row of extractInboxRows(document, document.URL)) {
    if (row.memberId.status !== "found") continue;
    const host = row.row;
    const name =
      row.senderName.status === "found"
        ? shownName(row.senderName.value)
        : undefined;
    // In the row's JoyFox line: the triage badge, the shared count and the
    // signals, in that order.
    cards.push({
      surface: "inbox",
      memberId: row.memberId.value,
      ...(name ? { name } : {}),
      observed: observedFromInboxRow(row),
      badgeHost: host,
      placeBadge: (badge) => placeInInboxLine(host, badge),
      signalsHost: host,
      placeSignals: (group) => placeInInboxLine(host, group),
    });
  }
  return cards;
}

function attendeeCards(document: Document): MemberCard[] {
  const entrySelector = verifiedSelector("event", "attendeeEntry");
  const infoSelector = verifiedSelector("event", "attendeeInfo");
  const nameSelector = verifiedSelector("event", "attendeeNickname");
  if (!entrySelector) return [];
  const cards: MemberCard[] = [];
  for (const entry of Array.from(document.querySelectorAll(entrySelector))) {
    const memberId = linkMember(document, entry, "event.attendeeEntry");
    if (!memberId) continue;
    // The JoyFox line goes at the end of the entry's text block, never into
    // the name box, which clips everything to one line.
    const host =
      (infoSelector ? entry.querySelector(infoSelector) : null) ?? entry;
    const name = nameSelector
      ? shownName(entry.querySelector(nameSelector)?.textContent)
      : undefined;
    cards.push({
      surface: "attendees",
      memberId,
      ...(name ? { name } : {}),
      // A guest entry shows a check icon, but no shield code (14-events.md).
      observed: {},
      badgeHost: host,
      placeBadge: (badge) => placeInCardLine(host, badge),
      signalsHost: host,
      placeSignals: (group) => placeInCardLine(host, group),
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
