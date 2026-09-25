# Permissions

The machine-readable allowlist is `config/permissions.json`; lint compares it to
the Firefox manifest, including both declared host permissions and content
script match patterns.

| Permission           | Reason                                                                    |
| -------------------- | ------------------------------------------------------------------------- |
| `storage`            | Required for extension-owned local persistence and future small settings. |
| `*://*.joyclub.de/*` | Allows the content shell on user-opened JoyClub pages.                    |
| `*://*.joyce.app/*`  | Allows the content shell on user-opened JOYCE pages.                      |

There is no `<all_urls>`, tabs, history, cookies, downloads, remote endpoint, or
optional sync permission. The extension contains no network client.

The UI language (ADR 0014) calls `browser.i18n.getUILanguage()` only to pick the
default language. The `i18n` API needs no permission, so the allowlist does not
change.
