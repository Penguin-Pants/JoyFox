# 0007: Data control scope and the template insertion trial

## Status

Proposed (Milestone D). Awaiting the project owner's confirmation.

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
   active pointer goes first, and every account lock is held while the stores
   are emptied. The database and its stores stay, so no upgrade is needed.
4. **Two exports.** "Export this account" holds the account's records in every
   entity. "Export all JoyFox data" holds every record in every store, whatever
   its scope. Both carry the schema version and are indented JSON. The file name
   holds only the scope and date, never an account identifier.
5. **One optional `folder` text field.** A template without one shows under
   "General". The three PRD folders are offered as suggestions; any name is
   allowed. No database version change is needed (an optional field, as with the
   join window).
6. **Refuse, never truncate.** If the result would pass the composer's
   `maxlength`, nothing is inserted and the user is told. A disabled or
   read-only field is refused too. If the page changes the text right after
   insertion, the user is told to check it before sending.
7. **An opt-in trial, off by default.** The picker appears on a conversation
   page only while `joyfox.templateInsertionTrial` is `true` in `storage.local`.
   It sends `input` and `change` events after the insertion, fills the text
   field only, and never clicks, submits or reads Send. The trial is how item 6
   gets verified (`manual-acceptance.md`, items 27 to 34). The event ClubMail
   composer stays unsupported: no evidence exists for it.

## Consequences

- M8's functions are complete and tested. M10's storage, options UI and
  insertion are complete and tested against the synthetic composer. M10's PRD
  acceptance ("every compose context, including event ClubMail") stays open
  until the trial passes and the event composer is verified.
- Deleting a single member record does not delete notes or other records that
  refer to it. The inspector says what it deletes, one entity at a time.
- If the owner reads "delete account data" as "remove the account", only the
  button text and one call change.
