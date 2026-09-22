# Milestone B audit

Milestone B is M1, M3, M5 and M7. This increment covers the first step of the
build plan's recommended order, Section 32 step 10: "Implement M5 and M7 first
as low-risk persistence validation."

## Completed

### M7 multi-account isolation

- Explicit active account. The pointer lives in `storage.local`, not in an
  account-scoped store, so it is readable before a scope exists. A pointer that
  no longer resolves reports no active account instead of selecting another.
- Account directory in the ExtensionAccount store, each record self-scoped.
- Options page with an account switcher that names the active account in words,
  marks each row `Active` or `Not active`, labels every control, and states that
  JoyFox cannot detect the JoyClub login.
- Account removal deletes every record in that scope and asks for a second,
  explicit click first.
- The isolation test from Section 14 runs as an integration test: data under
  account A stays invisible and unchanged while account B is active, export
  covers one scope only, and a record whose `accountId` disagrees with the write
  scope is rejected.

### M5 profile notes and tags

- `NotesService` keys notes and tags to the account plus a resolved member
  identity, one note per member, tags deduplicated case-insensitively with the
  typed spelling kept.
- `resolveMemberIdentity` refuses a display-name field outright, refuses any
  field without a verified selector, and refuses an identifier that cannot serve
  as a storage key. A refusal is a returned value with user-facing text, not an
  exception.
- Saving also registers the JoyClubMember record, so an export has no dangling
  member IDs.
- Typed error categories from Section 21 now exist in `src/errors.ts`.

## Review findings

### Confirmed issues fixed now

- The removal confirmation stayed armed after the user did something else, so a
  single later click could delete an account without a fresh warning. Any other
  action, and any failure, now disarms it.
- Unstable identity field names were matched case-sensitively, so a registry
  spelling of `SenderName` would have passed a guard that `senderName` failed.
  The comparison now ignores case.
- The status message was a new element on every render, which can leave a live
  region's announcement unread. One live region is now created once and reused.
  Its state rides on `data-kind` rather than a mutated class list.
- `mountAccountPanel` could mount a second panel on the same element. It now
  returns the panel already mounted there.
- `src/errors.ts` declared an error code no caller used and the build plan does
  not list. It was removed.

### Confirmed issues deferred

- Tags for one member are found by listing the account's tags and filtering. A
  member index would change the database schema, which belongs with the M8
  inspector work rather than here.
- Two concurrent `createAccount` calls could both pass the duplicate check, as
  the check and the write are separate transactions. The options page is
  single-user and serializes clicks, so this is recorded rather than fixed.

### Possible risks

- Actions re-render without a queue. Rapid repeated clicks could render an
  intermediate state, although every render reads committed storage, so the
  settled state is correct.
- The note and tag size limits are this implementation's storage guards. Live
  observation may show JoyClub allows longer content worth keeping.

## Blocked by live verification

- The profile-page note and tag UI. M5 requires notes visible on a profile,
  which needs a verified profile page and member identifier from F1.
- Automatic active-account detection. M7 asks for reliable account identity
  detection; until F1 and F9 establish where that identity exists, the active
  account stays a user choice and the UI says so.
- M1 and M3, the rest of Milestone B. M1 additionally depends on the F9
  availability matrix.

## Phase status

Milestone B is partially complete: M5 and M7 are implemented to the limit that
verified selectors allow, M1 and M3 have not started.
