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
- Background persistence is proven by an automated database-backed wake-counter
  test and reachable from the packaged bundle through the `diagnostic.wake`
  message; a manual forced event-page restart remains an acceptance check.
- Encryption is an isolated proof of concept. There is no sync transport.
- Firefox signing and AMO distribution have not been implemented or claimed.
- M1 qualification and M3 template detection run only as tested services. No
  badge, label or override control appears on JoyClub pages until F1 verifies
  the selectors, and M1 criteria have no settings UI until M4.
- Spam similarity compares against earlier messages supplied by the caller. No
  message history is stored, so each classification sees only the messages its
  caller passes in.
- The minimum message length (40 characters) and the similarity thresholds (0.7
  for earlier messages, 0.8 for phrases) are implementation defaults, not values
  tuned against real inbox data.
- Cached profile facts carry their capture time but do not expire.
- Database version 1 supplies a migration boundary. No historical schema yet
  exists to migrate.
