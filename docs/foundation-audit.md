# Foundation audit

## Completed

- F0 bootstrap, Firefox build, checks, synthetic-DOM test environment, and CI.
- Core domain and extraction result types.
- F2 disabled selector registry, page detector, content bootstrap, and shared
  navigation coordinator.
- F3 database-backed background wake-counter proof.
- F4 isolated WebCrypto proof with explicit parameters.
- F5 typed messaging, diagnostic ping, errors, request and port helpers.
- F6 versioned IndexedDB, validation, account-scoped repositories, export, and
  deletion foundation for every required entity.

## Current phase status

Milestone A is complete. On 2026-09-23 F2's live acceptance passed (across ten
real inbox loads, the content script detected the inbox and extracted the sender
name and member ID from all 25 rendered rows), and F3's forced event-page
restart passed in devtools: the persisted wake counter rose by one after
**Terminate background script** (see `manual-acceptance.md`). F1, F7 and F9
remain partly open, as the build plan allows them to run alongside the software
foundation.

Milestone B has started with M5 and M7, which depend on F6 rather than F1. See
`milestone-b-audit.md` for what those cover and what they still leave blocked.

## Review findings

### Confirmed issues fixed now

- Repository validation previously checked only common metadata, so malformed
  entity-specific records could be stored. Every entity now receives runtime
  validation, and SyncConfig explicitly rejects passphrases and key material.
- Decryption previously trusted serialized crypto parameters. Unsupported
  parameters and invalid salt, IV, or ciphertext shapes are now rejected before
  key derivation.
- The navigation coordinator did not reliably observe History API changes from
  an isolated content-script world. It now detects URL transitions without
  replacing native page functions and handles pop navigation directly.
- The unverified content shell previously started observers and navigation
  hooks. It now performs no page work until at least one selector definition is
  verified.

### Confirmed issues fixed in the final review (2026-09-23)

- Build plan Section 23 requires every build to verify network isolation, and
  the Test Strategy asks for an integration test. None existed.
  `tests/integration/network-isolation.test.ts` now checks that no source file
  uses a network API or names a remote address, that the manifest allows no
  other origin, and that every page feature run against the fixtures makes no
  request. It runs in `npm test`, so CI checks it on every push.

### Confirmed issues deferred

- Live page detection and one-field extraction cannot be completed until F1
  supplies sanitized selector evidence.
- A reliable active-account and member identity source cannot be implemented
  until F1 and F9 establish where those stable identities exist.

### Possible risks

- Current synthetic navigation coverage may need adjustment after JoyClub's
  actual full-page versus client-side navigation behavior is observed.

## Blocked by live verification

- F1 search, event and composer pages (inbox, conversation and profile are
  verified).
- F7 Ignore and Delete behavior.
- F9 qualification availability and identity sources.

## External release verification

- F8 Firefox signing and distribution requirements must be checked for the
  chosen release channel before distribution work.
