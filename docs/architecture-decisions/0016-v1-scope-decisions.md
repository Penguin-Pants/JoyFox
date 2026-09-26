# 0016: V1 scope decisions: no per-audience rules, license, presets, no sync yet, overlay, attendance, disclaimer, release channel

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

## Amendment: extension ID (project owner, 2026-09-26)

The permanent Firefox extension ID (`browser_specific_settings.gecko.id` in
`manifests/firefox.json`) is `joyfox@drclaw`. It replaces the placeholder
`joyfox@example.invalid`, as V1-8's cleanup criterion requires. The ID cannot
change after the first signed release, since Firefox keys an extension's storage
to it. A build loaded with the placeholder ID keeps its data under that ID:
export it under "Your data" before the switch and import it after.

## Amendment: V1-11 criteria and V1-6 deferral (project owner, 2026-09-26)

1. **V1-11 criteria approved.** The proposed criteria are accepted as written:
   each preset fills the builder with the conditions in the preset table above;
   the user can then edit the result like any other rule; Custom opens the
   builder with no conditions set. In the build, a preset sets only the
   conditions, all in the ALL box, each sending the sender to Needs Review when
   JoyFox cannot see the fact. The on switch and the placement of a sender who
   does not meet the rule stay as the user set them. A preset saves at once,
   like every other rule change, so it asks for a second click before it
   replaces conditions already shown.
2. **V1-6 (self-hosted sync) is deferred** to the future roadmap. Local export
   and import (M8) are enough for now. This overrides the sync item in PRD
   Section 20's V1 list. D2 (the sync protocol) is deferred with it. V1-9 no
   longer depends on V1-6. The encryption decision (ADR 0002) and its proof of
   concept stay as they are, for when sync is built.

## Amendment: D5 and D6 (project owner, 2026-09-26)

1. **D5, the Compatibility Overlay (V1-2).** It compares every preference
   section that JoyClub's preference checklist shows the viewer. The exact list
   of sections and tags is confirmed from evidence E3, before V1-2 starts. On
   the profile page, the shared tags are highlighted inside JoyClub's own
   checklist. On search-result cards, inbox rows and attendee-list entries, a
   badge shows the number of shared tags ("N shared"), and the compatibility
   sort orders the loaded search results by that number. JoyFox shows no
   percentage, so the result does not read as a match score (PRD Section 8.5). A
   card shows a count only for a member whose profile the user opened before, as
   for the other cached facts. Preference fields are special-category data (PRD
   Section 13.1); they stay local and are covered by the snapshot history limit
   (V1-12).
2. **D6, the attendance values (V1-5).** Interested, Attending, Not attending,
   Attended and no status (`unknown`). "Attended" records an event the user went
   to, so past events keep a history. `EventMetadata.attendance` and its import
   validation accept the new value now; no screen writes it until V1-5. V1-13's
   shared-event exception uses Attending, as its criteria say, and the V1-13
   task decides whether Attended also counts.

## Amendment: D4 (project owner, 2026-09-26)

**D4: no ToS review and no GDPR consult before the public release; the release
carries a disclaimer instead.** This overrides the recommendations in PRD
Sections 18.3, 18.5 and 23. The owner chose it against the recommended option (a
self-review of JoyClub's terms plus one short GDPR consult), with the risks
stated:

- Nobody knows whether JoyClub's terms forbid tools like JoyFox. If they do,
  users can lose their accounts (PRD 18.4). Quick Ignore and Delete (M9) carries
  the highest risk and stays off by default.
- The household exemption (GDPR Article 2(2)(c)) very likely covers one user's
  private use, but it is not confirmed for a public open-source release. Sync is
  deferred (V1-6), so no data leaves the device.

The README states the disclaimer ("Disclaimer"): no connection to JoyClub, the
unchecked terms and the account risk, local storage of data about other members
and the user's responsibility for it, and no warranty. V1-9's release page
repeats it. The owner can still choose a review before V1-9 ships.

## Amendment: D7 and F8 (project owner, 2026-09-26)

1. **D7: no fixed personal testing period.** The public release (V1-9) follows
   when V1 is done and the MVP release gate passes. The owner chose this against
   the recommended option (at least 4 weeks of daily use plus exit criteria).
   This overrides the separate "personal dogfooding period" step in PRD Section
   24.7; the owner's own use while V1 is built takes its place. The risk: the
   last V1 features can reach users with little or no real use first.
2. **F8: an unlisted build with automatic updates.** Mozilla signs the build, it
   is not listed on addons.mozilla.org, and the GitHub release carries the
   signed `.xpi` (PRD Section 20). Firefox updates it through
   `browser_specific_settings.gecko.update_url`, which points to an
   `updates.json` served over HTTPS from GitHub; V1-9 sets the exact address.
   The steps in `docs/distribution.md` stay a draft until someone with access to
   the Mozilla pages completes its verification checklist; this environment
   cannot reach them. `data_collection_permissions` is added in V1-9, once its
   format is verified.
