# 0009: Import of JoyFox exports, merged into stored data

## Status

Accepted (project owner, 2026-09-24: "Merge", "Full and account exports", and
approval of the merge rules below).

## Context

M8 (build plan Section 15) requires export and delete but not import. The owner
asked to move a whole profile to a new Firefox install. The PRD names export
only (Section 13.3), and encrypted sync is V1 scope, so import is an
owner-requested extension of M8. Three choices were open: what to do with data
already stored, which files to accept, and how conflicts resolve.

## Decision

1. **Merge.** An import adds to what is stored; it never deletes.
2. **Files.** Both "Export all JoyFox data" (scope `all`) and "Export this
   account" (scope `account`) are accepted. A file from a newer schema version
   is refused.
3. **Accounts.** An imported account merges into a stored account with the same
   JoyClub identifier. Otherwise it is added. If its ID is taken by a different
   stored account, it gets a new ID and its records follow it. A stored
   account's label is kept.
4. **Same record ID.**
   - Note, contact rule, manual placement, preference, saved search, event note,
     spending entry, spam phrase: the newer `updatedAt` wins; on a tie the
     stored one stays.
   - Account, member entry, tag, not-spam correction, trust outcome, profile
     snapshot, cached message, action log, template, sync setting: the stored
     one stays. (Sync setting was added after review: a file must never redirect
     an existing sync endpoint.)
   - A template with the same name, folder and text as a stored one in the same
     account is skipped as a duplicate.
5. **Settings.** Only allowlisted settings are imported, with the right type,
   and only when not stored: today `joyfox.templatePicker`. Feature switches
   (`joyfox.quickIgnoreDelete`, `joyfox.diagnostics`) are never imported, and
   the preview names them. Change markers are dropped. The active account is set
   only when none is active: to the file's active account (mapped), or else the
   first imported account.
6. **Safety.**
   - The whole file is checked first: JSON, schema version, scope, every record
     against the storage validation and a closed list of fields per data type,
     no `__proto__`, `constructor` or `prototype` key at any depth, no date more
     than a day in the future in any date field (including action steps), closed
     nested shapes for action steps and rule conditions, the size limits of
     notes, tags and templates, cached message text already in normalized form,
     no duplicate records, no two accounts with one identifier, and in an
     account export every record in that account. Any problem refuses the whole
     file.
   - A record whose scope is not an account in the file (the diagnostic wake
     counter) keeps its scope, but it must not name a stored account or an
     account the import writes to. Two file records that map to the same stored
     record refuse the file.
   - Choosing the file starts the import; there is no second confirmation (owner
     request, 2026-09-25). The file is checked and planned first; a file that
     fails the check writes nothing. After the import, a table shows, per data
     type, what was added, replaced, kept and skipped.
   - The file chooser is disabled from a file choice until that import settles,
     so a second choice can never overlap a write.
   - The import runs under the exclusive data lock and plans again from current
     data. If the plan differs from the check made on file choice, nothing is
     written.
   - All records are written in one IndexedDB transaction, so a failure leaves
     stored records unchanged. Settings are written after that as a best-effort
     step; if they fail, the user is told the records were imported and the
     settings were not.

## Consequences

- A whole install moves by "Export all" on one Firefox and "Import" on the
  other. Importing the same file twice changes nothing.
- An older note is replaced by a newer one, never combined. The owner approved
  this; combining is not built.
- Retention (12 months of cached messages) is not applied during import. It
  applies on the next ordinary write to that store. Since V1-12, the profile
  snapshot limit (20 per member by default, a setting) is applied right after an
  import, with the limit in effect once the file's settings are saved.
- Import reads the whole stored database to plan. That is fine for one person's
  data; a very large store makes the preview slower.
