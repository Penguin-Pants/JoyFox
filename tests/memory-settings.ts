import type { SettingsArea } from "../src/storage/local-settings";

/** An in-memory stand-in for `browser.storage.local` in tests. */
export class MemorySettingsArea implements SettingsArea {
  readonly items = new Map<string, unknown>();
  get(keys: string[]): Promise<Record<string, unknown>> {
    const result: Record<string, unknown> = {};
    for (const key of keys)
      if (this.items.has(key)) result[key] = this.items.get(key);
    return Promise.resolve(result);
  }
  set(items: Record<string, unknown>): Promise<void> {
    for (const [key, value] of Object.entries(items))
      this.items.set(key, value);
    return Promise.resolve();
  }
  remove(keys: string[]): Promise<void> {
    for (const key of keys) this.items.delete(key);
    return Promise.resolve();
  }
}
