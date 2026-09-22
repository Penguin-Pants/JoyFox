# 0004: Storage for the template spam detector

## Status

Accepted.

## Context

M3 requires similarity "against previous local messages" and a "not spam"
override that "persists for that sender". PRD Section 12.1's entity table
defines storage for neither. PRD Section 19.5 does anticipate cached message
text, but ties it to Conversation History Search, a V1 feature that build plan
Section 29 excludes from MVP "unless required by an MVP abstraction".

F6 declared the schema MVP-complete, so this is a gap in that claim rather than
a change of scope. Two readings were possible: add entities, or ship the
detector as a pure engine with no persistence and leave M3's acceptance
criterion unmet.

## Decision

Add two entities at database version 2.

`MessageObservation` stores the normalized text of a message the user already
had on screen, keyed to the account and sender. The normalized form is what the
detector compares, and storing only that form means the original wording is
never at rest. The field list is closed by validation so a field carrying the
original text cannot be added by accident. Retention follows PRD Section 19.5's
12-month default, measured from the write.

`SenderSpamOverride` stores one per-sender correction with its timestamp and an
optional user reason. Reusing TrustSignal was rejected: its kinds mean "good
conversation", "spam" and "no reply", and conflating those with "never flag as
template spam" would weaken the explanation PRD Section 7.5 requires every
placement to carry.

## Consequences

- An upgrade path now exists and is exercised: version 1 databases keep every
  record, and each version creates only its own stores.
- Export and account deletion cover both entities automatically, because they
  iterate the entity list.
- Message caching needs the user-facing toggle PRD Section 19.5 describes before
  anything writes an observation from a live page. Nothing does yet.
- A future Conversation History Search can build on `MessageObservation` or sit
  beside it, rather than needing a second incompatible message store.
