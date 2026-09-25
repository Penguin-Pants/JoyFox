# German and English UI: build spec

Status: approved by the owner on 2026-09-25. Build after the M9 manual matrix
(`manual-acceptance.md`, items 43 to 54) passes. No code exists for this yet.

Most JoyClub members are native German speakers. JoyFox must show all of its own
text in German or English, and the user must be able to switch between them.

## 1. Owner decisions

| Topic               | Decision                                                                                                        |
| ------------------- | --------------------------------------------------------------------------------------------------------------- |
| Default language    | Follow Firefox: German if `browser.i18n.getUILanguage()` starts with `de`, else English.                        |
| Toggle location     | One control in the options page header, visible on every tab.                                                   |
| When a change shows | At once, in the options page and in every open JoyClub tab. No reload.                                          |
| Stored reason text  | Store a message code plus values. Translate when shown. Database schema v3 migrates v2 records.                 |
| Form of address     | Informal "du". Example: "Speichere eine Kontaktregel".                                                          |
| People nouns        | Neutral wording ("Mitglied", "Person", "Kontakt"). No gender symbols. No generic masculine.                     |
| Also translated     | Error messages shown in the UI, dates and numbers, default labels (for example the "General" template folder).  |
| Not translated      | Manifest name and description (no `_locales/`).                                                                 |
| German copy         | Claude drafts all German strings. The owner reviews an EN/DE table in the PR before merge.                      |
| Export and import   | `joyfox.locale` is exported. Import sets it only when valid and no value is stored (4.2). Confirmed 2026-09-25. |
| Toggle label        | "Sprache / Language", with "Deutsch" and "English" as choices, never translated (3.9). Confirmed 2026-09-25.    |

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
- A value is a string, or a function of typed params for plurals and grammar. A
  function gets a second argument, `f: Format`, for numbers and plurals.

```ts
// en.ts
export const en = {
  "options.tabs.start": "Get started",
  "field.accountAge": "Account age",
  "triage.reason.belowMinimum": (
    p: { field: Translated; value: number; minimum: number },
    f: Format,
  ) => `${p.field} is ${f.number(p.value)}, below the required ${f.number(p.minimum)}.`,
} as const;

/** Locale-aware helpers that t() passes to every catalog function. */
export interface Format {
  number(value: number): string; // de: 1.234,5 en: 1,234.5
  plural(value: number, forms: { one: string; other: string }): string;
}
export type MessageKey = keyof typeof en;

/** A param that the translator fills with an already translated string. */
export type Translated = string & { readonly __translated: true };
/** The params a key's function takes, or undefined for a plain string. */
export type ArgsOf<K extends MessageKey> = (typeof en)[K] extends (
  p: infer A,
  f: Format,
) => string
  ? A
  : undefined;

// de.ts: a missing key or a wrong param shape fails `npm run typecheck`.
export const de: { [K in MessageKey]: (typeof en)[K] extends string
  ? string
  : (typeof en)[K] } = { ... };
```

- A param that must be translated (for example the field "Account age") has the
  type `Translated` in the catalog. In a `Message` it is a nested `Message`,
  never a string (see 3.5).
- A catalog function must print every `number` param through `f.number()`, never
  with plain `${p.value}`. A catalog test enforces this (Section 6).
- A plain `string` param is always literal. The translator never looks it up in
  the catalog, even when its text is equal to a key. This keeps `legacy.text`
  and user text verbatim.

### 3.5 Message descriptor

Reasons cross the background-to-content message port and are stored in
IndexedDB, so they must be plain JSON:

```ts
/** On the wire, each Translated param is a nested Message. */
type WireParams<A> = {
  [P in keyof A]: A[P] extends Translated ? Message : A[P];
};

/** One variant per key, so the key decides the required params. */
export type Message = {
  [K in MessageKey]: ArgsOf<K> extends undefined
    ? { key: K }
    : { key: K; params: WireParams<ArgsOf<K>> };
}[MessageKey];
```

- `{ key: "triage.reason.belowMinimum", params: {} }` fails `npm run typecheck`.
  So does a misspelled param name or a wrong param type.
- Example:
  `{ key: "triage.reason.belowMinimum", params: { field: { key: "field.accountAge" }, value: 3, minimum: 5 } }`.
- Stored and imported records are not typed at runtime. A runtime spec, typed
  against the catalog, lists each key's param names and kinds:

```ts
type ParamKind = "string" | "number" | "message";
export const MESSAGE_PARAMS: {
  [K in MessageKey]: ArgsOf<K> extends undefined
    ? null
    : { [P in keyof ArgsOf<K>]-?: ParamKind };
} = { "options.tabs.start": null, "triage.reason.belowMinimum": { field: "message", value: "number", minimum: "number" }, ... };
```

- `isMessage(value)` checks a value against `MESSAGE_PARAMS`: a known key,
  exactly the listed param names, each of the listed kind, nested messages
  checked the same way.

- Every field that the UI shows and that code (not the user) writes becomes a
  `Message`. Today these are:

| Field                                                  | File                          | New type    |
| ------------------------------------------------------ | ----------------------------- | ----------- |
| `EvaluatedCriterion.reason`                            | `src/qualification/engine.ts` | `Message`   |
| Engine result `reasons`                                | `src/qualification/engine.ts` | `Message[]` |
| `EvaluatedCondition.reason`                            | `src/rules/contact-rule.ts`   | `Message`   |
| Rule result `reasons` (headline included)              | `src/rules/contact-rule.ts`   | `Message[]` |
| `TrustContribution.reason`                             | `src/trust/trust-score.ts`    | `Message`   |
| `SpamFinding.detail`                                   | `src/spam/detector.ts`        | `Message`   |
| `SpamDetectionResult.explanation`                      | `src/spam/detector.ts`        | `Message[]` |
| `ConversationClassification.reasons` (stored, see 4.1) | `src/domain/types.ts`         | `Message[]` |

- Before the build closes, search `src/` for other `string` fields whose doc
  comment says "plain-language" or "for display", and convert them the same way.
  Only `ConversationClassification.reasons` is stored. The others exist only at
  runtime and need no migration.
- The content script calls `t(message)` at render time. The background never
  produces display text.

### 3.6 Translator

```ts
export function t(message: Message): string;
export function t<K extends MessageKey>(
  key: K,
  ...params: ArgsOf<K> extends undefined ? [] : [WireParams<ArgsOf<K>>]
): string;
export function formatDate(iso: string): string; // de: 25.09.2026, en: Sep 25, 2026
export function formatNumber(value: number): string; // de: 1.234, en: 1,234
export function currentLocale(): Locale;
export function onLocaleChange(listener: (locale: Locale) => void): () => void;
```

- Use `Intl.DateTimeFormat` (`de-DE` or `en-US`, `dateStyle: "medium"`) and
  `Intl.NumberFormat` with the same locale tags.
- Replace every `.slice(0, 10)` date that is shown to the user, for example in
  `src/content/triage-ui.ts:181`, with `formatDate()`.
- Do not change dates used as internal keys or stored values. Example:
  `factsKey()` in `src/content/observed-facts.ts:56` slices dates to build a
  cache key. A locale-dependent key would change on each language switch and
  discard cached triage results.
- `t()` resolves each nested `Message` param first, then calls the catalog
  function with `f` for the current locale. It passes `string` and `number`
  params unchanged, and the catalog function formats numbers through `f`.
- A value that fails `isMessage` at render time shows its key (or "?" if it has
  none) and logs once. It never throws.

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
    `{ key: "triage.reason.userMoved", params: { placement: { key: "placement.<record.placement>" } } }`.
    The placement is a nested `Message`, because it is translated. The catalog
    has one `placement.*` key per stored placement value.
  - Any other string becomes
    `{ key: "legacy.text", params: { text: <original> } }`. It renders verbatim
    in both languages.
- Records are plain objects (no encryption at rest), so the rewrite runs
  synchronously inside the upgrade transaction.
- `src/storage/validation.ts` checks each item of `reasons` with `isMessage`
  (3.5). A record that fails is invalid, the same as other validation errors.

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
- Glossary (confirmed by the owner on 2026-09-25):

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
- Catalog: no empty value in either language. Call each function that takes a
  `number` param with `1234.5` in both locales. The output must contain
  `1.234,5` (de) or `1,234.5` (en) and never `1234.5`. For string values, the
  set of `${...}`-style placeholders is the same in `en` and `de`.
- Types: a `// @ts-expect-error` test for a missing param, a misspelled param
  and a string where a nested `Message` is required.
- `isMessage`: accepts valid nested messages. Refuses an unknown key, a missing
  or extra param and a param of the wrong kind.
- Translator: nested `Message` params, a string param equal to a catalog key
  stays literal, invalid value fallback, date and number output for both
  locales.
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
