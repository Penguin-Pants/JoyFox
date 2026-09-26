import { UI_ATTRIBUTE } from "./triage-ui";

/**
 * One full-width JoyFox strip under a conversation or profile header, which
 * the member panel, the note editor and the Ignore and Delete panel share
 * (owner decision, 2026-09-24: "Option A", a slim bar with details on
 * demand).
 *
 * JoyClub lays its header out as a horizontal row. JoyFox UI placed inside
 * that row became a narrow column and wrapped every line. So the strip goes
 * after the row instead. The row is found by layout, not by a JoyClub class
 * name: when the header element is an item of a horizontal flex container,
 * that container is the row. Otherwise the strip follows the header itself.
 */
export const MEMBER_STRIP = "member-strip";

/** The order of the sections inside the strip. */
const SECTION_ORDER: readonly string[] = [
  "member-panel",
  "compatibility",
  "member-notes",
  "quick-action",
];

function isHorizontalFlex(element: Element): boolean {
  const view = element.ownerDocument.defaultView;
  if (!view) return false;
  const style = view.getComputedStyle(element);
  return (
    (style.display === "flex" || style.display === "inline-flex") &&
    !style.flexDirection.startsWith("column")
  );
}

/** The element the strip follows: the header's row, or the header. */
export function stripAnchor(anchor: Element): Element {
  const parent = anchor.parentElement;
  if (!parent || parent === anchor.ownerDocument.body) return anchor;
  return isHorizontalFlex(parent) ? parent : anchor;
}

function findStrip(document: Document): HTMLElement | null {
  return document.querySelector<HTMLElement>(
    `[${UI_ATTRIBUTE}="${MEMBER_STRIP}"]`,
  );
}

/** Whether a section sits in the strip, and the strip after the header row. */
export function isPlaced(section: Element, anchor: Element): boolean {
  const strip = section.parentElement;
  return (
    strip?.getAttribute(UI_ATTRIBUTE) === MEMBER_STRIP &&
    strip.previousElementSibling === stripAnchor(anchor)
  );
}

/**
 * Put a section into the strip, in its fixed place among the others, and
 * the strip after the header row. Creates the strip when needed.
 */
export function placeInStrip(
  document: Document,
  anchor: Element,
  section: HTMLElement,
): void {
  const after = stripAnchor(anchor);
  let strip = findStrip(document);
  if (!strip) {
    strip = document.createElement("div");
    strip.className = "joyfox-strip";
    strip.setAttribute(UI_ATTRIBUTE, MEMBER_STRIP);
  }
  if (strip.previousElementSibling !== after) {
    // Moving a node blurs whatever is focused inside it, such as the note
    // text area. The sections already in place do not rebuild, so they would
    // not restore focus themselves.
    const active = document.activeElement;
    const focused =
      active instanceof HTMLElement && strip.contains(active) ? active : null;
    after.after(strip);
    if (focused && document.activeElement !== focused)
      focused.focus({ preventScroll: true });
  }
  const rank = SECTION_ORDER.indexOf(section.getAttribute(UI_ATTRIBUTE) ?? "");
  const next = Array.from(strip.children).find(
    (child) =>
      child !== section &&
      SECTION_ORDER.indexOf(child.getAttribute(UI_ATTRIBUTE) ?? "") > rank,
  );
  if (next) next.before(section);
  else strip.append(section);
}

/** Remove the strip once no section is left in it. */
export function removeEmptyStrip(document: Document): void {
  const strip = findStrip(document);
  if (strip && strip.children.length === 0) strip.remove();
}
