import type { SettingsArea } from "./local-settings";

/**
 * How many profile snapshots are kept per member (PRD 13.3, V1-12): the
 * latest one plus a short history. The user sets it on the options page; it
 * applies to every account, and to snapshots already stored.
 */
export const SNAPSHOT_RETENTION_KEY = "joyfox.snapshotRetention";
export const DEFAULT_SNAPSHOT_RETENTION = 20;
/** The latest snapshot is always kept, so one is the least. */
export const MIN_SNAPSHOT_RETENTION = 1;
/** A bound keeps the history short, as PRD 13.3 asks. */
export const MAX_SNAPSHOT_RETENTION = 100;

export function isSnapshotRetention(value: unknown): value is number {
  return (
    typeof value === "number" &&
    Number.isInteger(value) &&
    value >= MIN_SNAPSHOT_RETENTION &&
    value <= MAX_SNAPSHOT_RETENTION
  );
}

/**
 * The stored setting, or the default when none is stored, the value is not
 * valid or storage cannot be read: a capture must never fail on this read.
 */
export async function readSnapshotRetention(
  settings: SettingsArea,
): Promise<number> {
  try {
    const value = (await settings.get([SNAPSHOT_RETENTION_KEY]))[
      SNAPSHOT_RETENTION_KEY
    ];
    return isSnapshotRetention(value) ? value : DEFAULT_SNAPSHOT_RETENTION;
  } catch {
    return DEFAULT_SNAPSHOT_RETENTION;
  }
}
