# 0018: Publish to the Chrome Web Store from CI

## Status

Accepted (project owner, 2026-11-08).

## Context

The Firefox build is submitted to AMO by the Release workflow. The Chrome build
was uploaded to the Chrome Web Store by hand (`docs/chrome.md`). The extension
itself is unchanged by this decision: it makes no new network call and asks for
no new permission (`PRIVACY.md`, `config/permissions.json`).

## Decision

A separate workflow, `.github/workflows/chrome-publish.yml`, runs by hand
(`workflow_dispatch`) on `main` after the Release workflow. It builds the Chrome
zip, uploads it with the Chrome Web Store API v2 and submits it for review. It
is separate so that a Chrome failure never forces a re-run of the Release
workflow, which AMO refuses for a version it already has.

Authentication uses a Google Cloud service account. The workflow exchanges the
JSON key for a short-lived access token with scope
`https://www.googleapis.com/auth/chromewebstore` (`google-github-actions/auth`).

## Consequences

- Three GitHub Actions secrets: `CWS_SERVICE_ACCOUNT_KEY`, `CWS_PUBLISHER_ID`,
  `CWS_EXTENSION_ID`. Never put them in the repository.
- One service account per publisher (Chrome Web Store limit).
- The first upload and any visibility change stay manual in the dashboard.
- The Store reviews the submission. The workflow reports the submit, not the
  approval.
