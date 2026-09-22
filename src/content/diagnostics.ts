import type { ExtractionResult } from "../domain/types";
import type { InboxRowExtraction } from "../extraction/joyclub";

/**
 * The `storage.local` key that turns on development diagnostics. Off unless
 * set to `true`, for example from the extension's devtools console with
 * `browser.storage.local.set({ "joyfox.diagnostics": true })`.
 */
export const DIAGNOSTICS_KEY = "joyfox.diagnostics";

const foundCount = (results: ReadonlyArray<ExtractionResult<unknown>>) =>
  results.filter((result) => result.status === "found").length;

/**
 * One-line summary of an inbox extraction for the F2 proof of concept. It
 * holds counts only, never a name, ID or message (build plan Section 26), so
 * it is safe to log.
 */
export function summarizeInbox(rows: readonly InboxRowExtraction[]): string {
  return [
    "inbox.extracted",
    `rows=${rows.length}`,
    `senderName=${foundCount(rows.map((row) => row.senderName))}`,
    `memberId=${foundCount(rows.map((row) => row.memberId))}`,
    `verificationCode=${foundCount(rows.map((row) => row.verificationCode))}`,
    `readState=${foundCount(rows.map((row) => row.readState))}`,
  ].join(" ");
}
