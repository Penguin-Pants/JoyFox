import { ExtensionError } from "../errors";
import type { SettingsArea } from "./local-settings";

function sessionArea(): browser.storage.StorageArea {
  const area = (globalThis as { browser?: { storage?: { session?: unknown } } })
    .browser?.storage?.session;
  if (!area)
    throw new ExtensionError(
      "StorageError",
      "browser.storage.session is unavailable in this context",
    );
  return area as browser.storage.StorageArea;
}

/**
 * `storage.session`: kept in memory for the browser session only and never
 * written to disk. It needs no permission beyond `storage`. Only the
 * background uses it; content scripts cannot read it by default.
 */
export const runtimeSessionArea: SettingsArea = {
  async get(keys) {
    return (await sessionArea().get(keys)) as Record<string, unknown>;
  },
  async set(items) {
    await sessionArea().set(items);
  },
  async remove(keys) {
    await sessionArea().remove(keys);
  },
  async getAll() {
    return (await sessionArea().get(null)) as Record<string, unknown>;
  },
  async clear() {
    await sessionArea().clear();
  },
};
