/**
 * A stand-in for the WebExtension `browser` API, for store screenshots only.
 * The real background, options and content bundles run together in one page:
 * `runtime.sendMessage` calls the page's own `onMessage` listeners, and
 * storage lives in memory.
 */
type Listener = (...args: unknown[]) => unknown;
type Changes = Record<string, { oldValue?: unknown; newValue?: unknown }>;

const messageListeners = new Set<Listener>();
const changeListeners = new Set<Listener>();
const noEvent = { addListener() {}, removeListener() {} };

function area(name: string) {
  const data = new Map<string, unknown>();
  const fire = (changes: Changes) => {
    if (Object.keys(changes).length > 0)
      for (const listener of changeListeners) listener(changes, name);
  };
  return {
    async get(keys?: string | string[] | Record<string, unknown> | null) {
      if (keys == null) return Object.fromEntries(data);
      const out: Record<string, unknown> =
        typeof keys === "object" && !Array.isArray(keys) ? { ...keys } : {};
      const names =
        typeof keys === "string"
          ? [keys]
          : Array.isArray(keys)
            ? keys
            : Object.keys(keys);
      for (const key of names)
        if (data.has(key)) out[key] = structuredClone(data.get(key));
      return out;
    },
    async set(items: Record<string, unknown>) {
      const changes: Changes = {};
      for (const [key, value] of Object.entries(items)) {
        changes[key] = { oldValue: data.get(key), newValue: value };
        data.set(key, structuredClone(value));
      }
      fire(changes);
    },
    async remove(keys: string | string[]) {
      const changes: Changes = {};
      for (const key of typeof keys === "string" ? [keys] : keys)
        if (data.has(key)) {
          changes[key] = { oldValue: data.get(key) };
          data.delete(key);
        }
      fire(changes);
    },
    async clear() {
      await this.remove([...data.keys()]);
    },
  };
}

(globalThis as unknown as { browser: unknown }).browser = {
  runtime: {
    id: "joyfox@screenshots",
    onInstalled: noEvent,
    openOptionsPage: async () => undefined,
    onMessage: {
      addListener: (listener: Listener) => messageListeners.add(listener),
      removeListener: (listener: Listener) => messageListeners.delete(listener),
    },
    async sendMessage(message: unknown) {
      for (const listener of messageListeners) {
        const answer = listener(structuredClone(message), {
          url: location.href,
          tab: { id: 1 },
        });
        if (answer !== undefined) return structuredClone(await answer);
      }
      throw new Error("No listener");
    },
  },
  storage: {
    local: area("local"),
    session: area("session"),
    onChanged: {
      addListener: (listener: Listener) => changeListeners.add(listener),
      removeListener: (listener: Listener) => changeListeners.delete(listener),
    },
  },
  action: { onClicked: noEvent },
  permissions: {
    contains: async () => true,
    request: async () => true,
    onAdded: noEvent,
    onRemoved: noEvent,
  },
  i18n: { getUILanguage: () => "en-US" },
  tabs: { get: async () => ({ id: 1 }) },
};
