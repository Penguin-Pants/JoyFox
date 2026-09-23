# Known limitations

- Only the inbox, conversation and profile pages on `www.joyclub.de` are
  verified (`docs/selector-map.md`). The content script now starts its
  navigation observer on JoyClub pages, but no feature renders anything on a
  page yet. Search, events and JOYCE stay disabled.
- The member ID is the number in the profile URL. Whether JoyClub ever reuses
  such a number is unconfirmed. Account, event and message identity sources are
  still unknown. Features must not use display names as identifiers.
- No profile-page note or tag UI exists yet. Notes and tags can now resolve a
  member identity from a verified page, but nothing on a page calls them.
- No join date or account age has been found on the inbox, the conversation or
  the profile, and its absence is not yet established
  (`08-attribute-matrix.md`). Until one is verified, the account-age criterion
  is always unknown. When it is configured, the result is Partial information
  unless another configured criterion fails, which gives Does not meet rule.
- Verification is boolean. Codes `1` ("geprüft") and `3` ("persönlich bekannt")
  both count as verified, so a rule cannot yet require the stronger level. A
  missing shield and any other code read as unknown, so an unverified member
  shows Partial information rather than Does not meet rule.
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
- Qualification evaluates only criteria the caller supplies. No default rule is
  shipped, because the PRD states these thresholds as user-configured values and
  gives only an illustrative example. The rule builder that sets them is M4,
  which has not started.
- Per-member message and tag reads list the account's records and filter in
  memory. There is no member or timestamp index yet, so both the retention purge
  and each classification cost grows with the stored record count.
- Background persistence is proven by an automated database-backed wake-counter
  test and reachable from the packaged bundle through the `diagnostic.wake`
  message; a manual forced event-page restart remains an acceptance check.
- Encryption is an isolated proof of concept. There is no sync transport.
- Firefox signing and AMO distribution have not been implemented or claimed.
- Database version 1 supplies a migration boundary. No historical schema yet
  exists to migrate.
- Cached profile facts do not expire (ADR 0005). A fact that changed on JoyClub
  since the member's profile was last seen stays in use until the profile is
  seen again.
