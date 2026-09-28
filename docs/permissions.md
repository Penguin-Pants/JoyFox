# Permissions

The machine-readable allowlist is `config/permissions.json`; lint compares it to
the Firefox manifest, including both declared host permissions and content
script match patterns.

| Permission           | Reason                                                                                                                        |
| -------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| `storage`            | Required for IndexedDB records, `storage.local` settings and flags, and the in-memory `storage.session` hand-off marker (M9). |
| `*://*.joyclub.de/*` | Allows the content shell on user-opened JoyClub pages.                                                                        |
| `*://*.joyce.app/*`  | Allows the content shell on user-opened JOYCE pages.                                                                          |

There is no `<all_urls>`, tabs, history, cookies, downloads, remote endpoint, or
optional sync permission. The extension contains no network client.

The manifest declares
`browser_specific_settings.gecko.data_collection_permissions` as
`{"required": ["none"]}`: JoyFox collects and transmits no data (F8,
`docs/distribution.md`). Review this value before any feature sends data off the
device, for example sync (V1-6).

The manifest's `browser_specific_settings.gecko.update_url` is the only remote
address in it. It is not a permission: Firefox uses it to check for updates
(V1-9, `privacy-model.md`, "Update check").

The UI language (ADR 0014) calls `browser.i18n.getUILanguage()` only to pick the
default language. The `i18n` API needs no permission, so the allowlist does not
change.
