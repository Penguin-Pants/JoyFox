import type { SettingsArea } from "./local-settings";

/**
 * The export reminder (owner request, 2026-10-01). JoyFox data stays in this
 * browser profile across restarts, but removing the extension or losing the
 * profile deletes it. A full export is the only backup, so "Your data" asks
 * for one when the last full export is older than the number of days set
 * here. Zero turns the reminder off. It applies to every account.
 */
export const EXPORT_REMINDER_KEY = "joyfox.exportReminderDays";
/**
 * When "Export all JoyFox data" last ran in this browser, as an ISO date.
 * It describes this browser only, so an import never takes it from a file.
 */
export const LAST_EXPORT_KEY = "joyfox.lastExportAt";
export const DEFAULT_EXPORT_REMINDER_DAYS = 14;
/** Zero turns the reminder off. */
export const MIN_EXPORT_REMINDER_DAYS = 0;
export const MAX_EXPORT_REMINDER_DAYS = 365;

const DAY_MS = 24 * 60 * 60 * 1000;

export interface ExportReminder {
  /** Days after a full export before the reminder shows; 0 is off. */
  days: number;
  /** The last full export in this browser, if there was one. */
  lastExportAt?: string;
}

export function isExportReminderDays(value: unknown): value is number {
  return (
    typeof value === "number" &&
    Number.isInteger(value) &&
    value >= MIN_EXPORT_REMINDER_DAYS &&
    value <= MAX_EXPORT_REMINDER_DAYS
  );
}

const isDate = (value: unknown): value is string =>
  typeof value === "string" && !Number.isNaN(Date.parse(value));

/**
 * The stored setting and last export. An invalid or missing number reads as
 * the default, an invalid date as no export, and an unreadable storage as
 * both: drawing "Your data" must never fail on this read.
 */
export async function readExportReminder(
  settings: SettingsArea,
): Promise<ExportReminder> {
  try {
    const stored = await settings.get([EXPORT_REMINDER_KEY, LAST_EXPORT_KEY]);
    const days = stored[EXPORT_REMINDER_KEY];
    const last = stored[LAST_EXPORT_KEY];
    return {
      days: isExportReminderDays(days) ? days : DEFAULT_EXPORT_REMINDER_DAYS,
      ...(isDate(last) ? { lastExportAt: last } : {}),
    };
  } catch {
    return { days: DEFAULT_EXPORT_REMINDER_DAYS };
  }
}

/** Whole days since the export; never negative, as a clock can go back. */
export function daysSinceExport(lastExportAt: string, now: Date): number {
  const elapsed = now.getTime() - Date.parse(lastExportAt);
  return Math.max(0, Math.floor(elapsed / DAY_MS));
}

/** An export is due when the reminder is on and none is recent enough. */
export function exportDue(reminder: ExportReminder, now: Date): boolean {
  if (reminder.days === 0) return false;
  if (!reminder.lastExportAt) return true;
  return daysSinceExport(reminder.lastExportAt, now) >= reminder.days;
}
