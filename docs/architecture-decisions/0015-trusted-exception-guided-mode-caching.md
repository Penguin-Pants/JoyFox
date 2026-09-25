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
3. A user-facing toggle for message caching, required before JoyFox stores
   message text. This is a project requirement from ADR 0004, not PRD text. ADR
   0004 and later docs cited it as "PRD Section 19.5", but the PRD has no
   Section 19.5 (Section 19 has only 19.1 and 19.2). The PRD's own rule is
   Section 13.3: cached message text is on by default, with a configurable
   auto-purge window (default 12 months), and is always manually deletable.
   Nothing stores message text yet: the spam detector is not wired to pages (ADR
   0004), and that wiring waits on the message-bubble evidence.

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
3. **Message-caching toggle: deferred.** The ADR 0004 toggle is built together
   with the first feature that stores message text, and that feature cannot ship
   without it. Until then no toggle is added, because it would control nothing.
   That feature must also meet PRD Section 13.3: a configurable auto-purge
   window with a 12-month default (the default already applies to
   `MessageObservation`, ADR 0004) and manual delete (the data inspector, M8).

## Consequences

- M2's PRD 7.4 trusted exception is met by existing, tested code.
- Guided mode leaves M9's open work. The rest stays tracked where it was:
  - blocked on evidence: matching the deleted conversation's own row (ADR 0011);
  - provisional timings: the 15-second step timeout and wait, the 2-minute stale
    threshold and the 10-second profile wait (`known-limitations.md`);
  - deferred defects: a `start` stored after its timeout reads as running for 2
    minutes, so a retry meanwhile answers "busy" (`milestone-e-audit.md`); and a
    cancel followed by the same member's profile within the 15-second wait still
    continues the run (ADR 0011).
- The PRD text is unchanged. This record states where the build differs from it.
- Earlier docs cited "PRD Section 19.5". On 2026-09-25 each citation was
  corrected: the 12-month retention now cites PRD Section 13.3, and the caching
  toggle cites ADR 0004.
