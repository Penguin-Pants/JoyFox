# 0013: Runtime-switchable UI language with a typed catalog

## Status

Accepted (project owner, 2026-09-25, `docs/i18n-spec.md`). The spec names this
record "ADR 0012"; that number was already taken by the rule groups decision, so
it is 0013.

## Context

Most JoyClub members are native German speakers. JoyFox showed all of its own
text in English only. The owner decided that JoyFox shows its text in German or
English, that the user can switch between them on the options page, and that a
switch shows at once, in the options page and in every open JoyClub tab, with no
reload.

Firefox's own `browser.i18n.getMessage()` always uses the Firefox UI language
and cannot switch at runtime.

## Decision

1. **Own typed catalog.** `src/i18n/catalog/en.ts` holds every string and is the
   source of the keys. `src/i18n/catalog/de.ts` is typed against it, so a
   missing key or a wrong param shape fails `npm run typecheck`. A value is a
   string, or a function of typed params that prints every number through the
   locale's `f.number()`. JoyFox calls `browser.i18n.getUILanguage()` only to
   pick the default. The manifest name and description stay English (no
   `_locales/`), and `config/permissions.json` does not change.
2. **Messages, not text.** Code that writes display text writes a `Message`: a
   key and its params, plain JSON (`src/i18n/message.ts`). A param that is
   itself translated (a placement, a condition, a field name) is a nested
   `Message`; a string param is always literal. The translator (`t()`) turns a
   `Message` into text when it is shown. So the background never produces
   display text, a stored reason follows a later language switch, and user text
   never passes through the catalog.
3. **Stored reasons.** `ConversationClassification.reasons` is the only stored
   display text. Schema version 3 rewrites version 2's English reasons as
   messages; any text it does not recognize is kept verbatim as `legacy.text`.
   Import converts version 1 and 2 files the same way. `isMessage` checks each
   stored and imported reason against `MESSAGE_PARAMS`.
4. **Errors.** `ExtensionError` gains an optional `display` message. The English
   `message` stays for logs. The options panels show `display`, or a per-code
   fallback, and never `message`. Every import refusal has a `display`.
5. **Setting and live switch.** The choice is `joyfox.locale` in
   `storage.local`, global, written only when the user picks a language. The
   options page and the content script read it at start and follow
   `storage.onChanged`. On a change, each surface draws itself again in place:
   typed text, open editors, open drawers and statuses stay, and no node is
   added twice. The rule editor draws itself from what the form shows, so even a
   number that is not valid yet stays.
6. **Toggle.** A select in the options page header, labelled "Sprache /
   Language", with "Deutsch" and "English". It is never translated, so a user
   who cannot read the current language can still find it.
7. **German copy.** Informal "du", neutral nouns for people ("Person",
   "Mitglied"), the owner's glossary, and JoyClub's own German labels where a
   text names a JoyClub control ("Profil ignorieren", "In den Papierkorb
   schieben", "Senden").
8. **Dates and numbers.** `formatDate()` and `formatNumber()` use `Intl` with
   `de-DE` or `en-US`. A date shown is the UTC calendar day, as the stored ISO
   value names it. Dates used as keys (the facts cache key, the inbox's daily
   refresh, the export file name) stay ISO.

## Consequences

- Every new UI string needs a key in both catalogs. The catalog tests fail on an
  empty value, a number not formatted for the language, or a param that one
  language shows and the other does not. A leak-guard test renders each surface
  in German and fails on any English catalog text.
- Both catalogs ship in the content script and the options page bundle. The
  background bundles the English catalog only, to check stored messages; it
  never renders text.
- A template without a folder is sent as `""` and shown under the translated
  "General" name, sorted where that name reads in the language shown.
- `docs/i18n-strings.md` lists every key with its English and German text for
  review. A test fails when it no longer matches the catalogs.
