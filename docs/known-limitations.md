# Known limitations

- No live selector or route is verified, so all site-specific behavior is
  disabled and the content script is intentionally a no-op.
- A stable account, member, conversation, event, and message identity source is
  unknown. Features must not use display names as identifiers.
- Background persistence is proven by an automated database-backed wake-counter
  test; a manual forced event-page restart remains an acceptance check.
- Encryption is an isolated proof of concept. There is no sync transport.
- Firefox signing and AMO distribution have not been implemented or claimed.
- Database version 1 supplies a migration boundary. No historical schema yet
  exists to migrate.
