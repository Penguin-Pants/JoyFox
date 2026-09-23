# 0006: Triage presentation, manual placement and trust score

## Status

Accepted (project owner, 2026-09-23).

## Context

Milestone C (M2, M4, M6) needed four decisions that no planning document made:

1. How the inbox shows the three groups. The build plan says "DOM reordering
   only", but JoyClub renders its list with its own framework, so moving its
   rows can break or undo its rendering.
2. What the default inbox view shows.
3. How the basic local trust score is calculated.
4. What happens to an existing conversation. PRD Section 7.4 says it bypasses
   triage, but JoyFox cannot yet tell whether the user replied: the read-status
   icon's meaning is not confirmed.

## Decision

1. **Filter tabs.** A JoyFox tab bar above the list selects a view. Rows are
   hidden in place by an extension stylesheet that reads JoyFox's own
   `data-joyfox-*` attributes. No JoyClub row is moved, removed or restyled, and
   JoyClub's order is kept.
2. **Default view: all but Quarantined.** Tabs: Inbox (Qualified and Needs
   Review), Qualified, Needs Review, Quarantined, and Show all.
3. **Simple point count.** +1 per positive and -1 per negative logged outcome, 0
   per neutral one, -1 for an open template-spam flag, +1 for "persönlich
   bekannt". Every point is listed. With no contribution the score is unknown,
   not 0.
4. **Per-sender manual placement.** Every row is triaged. The user can move any
   sender to a group with one click, and JoyFox remembers it until the user
   chooses "Use my rule again". The automatic existing-conversation exception
   stays blocked until reply detection is confirmed.

## Consequences

- Turning the rule off, or any failure to get an answer from the background,
  leaves JoyClub's list exactly as it was.
- The grouping is a filter, so within a group the rows keep JoyClub's order.
- The trust score can be used by the rule (`minimumTrustScore`). A member with
  no history is unknown for that condition, so it follows the condition's
  unknown handling.
- A manual placement is stored per sender, because the inbox shows no
  conversation ID (`01-inbox.md`).
