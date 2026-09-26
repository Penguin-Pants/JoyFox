import { describe, expect, it } from "vitest";
import {
  DEFAULT_SNAPSHOT_RETENTION,
  isSnapshotRetention,
  readSnapshotRetention,
  SNAPSHOT_RETENTION_KEY,
} from "../../src/storage/snapshot-retention";
import { MemorySettingsArea } from "../memory-settings";

describe("snapshot retention setting (V1-12)", () => {
  it("accepts whole numbers from 1 to 100 only", () => {
    for (const value of [1, 20, 100])
      expect(isSnapshotRetention(value)).toBe(true);
    for (const value of [0, 101, 2.5, -1, Number.NaN, "5", null, undefined])
      expect(isSnapshotRetention(value)).toBe(false);
  });

  it("reads the stored value, and the default when there is none or it is invalid", async () => {
    const settings = new MemorySettingsArea();
    expect(await readSnapshotRetention(settings)).toBe(
      DEFAULT_SNAPSHOT_RETENTION,
    );
    expect(DEFAULT_SNAPSHOT_RETENTION).toBe(20);
    await settings.set({ [SNAPSHOT_RETENTION_KEY]: 5 });
    expect(await readSnapshotRetention(settings)).toBe(5);
    await settings.set({ [SNAPSHOT_RETENTION_KEY]: 500 });
    expect(await readSnapshotRetention(settings)).toBe(
      DEFAULT_SNAPSHOT_RETENTION,
    );
  });

  it("falls back to the default when storage cannot be read", async () => {
    const broken = new MemorySettingsArea();
    broken.get = () => Promise.reject(new Error("storage unavailable"));
    expect(await readSnapshotRetention(broken)).toBe(
      DEFAULT_SNAPSHOT_RETENTION,
    );
  });
});
