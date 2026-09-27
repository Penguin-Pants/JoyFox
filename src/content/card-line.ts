import { verifiedSelector } from "../selectors/registry";
import { UI_ATTRIBUTE } from "./triage-ui";

/**
 * One compact JoyFox line on each member card: an inbox row, a search result
 * and a guest-list entry (owner decision, 2026-09-27: "own compact line").
 * JoyClub gives its cards fixed, clipped boxes. Placed inside the inbox name
 * line (20 px) or the guest-list name box (25 px, `overflow: hidden`),
 * JoyFox's chips pushed the name out and were cut off to a coloured line
 * (owner's live checks). So each card gets a line of its own, 18 px high,
 * next to JoyClub's boxes instead of inside them.
 */
export const CARD_LINE = "card-line";

/**
 * The order of the parts in the line: the triage badge, the shared count
 * (`COMPAT_BADGE`) and the signals group (`CARD_SIGNALS`). The names are
 * repeated here, not imported, so this module depends on no feature.
 */
const ORDER: readonly string[] = ["badge", "compat-badge", "card-signals"];

interface LinePlace {
  /** The line goes before this child of the host; otherwise last. */
  before?: Element | undefined;
  /** The slot of the host's shadow root the line is drawn in. */
  slot?: string;
}

function cardLine(host: Element, place: LinePlace): HTMLElement {
  const existing = host.querySelector<HTMLElement>(
    `:scope > [${UI_ATTRIBUTE}="${CARD_LINE}"]`,
  );
  if (existing) return existing;
  const line = host.ownerDocument.createElement("div");
  line.className = "joyfox-card-line";
  line.setAttribute(UI_ATTRIBUTE, CARD_LINE);
  if (place.slot) line.setAttribute("slot", place.slot);
  if (place.before) place.before.before(line);
  else host.append(line);
  return line;
}

/** Put a part into the host's JoyFox line, in its fixed place. */
export function placeInCardLine(
  host: Element,
  part: HTMLElement,
  place: LinePlace = {},
): void {
  const line = cardLine(host, place);
  const rank = ORDER.indexOf(part.getAttribute(UI_ATTRIBUTE) ?? "");
  const next = Array.from(line.children).find(
    (child) =>
      child !== part &&
      ORDER.indexOf(child.getAttribute(UI_ATTRIBUTE) ?? "") > rank,
  );
  if (next) next.before(part);
  else line.append(part);
}

/**
 * An inbox row's line takes the row's `description` slot, before JoyClub's
 * own description line. The owner's live check showed it between the name
 * and the preview, with the row's height unchanged.
 */
export function placeInInboxLine(row: Element, part: HTMLElement): void {
  const selector = verifiedSelector("inbox", "descriptionLine");
  const before = selector
    ? Array.from(row.children).find((child) => child.matches(selector))
    : undefined;
  placeInCardLine(row, part, { before, slot: "description" });
}

/** Remove every JoyFox line that no longer holds a part. */
export function removeEmptyCardLines(document: Document): void {
  for (const line of Array.from(
    document.querySelectorAll(`[${UI_ATTRIBUTE}="${CARD_LINE}"]`),
  ))
    if (line.children.length === 0) line.remove();
}
