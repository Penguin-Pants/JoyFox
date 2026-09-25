# 0015: Trusted exception, M9 guided mode and the message-caching toggle

## Status

Accepted (project owner, 2026-09-25).

## Context

Three PRD items were open because each needed an owner decision, not site
evidence:

1. PRD Section 7.4: "a sender the user has manually tagged 'trusted' bypasses
   triage". JoyFox has no "trusted" tag. It has a per-sender manual placement
   (ADR 0006): one click moves a sender to Qualified, Needs Review or
   Quarantined, and that placement wins over the contact rule until the user
   chooses "Use my rule again".
2. PRD Section 6.1: "a settings toggle can fall back to the guided alternative
   (navigate and stage, real clicks stay the user's)". "Stage" was not defined.
   Mode A (JoyFox clicks, the button is the confirmation) is built and its
   manual matrix was accepted on 2026-09-25 (ADR 0011).
3. PRD Section 19.5: a user-facing toggle for message caching must exist before
   JoyFox stores message text. Nothing stores message text yet: the spam
   detector is not wired to pages (ADR 0004), and that wiring waits on the
   message-bubble evidence.

## Decision

1. **Trusted exception: manual placement counts.** Placing a sender in Qualified
   by hand is the PRD 7.4 trusted bypass. It is per sender, reversible ("Use my
   rule again") and explained in the "Why" panel. No tag is reserved and no code
   changes. The other PRD 7.4 exceptions are unchanged: the
   existing-conversation exception still waits on reply detection, and
   "previously met" is available as the "Personally known" rule condition.
2. **Guided mode: dropped.** Mode A is the only M9 mode. It stays behind the
   experimental flag `joyfox.quickIgnoreDelete`, which is the owner's way to
   turn it off. The PRD's guided alternative is not built and is no longer
   tracked as MVP work.
3. **Message-caching toggle: deferred.** It is built together with the first
   feature that stores message text, and that feature cannot ship without it.
   Until then no toggle is added, because it would control nothing.

## Consequences

- M2's PRD 7.4 trusted exception is met by existing, tested code.
- M9 has no open build item except those blocked on evidence (the own-row match)
  and the provisional timings.
- The PRD text is unchanged. This record states where the build differs from it.
