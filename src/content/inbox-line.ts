import { verifiedSelector } from "../selectors/registry";
import { UI_ATTRIBUTE } from "./triage-ui";

/**
 * One JoyFox line in each ClubMail conversation row, between the name line
 * and the message preview (owner decision, 2026-09-27: "own compact line").
 * JoyClub's name line is a single 20 px row that clips what does not fit,
 * so the placement badge, the shared count and the signals pushed the name
 * out and were cut off. The line takes the row's `description` slot, before
 * JoyClub's own description line. The owner's live check showed it between
 * the name and the preview, 18 px high, with the row's height unchanged.
 */
export const INBOX_LINE = "inbox-line";

/**
 * The order of the parts in the line: the triage badge, the shared count
 * (`COMPAT_BADGE`) and the signals group (`CARD_SIGNALS`). The names are
 * repeated here, not imported, so this module depends on no feature.
 */
const ORDER: readonly string[] = ["badge", "compat-badge", "card-signals"];

function inboxLine(row: Element): HTMLElement {
  const existing = row.querySelector<HTMLElement>(
    `:scope > [${UI_ATTRIBUTE}="${INBOX_LINE}"]`,
  );
  if (existing) return existing;
  const line = row.ownerDocument.createElement("div");
  line.className = "joyfox-inbox-line";
  line.setAttribute(UI_ATTRIBUTE, INBOX_LINE);
  line.setAttribute("slot", "description");
  const selector = verifiedSelector("inbox", "descriptionLine");
  const description = selector
    ? Array.from(row.children).find((child) => child.matches(selector))
    : undefined;
  if (description) description.before(line);
  else row.append(line);
  return line;
}

/** Put a part into the row's JoyFox line, in its fixed place. */
export function placeInInboxLine(row: Element, part: HTMLElement): void {
  const line = inboxLine(row);
  const rank = ORDER.indexOf(part.getAttribute(UI_ATTRIBUTE) ?? "");
  const next = Array.from(line.children).find(
    (child) =>
      child !== part &&
      ORDER.indexOf(child.getAttribute(UI_ATTRIBUTE) ?? "") > rank,
  );
  if (next) next.before(part);
  else line.append(part);
}

/** Remove every JoyFox line that no longer holds a part. */
export function removeEmptyInboxLines(document: Document): void {
  for (const line of Array.from(
    document.querySelectorAll(`[${UI_ATTRIBUTE}="${INBOX_LINE}"]`),
  ))
    if (line.children.length === 0) line.remove();
}
