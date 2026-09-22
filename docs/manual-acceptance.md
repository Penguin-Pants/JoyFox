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

Live selector and action acceptance must wait for the evidence checklist in
`manual-verification-needed.md`. Never perform destructive action testing
automatically.
