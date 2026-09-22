# Known limitations

- No live selector or route is verified, so all site-specific behavior is
  disabled and the content script is intentionally a true no-op: it installs no
  observer or navigation hook.
- A stable account, member, conversation, event, and message identity source is
  unknown. Features must not use display names as identifiers.
- Because no member identifier is verified, notes and tags can be stored only
  through an identity supplied in a test. In the shipped build every note and
  tag write is refused with a visible reason, and no profile-page note UI exists
  yet. Both unblock with F1.
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
