# 0007: Data control scope and the template insertion trial

## Status

Accepted (project owner, 2026-09-23).

## Context

Milestone D (M8, M10) needed decisions that no planning document made:

1. Build plan Section 15 lists "delete account data" beside "delete all
   extension data", but does not say whether the account itself goes too. The
   Accounts panel already removes an account with all of its data.
2. Whether the account record may be deleted like any other record.
3. What "delete all extension data" covers. PRD Section 21.1 asks for "no
   residue". Some records use a scope that is not a registered account (the
   diagnostic wake counter), and small settings live in `storage.local`.
4. Whether "export everything" is per account or literally everything.
5. How templates are organized. PRD Section 6.1 names optional folders (General,
   Event Confirmation, Event Cancellation) but no data shape.
6. How insertion behaves when a template does not fit the composer.
7. Whether the composer picker is live. Build plan Section 17 requires insertion
   "through the page's normal text field behavior so JoyClub detects the
   change", but which events JoyClub needs is not verified
   (`manual-verification-needed.md`, item 6), and `selector-map.md` keeps M10
   insertion blocked on it.

## Decision

1. **"Delete this account's data" keeps the account.** It deletes every record
   of the account except the account record, so the account stays registered and
   active. Removing the account too stays the Accounts panel's "Remove".
2. **The account record is deleted only with the whole account.** The inspector
   shows it but offers no delete for it.
3. **"Delete all JoyFox data" empties every store and `storage.local`.** It
   clears every store, whatever the scope, and every `storage.local` key. The
   active pointer goes first, every account lock is held while the stores and
   settings are emptied, and an account that appears meanwhile is reported as a
   failure. The database and its stores stay, so no upgrade is needed.
4. **Two exports.** "Export this account" holds the account's records in every
   entity. "Export all JoyFox data" holds every record in every store, whatever
   its scope, plus every `storage.local` setting. Both carry the schema version
   and are indented JSON. The file name holds only the scope and date, never an
   account identifier.
5. **One optional `folder` text field.** A template without one shows under
   "General". The three PRD folders are offered as suggestions; any name is
   allowed. No database version change is needed (an optional field, as with the
   join window).
6. **Refuse, never truncate.** If the result would pass the composer's
   `maxlength`, nothing is inserted and the user is told. A disabled or
   read-only field is refused too. If the page changes the text right after
   insertion, the user is told to check it before sending.
7. **An opt-in trial first, then default-on.** The picker first appeared on a
   conversation page only while `joyfox.templateInsertionTrial` was `true` in
   `storage.local`. It sends `input` and `change` events after the insertion,
   fills the text field only, and never clicks, submits or reads Send. The trial
   is how item 6 gets verified (`manual-acceptance.md`, items 27 to 34). The
   event ClubMail composer stays unsupported: no evidence exists for it.

**Update (2026-09-23).** The owner ran the trial (`manual-acceptance.md`, items
31 to 34). JoyClub registered an inserted template and its deletion by keyboard,
so item 6 is settled for the standard composer. On the owner's decision the
picker is now on by default. The trial key is replaced by
`joyfox.templatePicker`; setting it to `false` turns the picker off.

## Consequences

- M8 is complete and accepted live. M10 is complete and accepted live on the
  standard composer. Its PRD acceptance ("every compose context, including event
  ClubMail") stays open until the event composer is verified.
- Deleting a single member record does not delete notes or other records that
  refer to it. The inspector says what it deletes, one entity at a time.
