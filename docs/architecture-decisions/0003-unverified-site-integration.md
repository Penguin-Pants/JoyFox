# ADR 0003: Disable all unverified site integration

Status: accepted.

The page detector returns a missing result and every selector definition is
unverified and empty until sanitized live observations are supplied. This is a
deliberate correction to the backlog dependency: messaging and storage
foundations can be built without pretending F2's live extraction acceptance is
met. It preserves graceful degradation and avoids invented routes or selectors.
