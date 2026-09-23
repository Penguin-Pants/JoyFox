/**
 * Timing for two-click deletes. A confirming click that arrives within the
 * grace period after arming is ignored, so a double-click can never arm and
 * confirm a delete before the user reads the prompt. Tests set `graceMs` to 0.
 */
export const confirmTiming = {
  graceMs: 500,
  now: (): number => Date.now(),
};

/**
 * Whether a click on a delete button drawn in the armed state may act. It
 * must be a single click, and the grace period since arming must be over.
 */
export function confirmAllowed(event: MouseEvent, armedAt: number): boolean {
  return (
    event.detail <= 1 && confirmTiming.now() - armedAt >= confirmTiming.graceMs
  );
}
