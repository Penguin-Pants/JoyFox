# JoyClub Enhancement Extension

## Engineering Build Plan

## 1. Engineering objective

Build a Firefox desktop extension that enhances the existing JoyClub experience for a logged-in user.

The extension must:

* operate as a progressive enhancement of JoyClub
* remain local-first
* avoid undocumented JoyClub APIs
* avoid background scraping
* avoid bulk collection
* never bypass authentication, verification, payment or moderation controls
* never send a message automatically
* keep sensitive data local unless the user explicitly enables encrypted sync
* fail safely when JoyClub markup changes
* keep Firefox as the first supported browser
* preserve a path to later Chromium support

The initial engineering target is the **MVP defined in PRD Section 19**, not the complete V1 roadmap.

---

# 2. Fixed architecture decisions

These decisions should not be reopened during normal implementation unless actual browser behavior proves one technically impossible.

## 2.1 Extension model

Target:

* Firefox desktop
* Manifest V3
* non-persistent Firefox background event page
* content scripts on approved JoyClub origins
* options page
* toolbar popup
* IndexedDB
* `storage.local` for small configuration
* `storage.session` for temporary action state where required
* no remote executable code

All long-lived state must be persisted. Runtime module variables must never be treated as durable state.

---

## 2.2 DOM-only JoyClub integration

The extension may process only information that:

1. JoyClub already rendered for the logged-in user
2. exists in a page the user actually loaded
3. exists in a previously stored local snapshot produced from such a page

The extension must not:

* independently fetch JoyClub profiles
* call undocumented JoyClub APIs
* paginate automatically through private endpoints
* simulate invisible browsing
* crawl user profiles
* use hidden browser tabs as a scraping system
* retrieve data the user has not normally received

This constraint applies even when doing so would make Sender Qualification more complete.

### Important consequence

A sender may not have enough known profile information to calculate all qualification criteria.

The system must represent each criterion as:

* `pass`
* `fail`
* `unknown`

An unavailable criterion must never silently become `fail`.

The overall result must preserve uncertainty.

For example:

```text
Verification: PASS
Photo count: UNKNOWN
Account age: UNKNOWN
Profile completeness: PASS
```

The user may configure how `unknown` affects triage, but the default should be conservative:

**Unknown data produces Needs Review rather than automatic Quarantine unless another explicit rule independently causes Quarantine.**

This prevents missing profile data from being interpreted as negative evidence.

---

## 2.3 Storage boundary

No UI component, content script or action module may directly access persistent browser storage.

Use repositories.

Examples:

```text
ExtensionAccountRepository
JoyClubMemberRepository
ProfileSnapshotRepository
UserNoteRepository
UserTagRepository
TrustSignalRepository
ContactRuleRepository
ConversationClassificationRepository
SavedSearchRepository
EventMetadataRepository
SpendLogRepository
SyncConfigRepository
ExtensionPreferenceRepository
MessageTemplateRepository
SpamPhraseRepository
ActionLogRepository
```

All repositories expose a consistent basic interface:

```ts
get(...)
list(...)
put(...)
delete(...)
```

Additional query helpers may be added when justified.

Repositories own:

* persistence
* indexes
* schema versions
* migrations
* account scoping
* validation
* retention behavior

Other modules must not import IndexedDB directly.

---

## 2.4 Account scope

Every persisted user record must resolve through an `ExtensionAccount`.

No record may rely on the currently logged-in browser session as its only ownership information.

Primary storage keys should include account identity where appropriate.

Example:

```text
(accountId, memberId)
(accountId, conversationId)
(accountId, ruleId)
```

Cross-account leakage is a release-blocking defect.

---

## 2.5 Typed cross-context messages

Every message between content scripts, background, options and popup uses one message envelope.

```ts
interface ExtensionMessage<T = unknown> {
  type: string;
  requestId: string;
  payload: T;
}
```

Responses preserve `requestId`.

Do not create ad hoc `runtime.sendMessage()` payload formats.

Provide typed request and response definitions.

Long-running operations use a port when progress must stream to the caller.

---

# 3. Repository structure

Use a structure similar to:

```text
/
├─ package.json
├─ tsconfig.json
├─ eslint.config.*
├─ vite.config.* or selected extension build configuration
├─ manifests/
│  ├─ firefox.json
│  └─ chromium.json            # may remain non-shipping initially
│
├─ src/
│  ├─ background/
│  │  ├─ index.ts
│  │  ├─ router.ts
│  │  ├─ handlers/
│  │  └─ actions/
│  │
│  ├─ content/
│  │  ├─ bootstrap.ts
│  │  ├─ pageDetector.ts
│  │  ├─ navigationObserver.ts
│  │  ├─ inbox/
│  │  ├─ conversation/
│  │  ├─ profile/
│  │  ├─ search/
│  │  ├─ event/
│  │  └─ compose/
│  │
│  ├─ selectors/
│  │  ├─ types.ts
│  │  ├─ index.ts
│  │  ├─ inbox.ts
│  │  ├─ conversation.ts
│  │  ├─ profile.ts
│  │  ├─ search.ts
│  │  └─ event.ts
│  │
│  ├─ extraction/
│  │  ├─ result.ts
│  │  ├─ profileExtractor.ts
│  │  ├─ messageExtractor.ts
│  │  └─ selfTest.ts
│  │
│  ├─ domain/
│  │  ├─ accounts/
│  │  ├─ scoring/
│  │  ├─ triage/
│  │  ├─ rules/
│  │  ├─ spam/
│  │  ├─ trust/
│  │  └─ templates/
│  │
│  ├─ storage/
│  │  ├─ database.ts
│  │  ├─ migrations/
│  │  └─ repositories/
│  │
│  ├─ crypto/
│  │  └─ encryption.ts
│  │
│  ├─ ui/
│  │  ├─ shared/
│  │  ├─ popup/
│  │  └─ options/
│  │
│  ├─ messaging/
│  │  ├─ envelope.ts
│  │  ├─ types.ts
│  │  └─ client.ts
│  │
│  └─ shared/
│     ├─ ids.ts
│     ├─ errors.ts
│     ├─ validation.ts
│     └─ constants.ts
│
├─ tests/
│  ├─ unit/
│  ├─ integration/
│  ├─ fixtures/
│  │  ├─ inbox/
│  │  ├─ conversation/
│  │  ├─ profile/
│  │  ├─ search/
│  │  └─ event/
│  └─ helpers/
│
├─ docs/
│  ├─ selector-map.md
│  ├─ manual-acceptance.md
│  ├─ permissions.md
│  ├─ data-model.md
│  └─ known-limitations.md
│
└─ scripts/
   ├─ build-firefox.*
   ├─ check-permissions.*
   └─ package-firefox.*
```

Exact build tooling may change after evaluating current Firefox extension tooling.

Keep domain logic independent of browser APIs wherever possible.

---

# 4. Core domain types

Define domain types before building UI.

At minimum:

```ts
type CriterionState = "pass" | "fail" | "unknown";

type TriagePlacement =
  | "qualified"
  | "needs-review"
  | "quarantined";

interface CriterionResult {
  key: string;
  state: CriterionState;
  reason?: string;
  observedAt?: number;
}

interface QualificationResult {
  memberId: string;
  criteria: CriterionResult[];
  placementRecommendation: TriagePlacement;
  confidence: "complete" | "partial";
}

interface ExtractionResult<T> {
  value?: T;
  status: "found" | "missing" | "invalid";
  source?: string;
}
```

Do not use `null` or `false` to represent all three cases:

* data absent
* data extracted but malformed
* negative criterion

These states have different meanings.

---

# 5. Selector architecture

## 5.1 No selectors may be invented

Actual JoyClub selectors are not defined in the source documents.

Do not guess them.

Until manual verification supplies a selector:

```ts
selector: null
status: "unverified"
```

is preferable to fabricated code.

---

## 5.2 Selector map

Every JoyClub DOM dependency lives in the selector layer.

Feature modules must ask extraction modules for data.

They must not use arbitrary query selectors directly.

Conceptually:

```ts
selectors.profile.memberId
selectors.profile.verification
selectors.profile.joinDate
selectors.profile.photoCount
selectors.profile.profileText
```

Each item can contain:

```ts
{
  primary,
  fallbacks,
  validation,
  version
}
```

---

## 5.3 Extraction results

Extraction must fail explicitly.

Bad:

```ts
return false;
```

Good:

```ts
return {
  status: "missing"
};
```

A failed extraction must never generate a false qualification result.

---

## 5.4 Selector self-test

Build one shared self-test system used in:

* integration tests
* development
* runtime health checking

If a required selector stops matching, the feature becomes unavailable.

It must not continue with stale assumptions.

---

## 5.5 Selector updates

Treat selectors as part of the extension release.

Do not implement a remote selector-update mechanism during Foundation or MVP.

The PRD suggests separate selector-map versioning, but the safer engineering interpretation is:

* selector versions are tracked independently inside the repository
* selector changes are bundled into a signed extension release

A future remote configuration mechanism must receive a separate Mozilla policy review before implementation.

---

# 6. Foundation phase

No user-facing MVP feature should begin until the relevant Foundation dependency exists.

Some independent Foundation tasks may run in parallel.

---

## F0: Repository bootstrap

### Deliverables

* TypeScript project
* linting
* formatting
* unit test runner
* integration test environment with DOM support
* Firefox development build
* deterministic production build
* initial CI
* extension version source of truth

### Definition of done

```text
npm install
npm test
npm run lint
npm run build:firefox
```

or equivalent selected commands all pass from a clean checkout.

No JoyClub functionality is required yet.

---

## F1: Live DOM verification

This is a human-assisted task.

Inspect real logged-in JoyClub pages for:

* inbox
* open conversation
* profile
* search
* event
* event calendar if distinct
* message composer
* event-related ClubMail composer if available

Document:

* reliable page identity signal
* member ID source
* conversation/message ID source
* sender name
* profile type
* verification signal
* join date
* visible photo count
* profile text
* preference tags
* ignore control
* delete control
* confirmation UI
* compose field
* event ID
* attendee ID links where visible

For each field record:

```text
page
field
primary selector
fallback selector
expected cardinality
validation rule
known missing state
notes
```

### Privacy rule

Never commit actual member data.

Synthetic fixtures must be manually sanitized before they enter the repository.

---

## F2: Minimal content-script POC

Implement:

* page detection
* selector abstraction
* sender-name extraction
* extraction result type
* development diagnostic output

Test against at least 10 manual inbox loads.

No production badge UI yet.

---

## F3: Background lifecycle POC

Verify non-persistent background behavior.

Implement a test counter or equivalent persisted state.

Confirm:

1. background receives an event
2. state is persisted
3. background is stopped
4. background restarts
5. persisted state is restored

No production logic should depend on module-scope state.

---

## F4: Encryption POC

Build an isolated WebCrypto experiment.

Requirements:

* encryption happens before network serialization
* endpoint sees ciphertext only
* decrypt restores exact plaintext
* wrong passphrase fails cleanly
* salt and KDF parameters are represented explicitly
* passphrase is not persisted

Do not build sync itself.

Deliver a short Architecture Decision Record documenting the selected primitives.

---

## F5: Messaging infrastructure

Implement:

* typed envelope
* request ID generation
* background router
* error envelope
* typed request helpers
* port abstraction for long operations

Initial supported diagnostic request:

```text
diagnostic.ping
```

Then add production message contracts as features require them.

---

## F6: Data layer

Implement the complete MVP-compatible schema.

Include all PRD entities even where some V1 repositories initially have no caller, if doing so avoids incompatible schema changes later.

Required engineering features:

* database version
* migrations
* account scope
* indexes
* repository interfaces
* retention hooks
* export serialization
* deletion
* validation

Unit-test every repository.

---

## F7: Quick Ignore and Delete feasibility spike

Determine, from the real JoyClub UI:

### Path A

Ignore is available directly from conversation.

### Path B

Navigation to sender profile is required.

For both paths document:

* required user-visible steps
* required selectors
* confirmation steps
* how success is verified
* how delete is verified
* what happens if Ignore succeeds but Delete fails
* what happens if the tab closes
* what happens if navigation fails

No destructive automated acceptance run should happen without explicit manual control.

---

## F8: Firefox distribution verification

Verify current Mozilla requirements.

Document:

* temporary development installation
* self-distributed signed build
* unlisted signing
* AMO listed distribution
* source-code submission requirements if applicable
* manifest restrictions relevant to this project

Do not rely on the PRD's 2026 browser-policy summary without rechecking current Mozilla documentation.

---

## F9: Qualification-data availability spike

This is an added Foundation task required by the source design.

Determine what sender attributes are actually available from:

1. inbox row
2. open conversation
3. previously cached ProfileSnapshot
4. currently open sender profile

Create a matrix.

Example:

| Criterion          | Inbox | Conversation | Cached Profile | Open Profile |
| ------------------ | ----- | ------------ | -------------- | ------------ |
| profile type       | ?     | ?            | yes            | yes          |
| verification       | ?     | ?            | yes            | yes          |
| photo count        | ?     | ?            | yes            | yes          |
| account age        | ?     | ?            | yes            | yes          |
| profile word count | no    | no           | yes            | yes          |

### Decision required from findings

Define the exact MVP scoring rule when profile data has never been observed.

Default implementation:

```text
missing information = unknown
unknown does not equal fail
partial result = Needs Review unless another explicit failure warrants Quarantine
```

This decision must be tested before M1 begins.

---

# 7. MVP implementation sequence

Recommended dependency path:

```text
F0
├─ F1 ─ F2 ─ F5 ─ F6
│  ├─ F7
│  └─ F9
├─ F3
├─ F4
└─ F8

F6 + F9
├─ M1
│  ├─ M2
│  ├─ M4
│  └─ M6
├─ M3
├─ M5 ─ M6
├─ M7
├─ M8
└─ M10

F5 + F7
└─ M9
```

M9 does not depend on M2.

---

# 8. M1: Sender Qualification Score

## Inputs

Use only:

* fields rendered in the current surface
* existing ProfileSnapshot data
* local TrustSignal data where required

Do not navigate automatically to populate missing information.

## Pipeline

```text
resolve member
→ collect observed profile facts
→ merge with cached ProfileSnapshot
→ evaluate criteria
→ classify certainty
→ store result if needed
→ render badge
```

## Required states

Each criterion:

```text
pass
fail
unknown
```

Overall display:

```text
Qualified
Partial information
Does not meet rule
```

Do not present a numerical percentage unless the scoring formula is explicitly defined and stable.

## Acceptance

Manual comparison against the same visible source data should match at least 95 percent over the specified trial.

Extraction failures must appear as Unknown.

---

# 9. M2: Inbox Triage and Quarantine

Implement local view groups:

* Qualified
* Needs Review
* Quarantined

This is DOM reordering only.

Never:

* delete
* archive
* send
* block
* change JoyClub data

Requirements:

* original item remains recoverable
* changing a classification updates placement immediately
* pagination or dynamically loaded rows are supported
* duplicate enhancement UI is not injected after mutations
* extension UI can be disabled without damaging JoyClub's original list

---

# 10. M3: Template spam detector

MVP classifier is deterministic and local.

Start with:

* normalization
* whitespace normalization
* punctuation normalization where useful
* configurable minimum message length
* similarity against previous local messages
* exact or fuzzy comparison against SpamPhrase records

Do not add AI.

### Required properties

* explain why something was flagged
* one-click "not spam"
* sender-specific override persists
* false-positive corrections influence later classification only in transparent ways

Keep the similarity engine behind an interface so a future classifier can replace it without rewriting triage.

---

# 11. M4: Global Contact Rule

MVP supports one global rule.

Do not build nested per-audience rules yet.

Represent rules in the final V1-compatible schema so migration is unnecessary.

MVP UI should allow selected criteria such as:

* verification
* minimum photos
* minimum account age
* minimum completeness
* spam status

Each condition must support Unknown explicitly.

Example:

```text
Verification = required
Minimum photos = 3
Unknown photo count = Needs Review
```

Rule evaluation must be a pure function.

It receives data and returns:

```ts
{
  placement,
  reasons,
  evaluatedConditions
}
```

It must not access DOM or storage itself.

---

# 12. M5: Profile Notes and Tags

Requirements:

* note keyed to account plus stable member identity
* tags keyed the same way
* visible on profile
* reusable later on inbox, search and events
* all editing stays local
* content is treated as sensitive

Before attaching data to a member, verify that a stable member ID is available.

Never use display name alone as identity.

If only an unstable identifier exists, disable persistence until identity can be resolved.

---

# 13. M6: Basic Local Trust Score

Keep qualification and trust conceptually separate.

### Qualification

Answers:

> Does this member satisfy configured rules?

### Trust

Answers:

> What has this extension user personally observed about this member?

Initial inputs may include:

* qualification information
* user-created trust outcomes
* spam status
* previous positive or negative interaction markers

Do not claim the score represents community reputation.

Every score must have an expandable explanation.

Avoid opaque machine-learning logic.

---

# 14. M7: Multi-account isolation

Implement before extensive dogfooding.

Requirements:

* reliable account identity detection
* explicit active account
* all repositories account-scoped
* UI indicates which extension account is active where ambiguity is possible

Test:

* account A data exists
* switch to account B
* no A notes appear
* create B data
* switch to A
* original A data remains unchanged

This is a security test, not only a functional test.

---

# 15. M8: Data inspector, export and delete

Provide:

* account selector
* entity counts
* per-entity inspection
* delete individual record
* delete entity class
* delete account data
* delete all extension data
* JSON export

Export must cover every persisted entity.

The schema version must be included in export metadata.

Never include a sync passphrase because it is never stored.

---

# 16. M9: Quick Ignore and Delete

Treat this as a high-risk state machine.

Do not implement it as arbitrary chained DOM clicks.

Use an explicit operation:

```text
Started
→ IgnoreRequested
→ IgnoreConfirmed
→ DeleteRequested
→ DeleteConfirmed
→ Completed
```

Failures can occur between any states.

Persist every transition immediately to ActionLog.

## Critical engineering rule

This operation is not transactionally reversible.

If Ignore succeeds and Delete fails, the extension cannot truthfully promise that "nothing happened."

Therefore the behavior must be:

1. preserve the successful step
2. stop immediately
3. report exactly which step succeeded
4. report exactly which step failed
5. give the user the next manual action

Do not attempt fake rollback.

### Same-tab navigation

If navigation destroys the content script:

1. background stores pending action in `storage.session`
2. navigation occurs
3. new content script detects pending action
4. target identity is revalidated
5. operation resumes only after identity matches
6. progress returns through the action channel

### Safety invariant

Before every destructive click:

```text
expected member ID == current member ID
expected message ID == current message ID
```

where the relevant identifier is available.

If identity cannot be proven, abort.

---

# 17. M10: Message Templates

Implement:

* create
* edit
* delete
* organize
* insert

The extension may fill a compose field.

It must never click Send.

Insertion must work through the page's normal text field behavior so JoyClub detects the change.

After insertion:

* user can edit
* user must manually send

Do not add template variables until plain insertion is stable.

---

# 18. UI implementation rules

Injected UI must:

* use stable extension-owned class names
* avoid modifying JoyClub classes
* avoid replacing native JoyClub components
* clean itself up if a page changes
* prevent duplicate injection
* remain usable at browser zoom levels
* support keyboard navigation
* provide accessible labels
* never use color as the only distinction between Pass, Fail and Unknown

Use a small design-token layer rather than copying JoyClub CSS values across components.

---

# 19. Navigation handling

Implement navigation detection through a common coordinator.

Inputs can include:

* initial content-script load
* `MutationObserver`
* history-state changes
* `webNavigation`

Do not allow individual features to independently invent navigation listeners.

The coordinator should emit something similar to:

```ts
{
  pageType,
  url,
  reason
}
```

Feature modules subscribe to those events.

---

# 20. Performance requirements

Avoid whole-document rescans.

For mutation handling:

* debounce
* inspect mutation targets
* rescan only relevant containers
* cache completed member extraction
* avoid scoring the same row repeatedly
* schedule expensive work away from direct input events

Develop a simple development performance log.

Track:

* page detection duration
* extraction duration
* triage duration
* number of DOM nodes processed
* number of duplicate runs avoided

No analytics leave the extension.

---

# 21. Error handling

Use typed errors.

Suggested categories:

```text
SelectorUnavailable
ExtractionInvalid
IdentityMismatch
StorageError
RuleEvaluationError
ActionStepFailed
NavigationTimeout
UnsupportedPage
```

Expected site changes must not generate unhandled exceptions.

User-facing error text should explain:

* what stopped working
* what did not happen
* whether any JoyClub action had already completed

---

# 22. Testing architecture

## Unit

Test pure modules:

* rule engine
* scoring
* spam similarity
* trust calculation
* selector fallback selection
* validation
* repositories with mocked storage
* encryption

No network.

No real JoyClub DOM.

---

## Integration

Test against synthetic fixtures:

* inbox extraction
* conversation extraction
* profile extraction
* page detection
* selector fallbacks
* badge injection
* duplicate-injection prevention
* triage placement
* compose-box insertion
* action state machine
* account isolation

Fixtures must contain no real JoyClub member data.

---

## Manual acceptance

Use a real logged-in JoyClub account only for:

* live selector verification
* real UI compatibility
* Quick Ignore and Delete
* performance sanity
* final PRD acceptance criteria

CI must never log into JoyClub.

---

# 23. Mandatory regression checks

Every build must verify:

### Permission drift

Manifest permissions match the approved permission inventory.

Adding a permission should fail CI until the permission documentation is deliberately updated.

### Network isolation

Before sync exists:

```text
extension-originated remote network requests = 0
```

Normal JoyClub page traffic is JoyClub's own traffic, not extension traffic.

### Account isolation

Automated test.

### Export completeness

Automated test against every persistent repository.

### Selector fixtures

Every selector-map change requires its synthetic fixture update in the same change.

---

# 24. Manual test matrix for M9

Define this before calling M9 complete.

At minimum test:

1. Ignore and Delete both succeed
2. Ignore control missing
3. Ignore confirmation missing
4. Ignore succeeds, Delete control missing
5. Delete confirmation fails
6. navigation interrupted
7. tab closed during action
8. member identity mismatch
9. message identity mismatch
10. page markup changes between steps
11. operation restarted after background wake
12. user activates another account during the sequence

Do not define success as "100 percent" without defining this matrix.

Success means every case produces the expected final state and the expected ActionLog.

---

# 25. Privacy requirements

Sensitive local data includes:

* profile snapshots
* private notes
* tags
* message cache
* sexual preference information
* classification history
* ActionLog

Rules:

* no telemetry by default
* no crash service by default
* no third-party analytics SDK
* no remote fonts
* no remote scripts
* no cloud AI in MVP
* no plaintext sync
* no real member data in repository fixtures
* deletion must actually delete persisted extension data

---

# 26. Logging

Development logs must avoid sensitive payloads.

Bad:

```text
Scored member MaxMustermann: profile says ...
```

Good:

```text
score.complete memberId=<hashed-or-internal-id> criteria=5 unknown=1
```

Production logging should be minimal.

Do not log message bodies.

---

# 27. Build milestones

## Milestone A: Engineering foundation

Complete:

* F0
* F2
* F3
* F4
* F5
* F6

F1, F7 and F9 require manual site inspection and may run alongside the software foundation.

Deliverable:

**Installable extension shell with tested messaging, persistence and fixture infrastructure.**

---

## Milestone B: Read-only intelligence

Complete:

* M1
* M3
* M5
* M7

Deliverable:

**The extension can understand known senders, detect template-like messages, store private notes and isolate multiple accounts.**

No JoyClub write automation yet.

---

## Milestone C: Triage system

Complete:

* M2
* M4
* M6

Deliverable:

**Incoming messages can be explained and locally sorted into Qualified, Needs Review and Quarantined.**

This is the first point at which the central product value is fully testable.

---

## Milestone D: User control and data management

Complete:

* M8
* M10

Deliverable:

**The user can inspect all stored data, export it, remove it and use safe composition assistance.**

---

## Milestone E: Write-action experiment

Complete M9 separately.

Do not let M9 block testing of the rest of MVP.

Deliverable:

**Quick Ignore and Delete works only after the action state machine and live DOM path are proven safe enough for personal use.**

If M9 remains unreliable, ship personal MVP without it and keep it behind an experimental feature flag.

---

# 28. MVP release gate

The personal-use MVP may be called complete only when:

* cold installation works
* onboarding gets the extension into a usable state
* triage operates without hidden network access
* missing sender information is shown as Unknown
* every triage decision can be explained
* classification overrides persist
* profile notes survive restart
* accounts remain isolated
* data export covers all stored entities
* complete data deletion works
* no automated Send action exists
* synthetic-fixture tests pass
* live manual selector acceptance passes
* unsupported markup causes graceful degradation
* permissions match documentation

M9 is complete only under its separate destructive-action test matrix.

---

# 29. V1 preparation

Do not implement these during MVP unless required by an MVP abstraction:

* per-audience contact rules
* Compatibility Overlay
* Saved Searches
* Conversation History Search
* Personal Event Tracker
* encrypted self-hosted sync
* weekly digest
* context menu actions
* local spend tracking
* AI classification
* Chromium release

However, Foundation and MVP architecture must not make these unnecessarily difficult.

---

# 30. Engineering decisions that must remain open

Do not silently invent answers to:

* whether JoyClub profile IDs are permanent
* exact live selectors
* exact JoyClub navigation behavior
* which member attributes appear in inbox without opening a profile
* public-release Terms of Service interpretation
* final sync transport
* AMO signing requirements
* exact acceptable triage false-positive threshold

Record findings as Architecture Decision Records or engineering notes when they become known.

---

# 31. Definition of done for every task

A task is not complete until all applicable items exist:

1. implementation
2. unit tests
3. integration tests
4. documented assumptions
5. acceptance criterion verified
6. no TypeScript errors
7. lint clean
8. no unexplained new manifest permission
9. no real JoyClub member data added to repository
10. documentation updated when architecture or selectors changed

A follow-up test is not equivalent to a complete task.

---

# 32. Preferred implementation order for Codex

Codex should implement in small, reviewable increments.

Recommended order:

```text
1. Inspect repository and source docs
2. Bootstrap project if needed
3. Define domain types
4. Build typed messaging
5. Build database and repositories
6. Build synthetic fixture framework
7. Build selector abstraction with unverified placeholders
8. Build page detection framework
9. Add real selectors only from verified user-provided observations
10. Implement M5 and M7 first as low-risk persistence validation
11. Implement qualification engine
12. Implement M1
13. Implement spam detector
14. Implement M3
15. Implement triage
16. Implement M2 and M4
17. Implement trust score M6
18. Implement inspector M8
19. Implement templates M10
20. Implement M9 last
```

The destructive JoyClub action is intentionally last.

---

# 33. Required engineering documentation

Maintain:

```text
docs/selector-map.md
docs/data-model.md
docs/permissions.md
docs/manual-acceptance.md
docs/privacy-model.md
docs/known-limitations.md
docs/architecture-decisions/
```

Especially document every place where runtime behavior depends on JoyClub markup.

---

# 34. Final engineering principle

When forced to choose between:

```text
silently guessing
```

and:

```text
showing Unknown and disabling a feature
```

choose Unknown.

Correct degradation is more important than feature coverage.
