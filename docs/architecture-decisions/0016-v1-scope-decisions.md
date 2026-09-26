# 0016: V1 scope decisions: no per-audience rules, license, presets

## Status

Accepted (project owner, 2026-09-26).

## Context

The V1 task plan (`Task Backlog.md`, "V1 Phase") left owner decisions open and
marked some acceptance criteria as proposed. On 2026-09-26 the owner answered
these:

1. V1-1, per-audience contact rules: one JoyFox rule set per sender profile type
   (single man, single woman, couple). PRD Sections 6.1, 11.4 and 20 list it as
   V1 scope. D1 asked whether a distinct couple audience was needed (PRD Section
   23).
2. D3: the open-source license and the repository name.
3. D8: the thresholds for the PRD 11.3 presets "Complete profiles only" and
   "High-trust members".
4. The proposed criteria of V1-7, V1-8 and V1-12.

## Decision

1. **V1-1 is dropped.** JoyClub's own contact settings already let the user
   accept messages only from profiles that meet their criteria, including by
   profile type. JoyFox adds its own conditions on top of that with one rule for
   all senders. No profile-type condition is added to that rule either. This
   overrides PRD Sections 6.1 and 11.4 and the per-audience item in PRD
   Section 20. **D1 is closed as moot**: it only decided which audiences V1-1
   needed.
2. **License: GNU GPL, version 3 or later (`GPL-3.0-or-later`).** The repository
   name stays `JoyFox`.
3. **Preset values (D8):**

   | Preset                 | Conditions                                                                                          |
   | ---------------------- | --------------------------------------------------------------------------------------------------- |
   | Open                   | None                                                                                                |
   | Complete profiles only | At least 3 photos and at least 50 words of profile text                                             |
   | Verified members       | Verified                                                                                            |
   | High-trust members     | Verified, at least 3 photos, at least 50 words of profile text and an account at least 180 days old |
   | Custom                 | None set; the user picks conditions                                                                 |

   "High-trust members" has no trust-score condition. The local trust score
   counts only the user's own history with a member (M6,
   `src/trust/trust-score.ts`), so a first sender almost always has no score,
   and the condition would quarantine nearly every first message. The user can
   still add the condition by hand. The same completeness level (3 photos, 50
   words) is the "incomplete" limit for V1-10's badge and filter.

4. **Criteria approved:** the proposed criteria of V1-7, V1-8 and V1-12 are
   accepted as written.

## Consequences

- JoyFox cannot require a condition from one profile type only, for example
  verification from single men only. The user sets that part in JoyClub's own
  contact settings.
- `ProfileSnapshot` still has no profile-type field, and `profileTypeFromCode`
  (`src/extraction/joyclub.ts`) still has no caller. Nothing in V1 needs them
  now.
- The repository gets a `LICENSE` file with the GPL version 3 text, and
  `package.json` states `GPL-3.0-or-later`. The rest of V1-8 stays open.
- V1-9 no longer depends on V1-1 or D1, and D3 is answered. It still depends on
  D4 (the ToS review and the GDPR consult) and the other items in its row.
