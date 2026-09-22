# Test Strategy

Companion to the Task Backlog. Defines test levels, fixture strategy and what is deliberately not automated.

## Test Levels

| Level | Covers | Runs against |
| --- | --- | --- |
| Unit | Rule engine, selector-fallback logic, the repository layer, the encryption module | Pure functions and mocked storage, no DOM and no network |
| Integration | Content script extraction, badge rendering, triage placement, the compose-box injector, the action executor's state machine | Captured DOM fixtures (see Fixture Strategy below), never the live site |
| Manual acceptance | The PRD's Section 21 criteria, end to end, per milestone | A real logged-in session, by hand |

Manual acceptance exists as its own level because some things cannot be safely automated at all: whether JoyClub's actual UI still matches what a fixture assumes, and whether the Quick Ignore and Delete sequence really completes against the live site, both require a human watching a real session, not a CI job driving one.

## Fixture Strategy

Fixtures are captured once during Foundation task F1, from a real logged-in session, then never touched by CI again, matching the PRD's own "no live scraping in CI" rule (Section 24.8).

One requirement that is easy to miss and expensive to fix later: a captured fixture must never contain another real JoyClub member's actual data, photo, name, or written preferences. This project's own privacy stance (PRD Section 13) governs the extension's runtime behavior, but a fixture file committed to a repository is a different exposure entirely, permanent and, once the project is open source, public. Every fixture is a synthetic reproduction of the DOM structure, with placeholder names, generated placeholder images, and invented preference text, captured by hand-editing a real page's structure rather than saving it as-is.

Fixtures are versioned alongside the selector map they support. When Foundation task F1 or a later selector-map update changes what a field's markup looks like, the fixture updates in the same change, so integration tests never silently test against a structure the real site no longer has.

## Security and Privacy Test Checklist

- Encryption round trip (task F4): a sync payload is ciphertext-only; the mock or real self-hosted endpoint never receives plaintext.
- Permission audit: a CI check diffs the manifest's declared permissions against the PRD's Section 15 table on every build, failing the build if a permission is added without a matching PRD update. This keeps the manifest and the PRD from drifting apart silently, the same class of gap this whole project already spent four rounds closing.
- Cross-account isolation (task M7's acceptance criterion): switching the active account never leaks one account's notes, tags or rules into the other's view.
- Export completeness (task M8's acceptance criterion): a full data export is checked item by item against every entity in the data model, not spot-checked.
- Network isolation: an integration test asserts zero network requests to any destination other than joyclub.de or joyce.app until sync has been explicitly configured, verifying the PRD's Section 21.1 criterion directly rather than trusting the code review alone.

## Regression Strategy and Traceability

The selector self-test described in the PRD's Section 16.6 does double duty: in production, it is the health check that triggers the graceful-degradation banner; in CI, the same code path validates that a fixture still matches the assumptions its selector map encodes. One mechanism, not two, so they cannot quietly drift apart from each other.

Every test traces back to a task ID and, through it, to a PRD acceptance criterion. A test's name or description states which task it verifies, for example "M9: partial failure produces a clear notice." A task without a corresponding test before it ships is the definition of not done, not a follow-up item.
