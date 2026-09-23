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
 * Tracks a `storage.local` flag for the lifetime of a tab: the diagnostics
 * flag by default, or another key. An opt-in flag (the default) is on only
 * when set to `true`; a default-on flag is on unless set to `false`. It reads
 * the flag once and then follows `storage.onChanged`, so a change takes
 * effect without a reload. A storage failure leaves the flag at its default.
 */
export class DiagnosticsFlag {
  #enabled = false;
  /** A change seen before the initial read settles is newer than that read. */
  #changed = false;

  constructor(
    read: () => Promise<Record<string, unknown>>,
    onChanged?: { addListener(listener: ChangeListener): void },
    key: string = DIAGNOSTICS_KEY,
    defaultEnabled = false,
  ) {
    const enabledBy = (value: unknown) =>
      defaultEnabled ? value !== false : value === true;
    this.#enabled = defaultEnabled;
    onChanged?.addListener((changes, areaName) => {
      if (areaName !== "local" || !(key in changes)) return;
      this.#changed = true;
      this.#enabled = enabledBy(changes[key]?.newValue);
    });
    this.ready = read()
      .then((settings) => {
        if (!this.#changed) this.#enabled = enabledBy(settings[key]);
      })
      .catch(() => {
        if (!this.#changed) this.#enabled = defaultEnabled;
      });
  }

  /** Settles once the initial value is known. */
  readonly ready: Promise<void>;

  get enabled(): boolean {
    return this.#enabled;
  }
}
