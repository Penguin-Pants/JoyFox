# Manual acceptance

## Foundation shell

1. Build the Firefox extension and load `dist/firefox/manifest.json` temporarily
   from `about:debugging`.
2. Open a permitted page and confirm the extension reports no uncaught errors.
3. Confirm the page is visually and behaviorally unchanged while selectors are
   unverified.
4. Send `diagnostic.ping` from extension devtools and confirm the reply
   preserves its request ID and payload.
5. Invoke the background wake-counter, terminate the background page, invoke it
   again, and confirm the stored value increases rather than resetting.
6. Confirm normal use creates no extension-originated network requests.

## Accounts, notes and tags

7. Open the extension options page and confirm it reports
   `Active account: None selected` before any account exists.
8. Add an account, then confirm it is listed and marked `Active` in words, not
   only by styling.
9. Add a second account, switch to it, reopen the options page, and confirm the
   choice survived the reload.
10. Confirm every control is reachable and operable by keyboard alone.
11. Click `Remove` once and confirm nothing is deleted until the second,
    explicit confirmation.
12. Remove an account and confirm the remaining account's data is unchanged.
13. Confirm a note or tag cannot be saved anywhere in the live UI while
    selectors are unverified, and that the refusal states nothing was stored.

## Spam detection and qualification

14. Upgrade an existing installation rather than a clean one, and confirm notes
    and tags written before the upgrade are still present.
15. Confirm a data export reports schema version 2 and includes the message
    observation and sender override collections.
16. Confirm no message is cached anywhere while selectors are unverified, since
    nothing reads a page yet.

Live selector and action acceptance must wait for the evidence checklist in
`manual-verification-needed.md`. Never perform destructive action testing
automatically.
