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

Milestone A remains partially complete because F2's live extraction acceptance
depends on F1. The backlog does not permit Milestone B to start before that
dependency is complete. All remaining Foundation work that can be implemented
without inventing JoyClub behavior is complete.

## Review findings

### Confirmed issues fixed now

- Repository validation previously checked only common metadata, so malformed
  entity-specific records could be stored. Every entity now receives runtime
  validation, and SyncConfig explicitly rejects passphrases and key material.
- Decryption previously trusted serialized crypto parameters. Unsupported
  parameters and invalid salt, IV, or ciphertext shapes are now rejected before
  key derivation.
- The navigation coordinator did not emit History API changes despite declaring
  that event type. It now handles push, replace, and pop navigation and restores
  wrapped browser functions when stopped.
- The unverified content shell previously started observers and navigation
  hooks. It now performs no page work until at least one selector definition is
  verified.

### Confirmed issues deferred

- Live page detection and one-field extraction cannot be completed until F1
  supplies sanitized selector evidence.
- A reliable active-account and member identity source cannot be implemented
  until F1 and F9 establish where those stable identities exist.

### Possible risks

- Current synthetic navigation coverage may need adjustment after JoyClub's
  actual full-page versus client-side navigation behavior is observed.

## Blocked by live verification

- F1 verified page structure and selectors.
- The live portion of F2.
- F7 Ignore and Delete behavior.
- F9 qualification availability and identity sources.

## External release verification

- F8 Firefox signing and distribution requirements must be checked for the
  chosen release channel before distribution work.
