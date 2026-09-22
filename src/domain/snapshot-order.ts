/**
 * Order snapshots newest first by instant, not by text: valid ISO dates with
 * different offsets or precision do not sort by time as strings. Ties break on
 * ID so the order is deterministic. Shared by the qualification merge and the
 * snapshot retention purge, which must agree on which snapshot is newest.
 */
export const newestCaptureFirst = (
  a: { capturedAt: string; id: string },
  b: { capturedAt: string; id: string },
) =>
  Date.parse(b.capturedAt) - Date.parse(a.capturedAt) ||
  b.id.localeCompare(a.id);
