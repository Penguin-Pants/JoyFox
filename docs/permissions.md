# Permissions

The machine-readable allowlist is `config/permissions.json`; lint compares it to
the Firefox manifest.

| Permission           | Reason                                                                    |
| -------------------- | ------------------------------------------------------------------------- |
| `storage`            | Required for extension-owned local persistence and future small settings. |
| `*://*.joyclub.de/*` | Allows the content shell on user-opened JoyClub pages.                    |
| `*://*.joyce.app/*`  | Allows the content shell on user-opened JOYCE pages.                      |

There is no `<all_urls>`, tabs, history, cookies, downloads, remote endpoint, or
optional sync permission. The extension contains no network client.
