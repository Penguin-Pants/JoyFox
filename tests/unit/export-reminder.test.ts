import { describe, expect, it } from "vitest";
import {
  daysSinceExport,
  DEFAULT_EXPORT_REMINDER_DAYS,
  EXPORT_REMINDER_KEY,
  exportDue,
  isExportReminderDays,
  LAST_EXPORT_KEY,
  readExportReminder,
} from "../../src/storage/export-reminder";
import { MemorySettingsArea } from "../memory-settings";

const now = new Date("2026-10-01T12:00:00.000Z");

describe("export reminder setting", () => {
  it("accepts whole numbers from 0 to 365 only", () => {
    for (const value of [0, 1, 14, 365])
      expect(isExportReminderDays(value)).toBe(true);
    for (const value of [-1, 366, 2.5, Number.NaN, "14", null, undefined])
      expect(isExportReminderDays(value)).toBe(false);
  });

  it("reads the stored days and last export, and the default days when none or invalid", async () => {
    const settings = new MemorySettingsArea();
    expect(await readExportReminder(settings)).toEqual({
      days: DEFAULT_EXPORT_REMINDER_DAYS,
    });
    expect(DEFAULT_EXPORT_REMINDER_DAYS).toBe(14);
    await settings.set({
      [EXPORT_REMINDER_KEY]: 30,
      [LAST_EXPORT_KEY]: "2026-09-01T00:00:00.000Z",
    });
    expect(await readExportReminder(settings)).toEqual({
      days: 30,
      lastExportAt: "2026-09-01T00:00:00.000Z",
    });
    await settings.set({ [EXPORT_REMINDER_KEY]: 999, [LAST_EXPORT_KEY]: "x" });
    expect(await readExportReminder(settings)).toEqual({
      days: DEFAULT_EXPORT_REMINDER_DAYS,
    });
  });

  it("falls back to the default when storage cannot be read", async () => {
    const broken = new MemorySettingsArea();
    broken.get = () => Promise.reject(new Error("storage unavailable"));
    expect(await readExportReminder(broken)).toEqual({
      days: DEFAULT_EXPORT_REMINDER_DAYS,
    });
  });

  it("counts whole days since the last export", () => {
    expect(daysSinceExport("2026-10-01T00:00:00.000Z", now)).toBe(0);
    expect(daysSinceExport("2026-09-30T12:00:00.000Z", now)).toBe(1);
    expect(daysSinceExport("2026-09-01T12:00:01.000Z", now)).toBe(29);
    // A clock set back never gives a negative count.
    expect(daysSinceExport("2026-10-05T00:00:00.000Z", now)).toBe(0);
  });

  it("is due once the set number of days has passed, or when never exported", () => {
    const last = "2026-09-17T12:00:00.000Z";
    expect(exportDue({ days: 14, lastExportAt: last }, now)).toBe(true);
    expect(exportDue({ days: 15, lastExportAt: last }, now)).toBe(false);
    expect(exportDue({ days: 14 }, now)).toBe(true);
  });

  it("is never due when the reminder is off", () => {
    expect(exportDue({ days: 0 }, now)).toBe(false);
    expect(
      exportDue({ days: 0, lastExportAt: "2020-01-01T00:00:00.000Z" }, now),
    ).toBe(false);
  });
});
