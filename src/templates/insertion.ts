/**
 * Why an insertion did not happen. In every case the composer is unchanged.
 * - `not-editable`: the field is disabled, read-only or no longer on the page.
 * - `too-long`: the result would pass the field's `maxlength`. JoyFox never
 *   shortens a template to fit (PRD Section 21.2: no truncation).
 */
export type InsertionRefusal = "not-editable" | "too-long";

export type InsertionResult =
  | { status: "inserted" }
  | { status: "refused"; reason: InsertionRefusal }
  /** The page changed the text after insertion, so it is not exact. */
  | { status: "altered" };

/**
 * Insert `text` at the cursor of a compose field, replacing any selected
 * text, the way typing or pasting would. It never submits the form and never
 * touches any other control: the user edits and sends the message
 * themselves (build plan Section 17).
 *
 * The page learns of the change through `input` and `change` events, as it
 * would from the user. Which of them JoyClub needs is not verified yet
 * (`docs/manual-verification-needed.md`, item 6); both are sent, and neither
 * can send a message.
 */
export function insertAtCursor(
  field: HTMLTextAreaElement,
  text: string,
): InsertionResult {
  if (!field.isConnected || field.disabled || field.readOnly)
    return { status: "refused", reason: "not-editable" };
  const current = field.value;
  const start = Math.min(
    field.selectionStart ?? current.length,
    current.length,
  );
  const end = Math.max(
    start,
    Math.min(field.selectionEnd ?? start, current.length),
  );
  const expected = current.slice(0, start) + text + current.slice(end);
  // `maxLength` is -1 when the attribute is absent. A programmatic change is
  // not held to it, so the check is made here instead of by the browser.
  if (field.maxLength >= 0 && expected.length > field.maxLength)
    return { status: "refused", reason: "too-long" };
  field.focus();
  field.setRangeText(text, start, end, "end");
  const view = field.ownerDocument.defaultView;
  const InputEventType = view?.InputEvent ?? InputEvent;
  const EventType = view?.Event ?? Event;
  field.dispatchEvent(
    new InputEventType("input", {
      bubbles: true,
      inputType: "insertText",
      data: text,
    }),
  );
  field.dispatchEvent(new EventType("change", { bubbles: true }));
  return field.value === expected
    ? { status: "inserted" }
    : { status: "altered" };
}
