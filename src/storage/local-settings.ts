import { ExtensionError } from "../errors";

/**
 * Small configuration values live in `storage.local` rather than IndexedDB
 * because they must be readable before any account scope is known. The
 * interface is explicit so tests and the options page can supply their own
 * area without a live `browser` global.
 */
export interface SettingsArea {
  get(keys: string[]): Promise<Record<string, unknown>>;
  set(items: Record<string, unknown>): Promise<void>;
  remove(keys: string[]): Promise<void>;
  /** Removes every key in the area. Used only by "delete all JoyFox data". */
  clear(): Promise<void>;
}

function runtimeArea(): browser.storage.StorageArea {
  const area = (globalThis as { browser?: { storage?: { local?: unknown } } })
    .browser?.storage?.local;
  if (!area)
    throw new ExtensionError(
      "StorageError",
      "browser.storage.local is unavailable in this context",
    );
  return area as browser.storage.StorageArea;
}

export const runtimeSettingsArea: SettingsArea = {
  async get(keys) {
    return (await runtimeArea().get(keys)) as Record<string, unknown>;
  },
  async set(items) {
    await runtimeArea().set(items);
  },
  async remove(keys) {
    await runtimeArea().remove(keys);
  },
  async clear() {
    await runtimeArea().clear();
  },
};
