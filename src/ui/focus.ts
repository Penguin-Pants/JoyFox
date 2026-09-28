/**
 * Keeps keyboard focus on the same control when a panel draws itself again.
 * A panel that replaces its nodes on each draw otherwise drops focus to the
 * page, so a keyboard user has to find their place again after every click
 * (the same fix member notes and Quick Ignore and Delete carry on their own).
 *
 * A control that should keep focus carries `data-joyfox-focus="<key>"`, a key
 * that stays the same across draws (for example `remove:<account ID>`).
 */
export const FOCUS_KEY = "data-joyfox-focus";

export interface FocusMemo {
  key: string;
  /** The caret, for a text field. */
  start?: number | null;
  end?: number | null;
}

/** The keyed control inside `root` that has focus now, if any. */
export function rememberFocus(
  root: Element | null | undefined,
): FocusMemo | undefined {
  const active = root?.ownerDocument.activeElement;
  if (!root || !active || !root.contains(active)) return undefined;
  const key = active.getAttribute(FOCUS_KEY);
  if (!key) return undefined;
  if (active.tagName === "INPUT" || active.tagName === "TEXTAREA") {
    const field = active as HTMLInputElement;
    try {
      return { key, start: field.selectionStart, end: field.selectionEnd };
    } catch {
      // Some input types (number, checkbox) have no caret.
      return { key };
    }
  }
  return { key };
}

const usable = (node: HTMLElement | null | undefined) =>
  node &&
  !(node as HTMLButtonElement).disabled &&
  !node.closest("[hidden]") &&
  !(node.closest("details:not([open])") && node.tagName !== "SUMMARY")
    ? node
    : undefined;

function findKey(root: ParentNode, key: string): HTMLElement | undefined {
  for (const node of Array.from(
    root.querySelectorAll<HTMLElement>(`[${FOCUS_KEY}]`),
  ))
    if (node.getAttribute(FOCUS_KEY) === key) return node;
  return undefined;
}

/**
 * After a draw, focus the control with the remembered key inside `root`, or
 * else the first usable control among `fallbacks` (keys, in order). Returns
 * whether focus moved. Nothing happens when nothing was remembered.
 */
export function restoreFocus(
  root: ParentNode,
  memo: FocusMemo | undefined,
  fallbacks: readonly string[] = [],
): boolean {
  if (!memo) return false;
  const target = [memo.key, ...fallbacks]
    .map((key) => usable(findKey(root, key)))
    .find((node) => node !== undefined);
  if (!target) return false;
  target.focus({ preventScroll: true });
  if (
    target.getAttribute(FOCUS_KEY) === memo.key &&
    memo.start !== undefined &&
    memo.start !== null &&
    "setSelectionRange" in target
  ) {
    try {
      (target as HTMLInputElement).setSelectionRange(
        memo.start,
        memo.end ?? memo.start,
      );
    } catch {
      // A field type without a caret.
    }
  }
  return true;
}
