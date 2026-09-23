# Known limitations

- Only the inbox, conversation and profile pages on `www.joyclub.de` are
  verified (`docs/selector-map.md`). Inbox triage and the conversation and
  profile panel render there. Search, events and JOYCE stay disabled.
- The member ID is the number in the profile URL. Whether JoyClub ever reuses
  such a number is unconfirmed. Account, event and message identity sources are
  still unknown. Features must not use display names as identifiers.
- The note and tag editor (M5) shows on the profile page and on a conversation
  page, after the JoyFox panel. The inbox, search and event pages do not show
  notes or tags yet (build plan Section 12: "reusable later").
- Text typed in the note box and not saved is dropped when the active account
  changes or the page moves to another member, so it can never be saved under
  the wrong account or member. It is kept while the page briefly hides the
  header for the same member.
- While the editor is on a JoyClub page, the note and tag text is part of that
  page's document, which JoyClub's own scripts could read. JoyFox never sends it
  anywhere. Isolating the editor (for example in a closed shadow root) is a
  recorded follow-up; it would not stop a page script that records keystrokes.
- Account age comes only from the profile badge "Angemeldet seit <n> <unit>",
  which is a rounded duration, not a date. It becomes a join window widened one
  unit either side, because JoyClub's rounding is not confirmed. An age minimum
  passes or fails only when the whole window is on one side of it; otherwise the
  criterion is unknown. Only the German text is parsed, and only "11 Monaten"
  has been observed; the other unit forms follow German grammar. The inbox and
  conversation show no account age.
- Only code `1` ("geprüft") counts as JoyClub verification. Code `3`
  ("persönlich bekannt") is the user's own mark of having met the member; the
  shield then hides JoyClub's verification, so it reads as unknown. A missing
  shield and any other code also read as unknown, so an unverified member shows
  Partial information rather than Does not meet rule.
- "Personally known" is its own criterion (`requirePersonallyKnown`), higher
  trust than verification. Code `3` is "yes" and code `1` is "no" (the owner
  confirmed that green replaces grey). A missing shield and other codes read as
  unknown. It is read live on each page and never cached, as the user can change
  the mark. No settings UI exists yet (M4).
- Conversation header data is used only when its member ID matches a number in
  the conversation URL. If those URL numbers turn out not to be member IDs,
  header data will always read as missing.
- In the live check, a read state was extracted from only 9 of 25 rows. That
  count does not show how many rows carry the read-status icon: a row with the
  icon but no recognized `--<state>` modifier also counts as missing. The DOM
  has not been inspected for this, and the read state's meaning is unconfirmed.
  No feature uses it.
- The inbox is detected as soon as its list container renders, which can be
  before the rows arrive, so zero rows is ambiguous: still loading, or a truly
  empty inbox. No loading-complete or empty-state signal is verified yet. An
  inbox feature must not wait indefinitely on zero rows; it needs such a signal,
  or a bounded wait, before it treats the inbox as empty.
- The profile word count adds the motto and the main text. The conversation
  header's short description is counted separately and is not used for M1.
- The extension cannot detect which JoyClub login a tab uses. The active account
  is whichever one the user selected on the options page, and the identifier
  recorded for it is user-declared, not verified. Switching JoyClub logins in
  the browser does not switch the active JoyFox account.
- Tags for one member are read by listing the account's tags and filtering.
  There is no member index yet, so this cost grows with the number of stored
  tags per account.
- The note and tag size limits (4000 and 64 characters) are storage guards
  chosen by this implementation, not values observed from JoyClub.
- The spam detector's thresholds are provisional. No document sets a similarity
  threshold or a minimum message length, and the build plan Section 30 keeps the
  acceptable triage false-positive threshold an open decision. The current
  values, 8 words minimum, 0.85 duplicate similarity, 0.9 phrase similarity and
  a 200-message comparison window, are starting points to tune against a real
  inbox. They are configurable for that reason.
- In scripts written without spaces, each character counts as one word for the
  minimum length, which is coarser than dictionary word segmentation.
  `Intl.Segmenter` would be finer but needs Firefox 125, above the 121 floor.
- Nothing writes a message observation yet. The detector is wired to storage but
  not to any page, because reading a message needs verified selectors. The
  user-facing toggle PRD Section 19.5 requires for message caching must exist
  before the first live caller is added.
- A very short known phrase matches almost every message, because phrase
  matching includes substring containment. The phrase list is user-authored and
  no minimum length is documented, so none is enforced.
- No default rule is shipped, because the PRD states the thresholds as
  user-configured values. Until the user saves a rule, JoyFox does not sort the
  inbox. Presets (PRD Section 11.3) are not built.
- Inbox triage groups rows by hiding them in place (ADR 0006). Within a group
  the rows keep JoyClub's order. Live acceptance passed on 2026-09-23
  (`manual-acceptance.md`, items 19 to 26). Triage also runs on a conversation
  page while JoyClub shows the list beside it.
- The inbox shows only the verification shield. Photos, profile words and
  account age come from snapshots of profiles the user opened before, so a
  sender whose profile was never opened reads those facts as unknown.
- Spam status is unknown on every page, because no page reads message text yet.
  Only the user's own "not spam" correction counts.
- An existing conversation does not bypass triage (PRD Section 7.4), because
  JoyFox cannot yet tell whether the user replied. The per-sender manual
  placement is the workaround.
- If the background does not answer, the inbox stays untriaged until the rule,
  account, a placement or a trust outcome changes, or the page reloads.
- The local trust score counts only what the user logged and saw in this
  browser. It is not a community reputation.
- Per-member message and tag reads list the account's records and filter in
  memory. There is no member or timestamp index yet, so both the retention purge
  and each classification cost grows with the stored record count.
- Background persistence is proven by an automated database-backed wake-counter
  test and by the manual forced event-page restart (passed 2026-09-23).
- Encryption is an isolated proof of concept. There is no sync transport.
- Firefox signing and AMO distribution have not been implemented or claimed.
- Database version 1 supplies a migration boundary. No historical schema yet
  exists to migrate.
- Cached profile facts do not expire (ADR 0005). A fact that changed on JoyClub
  since the member's profile was last seen stays in use until the profile is
  seen again.
- The M10 composer picker runs only on the standard conversation composer. It is
  on by default and turned off by setting `joyfox.templatePicker` to `false`
  (ADR 0007). The event ClubMail composer has no evidence and is not supported,
  so M10's "every compose context" acceptance is still open.
- A template that does not fit the composer's `maxlength` is refused, never
  shortened. The template limits (name 80, folder 40, text 4000 characters) are
  storage guards chosen by this implementation.
- Template variables (for example the recipient's first name) are not built.
  Build plan Section 17 defers them until plain insertion is stable.
- Deleting one member record in the data inspector does not delete the notes,
  tags or other records that refer to that member. Each data type is deleted on
  its own.
- The data inspector shows records as raw JSON, 50 at a time. It is complete but
  not polished; PRD Section 20 puts inspector polish in V1.
