# 0005: Cached profile facts do not expire

## Status

Accepted.

## Context

M1 fills a fact the current page does not show from the newest cached
ProfileSnapshot that knows it. PRD Section 16.5 says snapshots are "superseded
on re-visit" and "never treated as permanently accurate", but no document sets
an age after which a cached fact stops counting. Without a decision, an old fact
such as a verification badge could either keep counting indefinitely or be
dropped by an invented age limit.

## Decision

The project owner decided that cached profile facts do not expire. A cached fact
counts until a newer observation of the same member replaces it, or until the
user deletes it.

## Consequences

- Snapshots are still bounded by count, not by age: each write keeps the newest
  20 snapshots per member (PRD Section 13.3; a setting since V1-12, default 20).
  Nothing purges a snapshot because of its age.
- A fact observed on the current page always wins over a cached fact, and a
  newer snapshot wins over an older one. This is how a cached fact is
  "superseded on re-visit".
- Each evaluated criterion reports whether its fact was observed or cached, so
  the result is never presented as a fresh reading when it is not. Showing the
  capture time is a UI concern for the M1 badge, which waits on F1.
- A fact that changed on JoyClub since the last visit stays in use until the
  member's profile is seen again. This is accepted in exchange for not opening
  profiles to refresh data, which the build plan forbids.
