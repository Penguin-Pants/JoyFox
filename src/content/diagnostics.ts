import type { ExtractionResult } from "../domain/types";
import type { InboxRowExtraction } from "../extraction/joyclub";

/**
 * The `storage.local` key that turns on development diagnostics. Off unless
 * set to `true`, for example from the options page console with
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

type StorageChanges = Record<string, { newValue?: unknown }>;
type ChangeListener = (changes: StorageChanges, areaName: string) => void;

/**
 * Tracks the diagnostics flag for the lifetime of a tab. It reads the flag
 * once and then follows `storage.onChanged`, so turning diagnostics off (or
 * on) takes effect without a reload. Any storage failure leaves it off.
 */
export class DiagnosticsFlag {
  #enabled = false;
  /** A change seen before the initial read settles is newer than that read. */
  #changed = false;

  constructor(
    read: () => Promise<Record<string, unknown>>,
    onChanged?: { addListener(listener: ChangeListener): void },
  ) {
    onChanged?.addListener((changes, areaName) => {
      if (areaName !== "local" || !(DIAGNOSTICS_KEY in changes)) return;
      this.#changed = true;
      this.#enabled = changes[DIAGNOSTICS_KEY]?.newValue === true;
    });
    this.ready = read()
      .then((settings) => {
        if (!this.#changed) this.#enabled = settings[DIAGNOSTICS_KEY] === true;
      })
      .catch(() => {
        if (!this.#changed) this.#enabled = false;
      });
  }

  /** Settles once the initial value is known. */
  readonly ready: Promise<void>;

  get enabled(): boolean {
    return this.#enabled;
  }
}
