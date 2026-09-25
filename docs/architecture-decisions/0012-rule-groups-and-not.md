# 0012: Contact rule groups (AND/OR) and "not"

## Status

Accepted (project owner, 2026-09-25: "approved, build it", after the clickable
mockup).

## Context

The M4 builder shows PRD Section 11.5's two boxes: "ALL of these", or "ANY of
these". The owner needs rules that the boxes cannot hold, for example:

- A sender is qualified if **Personally known**, OR if **Verified** AND at least
  **180 days** old AND at least **3 photos**. An unverified sender can still
  qualify when personally known.
- Two or more such ALL rules at the same time.
- A condition turned around ("not"), for example fewer than 3 photos.

The stored schema already is a tree of All/Any groups (build plan Section 11),
so only "not" is new to storage.

The owner chose: rule groups, a "not" option, one outcome for the whole rule,
and both editors (Simple and Advanced).

## Decision

1. **Advanced editor.** "A sender is qualified if [ANY/ALL] of these rules
   match." Each rule: "Rule N: met if [ALL/ANY] of these are met", with only the
   conditions it uses, "+ Add condition…", a ✕ per condition and "Remove rule".
   "+ Add rule" allows up to 10 rules. Each condition keeps its number field and
   its "If JoyFox cannot see this" choice. The button that deletes the whole
   stored rule is renamed "Delete whole contact rule", so it cannot be mistaken
   for a rule's own "Remove rule".
2. **Storage.** The root group holds one group per rule, in the order shown. A
   rule without conditions is not stored, because an empty group is met by every
   sender. If no rule has conditions, the rule qualifies every sender, as an
   empty Simple form does, and the page says so.
3. **"not" (`negate: true`).** A met fact counts as not met and the opposite. On
   a number condition it means "fewer than". An unknown fact still counts as the
   condition's "If JoyFox cannot see this" choice: it is not turned around, so
   an unknown never qualifies a sender by accident. The checkbox is small and
   grey until ticked, then bold and red (owner feedback on the mockup).
4. **Schema version 2.** `negate` needs version 2. `contactRuleProblem` accepts
   versions 1 and 2 and refuses `negate` in version 1. A rule is written with
   the lowest version that holds it (`schemaVersionFor`), so a rule without
   "not" stays version 1 and an older JoyFox build can still read it. Import
   accepts the `negate` field.
5. **Why panel.** When the root holds two or more groups and nothing else, each
   reason starts with "Rule N:", so the owner sees which rule decided. A
   turned-around condition says so in its reason and in the list of checked
   conditions ("not Minimum photos"). The two-box shape is not numbered, so its
   reasons do not change.
6. **Simple and Advanced switch.** Simple is offered only while the rule fits
   the two boxes: the rules combine with ANY, nothing uses "not", at most one
   rule needs ALL of several conditions, and no condition repeats in the ANY
   box. Otherwise the Simple button is off and the reason shows next to it, so
   Simple never overwrites a rule it cannot show. A switch changes no stored
   rule; the next edit saves. The page opens the Simple editor when the stored
   rule reads as two boxes, else Advanced. A rule saved from Advanced with two
   or more rules does not read as two boxes, so it opens in Advanced again.
7. **Autosave** works as before: a choice at once, a number when its field loses
   focus, with the same account and other-tab checks.

## Consequences

- A Simple rule with an empty ALL box and conditions in the ANY box qualifies
  every sender (the page warns about this). Opened in Advanced, the empty ALL
  box is not shown, so the next save from Advanced keeps only the ANY
  conditions. This matches what the owner sees on screen.
- Rules nested deeper than "rules of conditions" (possible only through import)
  still cannot be edited; the page offers to remove them.
- Per-audience rules stay out of scope; the schema still supports them.
