# German and English UI: build spec

Status: approved by the owner on 2026-09-25. Build after the M9 manual matrix
(`manual-acceptance.md`, items 43 to 54) passes. No code exists for this yet.

Most JoyClub members are native German speakers. JoyFox must show all of its own
text in German or English, and the user must be able to switch between them.

## 1. Owner decisions

| Topic               | Decision                                                                                                       |
| ------------------- | -------------------------------------------------------------------------------------------------------------- |
| Default language    | Follow Firefox: German if `browser.i18n.getUILanguage()` starts with `de`, else English.                       |
| Toggle location     | One control in the options page header, visible on every tab.                                                  |
| When a change shows | At once, in the options page and in every open JoyClub tab. No reload.                                         |
| Stored reason text  | Store a message code plus values. Translate when shown. Database schema v3 migrates v2 records.                |
| Form of address     | Informal "du". Example: "Speichere eine Kontaktregel".                                                         |
| People nouns        | Neutral wording ("Mitglied", "Person", "Kontakt"). No gender symbols. No generic masculine.                    |
| Also translated     | Error messages shown in the UI, dates and numbers, default labels (for example the "General" template folder). |
| Not translated      | Manifest name and description (no `_locales/`).                                                                |
| German copy         | Claude drafts all German strings. The owner reviews an EN/DE table in the PR before merge.                     |

## 2. Scope

### In scope

- Static text in `src/options/options.html`: headings, tabs, intro, labels,
  `aria-label`, `title` and `placeholder` values.
- Every string that `src/options/*.ts` and `src/content/*.ts` put into the DOM,
  including confirm steps (`src/options/confirm.ts`) and on-screen notices.
- Triage reasons and headlines from `src/qualification/engine.ts`,
  `src/rules/contact-rule.ts`, `src/trust/trust-score.ts`,
  `src/spam/detector.ts` and `src/triage/triage-service.ts`.
- `PLACEMENT_TEXT` and every other label map (for example `STATE_TEXT` in
  `src/options/get-started.ts`).
- Error text that the UI shows: `ExtensionError` messages and the import
  refusals in `src/data/import.ts`.
- Dates and numbers shown to the user.
- The default template folder label (`DEFAULT_FOLDER` in
  `src/templates/template-service.ts`).
- The `lang` attribute of the options page.

### Out of scope

- Manifest `name` and `description`.
- JoyClub page parsing. `src/extraction/joyclub.ts` and `src/selectors/*` match
  German site text (for example "Angemeldet seit 11 Monaten"). These literals
  must not change.
- User-authored content: templates, notes, tags, account names, rule names, the
  spam-override `reason`.
- Console output, diagnostics output and developer error text in logs.
- Export JSON keys and stored enum values (`"needs-review"` and so on).
- Repository docs and README.

## 3. Architecture

### 3.1 Why not `browser.i18n`

`browser.i18n.getMessage()` always uses the Firefox UI language. It cannot
switch at runtime. JoyFox uses its own typed catalog instead. It calls
`browser.i18n.getUILanguage()` only to pick the default. The `i18n` API needs no
permission, so `config/permissions.json` does not change.

### 3.2 New files

```
src/i18n/locale.ts        Locale type, default resolution, storage key
src/i18n/catalog/en.ts    English catalog (source of truth for keys)
src/i18n/catalog/de.ts    German catalog, typed against en.ts
src/i18n/message.ts       Serializable Message descriptor
src/i18n/translator.ts    t(), formatDate(), formatNumber(), change listener
src/i18n/dom.ts           applyStaticText(root) for data-i18n attributes
```

### 3.3 Locale and setting

```ts
export type Locale = "en" | "de";
export const LOCALE_KEY = "joyfox.locale";

/** "de", "de-DE", "de-AT", "de-CH" give "de". Everything else gives "en". */
export function resolveDefaultLocale(uiLanguage: string): Locale;

/** The stored value if valid, else resolveDefaultLocale(getUILanguage()). */
export async function readLocale(area: SettingsArea): Promise<Locale>;
```

- The setting lives in `storage.local` through `SettingsArea`
  (`src/storage/local-settings.ts`). It is global, not per account.
- JoyFox writes the key only when the user picks a language. Until then the
  default follows Firefox.
- "Delete all JoyFox data" clears the key. The default then applies again.

### 3.4 Catalog

- Flat dotted keys grouped by surface: `options.tabs.start`,
  `triage.reason.belowMinimum`, `error.import.notJson`.
- A value is a string, or a function of typed params for plurals and grammar:

```ts
// en.ts
export const en = {
  "options.tabs.start": "Get started",
  "triage.reason.belowMinimum": (p: { field: string; value: number; minimum: number }) =>
    `${p.field} is ${p.value}, below the required ${p.minimum}.`,
} as const;
export type MessageKey = keyof typeof en;

// de.ts: a missing key or a wrong param shape fails `npm run typecheck`.
export const de: { [K in MessageKey]: (typeof en)[K] extends string
  ? string
  : (typeof en)[K] } = { ... };
```

- A reason that names a field (for example "Account age") passes the field as a
  `MessageKey`, and the translator resolves it first.

### 3.5 Message descriptor

Reasons cross the background-to-content message port and are stored in
IndexedDB, so they must be plain JSON:

```ts
export type MessageParam = string | number | Message;
export interface Message {
  key: MessageKey;
  params?: Record<string, MessageParam>;
}
```

- `reasons: string[]` becomes `reasons: Message[]` in the engine result, the
  rule result, the trust result and `ConversationClassification`.
- The content script calls `t(message)` at render time. The background never
  produces display text.

### 3.6 Translator

```ts
export function t(
  key: MessageKey,
  params?: Record<string, MessageParam>,
): string;
export function t(message: Message): string;
export function formatDate(iso: string): string; // de: 25.09.2026, en: Sep 25, 2026
export function formatNumber(value: number): string; // de: 1.234, en: 1,234
export function currentLocale(): Locale;
export function onLocaleChange(listener: (locale: Locale) => void): () => void;
```

- Use `Intl.DateTimeFormat` (`de-DE` or `en-US`, `dateStyle: "medium"`) and
  `Intl.NumberFormat` with the same locale tags.
- Replace every `.slice(0, 10)` date shown to the user, for example in
  `src/content/triage-ui.ts:181` and `src/content/observed-facts.ts:56`.
- An unknown key at runtime (a record from a newer version) shows the key itself
  and logs once. It never throws.

### 3.7 Live switching

- The options page and the content script each call `readLocale()` at start,
  then follow `browser.storage.onChanged` for `joyfox.locale`. Both files
  already have an `onChanged` listener (`src/options/index.ts:73`,
  `src/content/index.ts:39`). Extend them.
- On a change, each panel re-renders. Panels already replace their contents on
  render (see `GetStartedPanel`), so a re-render must not add copies.
- Open editors keep their unsaved input across the re-render (note editor,
  template editor, rule builder, import text).

### 3.8 Static HTML

- Replace text in `options.html` with `data-i18n="key"`. Use
  `data-i18n-attr="aria-label:key;placeholder:key"` for attributes.
- `applyStaticText(document)` fills them at load and on each change, and sets
  `<html lang>`.
- The English text stays in the HTML as the fallback before the script runs.

### 3.9 Toggle control

- A `<select id="joyfox-language">` in `.joyfox-options__header`.
- Label: "Sprache / Language". It is bilingual and never translated, so a user
  who cannot read the current language can still find it.
- Options: "Deutsch" and "English". Each name is in its own language and never
  translated.
- On change, write `joyfox.locale`. The page updates through the `onChanged`
  listener, the same path other tabs use.

### 3.10 Errors

- Add an optional `display?: Message` to `ExtensionError`. The English `message`
  stays for logs.
- Import refusals (`refuse(...)` in `src/data/import.ts`) and every error the
  options panels show get a `display` message.
- The panels show `t(error.display)`, or a per-code fallback key
  (`error.code.StorageError` and so on) when `display` is absent. They never
  show `error.message`.
- Suffixes such as ". Nothing was imported." become catalog keys.

## 4. Data changes

### 4.1 Schema v3 migration

- `DATABASE_VERSION` goes from 2 to 3 in `src/storage/database.ts`. No store is
  added.
- In `onupgradeneeded`, when `oldVersion < 3` and the store exists, open a
  cursor on `conversationClassifications` and rewrite `reasons`:
  - A string that matches `You moved this sender to <placement>.` becomes
    `{ key: "triage.reason.userMoved", params: { placement: <record.placement> } }`.
  - Any other string becomes
    `{ key: "legacy.text", params: { text: <original> } }`. It renders verbatim
    in both languages.
- Records are plain objects (no encryption at rest), so the rewrite runs
  synchronously inside the upgrade transaction.
- `src/storage/validation.ts` checks `reasons` as a `Message[]`: each item has a
  string `key` and an optional plain-object `params`.

### 4.2 Import and export

- Exports carry `schemaVersion: 3`.
- Import still accepts versions 1 and 2. It converts string reasons with the
  same mapping as 4.1 before validation.
- Add `joyfox.locale` to `IMPORTED_SETTINGS` in `src/data/import.ts`. Accept
  only `"en"` or `"de"`. The existing rule applies: a stored value is never
  overwritten. This needs the settings type map to allow a value check beyond
  `"boolean"`.

## 5. German copy rules

- Use "du" and imperative forms: "Speichere", "Wähle", "Lösche".
- Use neutral nouns for people. "This sender" becomes "Diese Person". "Member"
  becomes "Mitglied".
- When the text names a JoyClub control or area, use the exact German label from
  `docs/live-evidence/` (for example the Ignore and Delete controls).
- Keep "JoyFox", "JoyClub", "JOYCE" and "ClubMail" as they are.
- Draft glossary for owner review:

| English             | German         |
| ------------------- | -------------- |
| Get started         | Erste Schritte |
| Accounts            | Konten         |
| Contact rule        | Kontaktregel   |
| Templates           | Vorlagen       |
| Your data           | Deine Daten    |
| Qualified           | Qualifiziert   |
| Needs Review        | Zu prüfen      |
| Quarantined         | Quarantäne     |
| Trust score         | Vertrauenswert |
| Note                | Notiz          |
| Tags                | Tags           |
| General (folder)    | Allgemein      |
| Unknown (criterion) | Unbekannt      |

## 6. Tests

- Locale: `resolveDefaultLocale` for `de`, `de-AT`, `de-CH`, `en-US`, `fr` and
  an empty string. `readLocale` with a stored, missing and invalid value.
- Catalog: no empty value in either language. For string values, the set of
  `${...}`-style placeholders is the same in `en` and `de`.
- Translator: nested `Message` params, unknown key fallback, date and number
  output for both locales.
- Migration: a v2 database with both reason forms opens as v3 with the expected
  `Message[]` (fake-indexeddb, next to the v1 to v2 test in
  `tests/integration/schema-migration.test.ts`).
- Import: a v2 export with string reasons imports correctly. `joyfox.locale`
  imports only when valid and not already stored.
- Live switch: change `joyfox.locale` in a synthetic DOM. The options page and
  the triage UI re-render in German with no duplicate nodes, and an open note
  editor keeps its text.
- Leak guard: render each options panel and content surface with `de`, then
  assert that no English catalog value appears in `textContent` (ignore user
  data and brand names).

## 7. Documentation to update with the build

- ADR 0012: runtime-switchable UI language with a typed catalog.
- `docs/data-model.md`: schema v3 and `Message`.
- `docs/manual-acceptance.md`: new items for default by Firefox language,
  toggle, live switch in an open JoyClub tab, migrated override reasons, German
  dates and a German import error.
- README: one line on language support.

## 8. Done when

- Every in-scope surface shows German when German is selected, with no English
  left except brand names and user data.
- The toggle changes the options page and open JoyClub tabs at once.
- A v2 installation upgrades in place and keeps its overrides.
- `npm test`, `npm run lint`, `npm run typecheck` and `npm run format:check`
  pass.
- The owner has approved the EN/DE string table in the PR.
