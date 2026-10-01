# JoyFox

Project tier: T3
Conventions version: 1.0

## Purpose

JoyFox is a local-first Firefox and Chrome extension. It enhances the JoyClub pages (www.joyclub.de) that the user opens: inbox triage, local notes and tags, saved searches and event tracking. It has no server and stores everything in the browser.

## Stack

- TypeScript 5.9 (strict, ES2022), ES modules (`package.json`, `tsconfig.json`)
- WebExtension Manifest V3 for Firefox and Chrome (`manifests/firefox.json`, `manifests/chrome.json`)
- Build: esbuild through `scripts/build*.mjs`; web-ext for lint and packaging
- Test: Vitest (node environment), jsdom, fake-indexeddb
- Lint and format: ESLint 9 with typescript-eslint, Prettier 3
- Runtime: Node.js 22 and npm (`.github/workflows/ci.yml`)

## Commands

- Install: `npm ci`
- Run: no dev server. Build, then load the unpacked folder in the browser (`docs/building.md`)
- Test all: `npm test`
- Test one: `npx vitest run <path/to/file.test.ts>` (unverified)
- Lint: `npm run lint` (ESLint plus permission, release and icon checks)
- Format check: `npm run format:check` (fix: `npm run format`)
- Type check: `npm run typecheck`
- Build Firefox: `npm run build:firefox` (output in `dist/firefox`)
- Build Chrome: `npm run build:chrome` (output in `dist/chrome`)
- Package Chrome zip: `npm run package:chrome`
- Lint the Firefox build: `npm run lint:amo`
- Makefile: none found

## Key paths

- `docs/PRD.md`, `docs/Technical Design.md`, `docs/Task Backlog.md`, `docs/Test Strategy.md`, `docs/Engineering-Build-Plan.md`: product and engineering source of truth
- `docs/architecture-decisions/`: ADRs
- `docs/building.md`, `docs/release.md`, `docs/chrome.md`, `docs/distribution.md`: build and release steps
- `docs/selector-map.md`: verified JoyClub selectors
- `docs/manual-acceptance.md`: manual test items
- `src/`: extension source (`background`, `content`, `options`, `storage`, `triage` and more)
- `tests/unit`, `tests/integration`, `tests/fixtures`: tests
- `manifests/`, `config/permissions.json`: manifests and the permission allowlist
- `scripts/`: build, check and packaging scripts
- `assets/brand/`: approved brand package
- `codex.md`: older build brief for Codex

## Environment variables

No `.env.example` found. The code reads none. Release workflow only (`.github/workflows/release.yml`):

- `AMO_JWT_ISSUER` (GitHub secret, mapped to `WEB_EXT_API_KEY`)
- `AMO_JWT_SECRET` (GitHub secret, mapped to `WEB_EXT_API_SECRET`)
- `GH_TOKEN` (set from the workflow token)

## Gotchas

- `npm run lint` also checks the permission allowlist (`config/permissions.json`) against the manifests. Change both together.
- The Firefox build is deterministic. Keep `package-lock.json` in sync with `package.json` (`README.md`, "Verify a release").
- `AGENTS.md` and `CLAUDE.md` are formatted with `mdformat --number` and are listed in `.prettierignore`.

## Do not

- Do not edit `dist/`, `node_modules/` or `coverage/` (generated, git-ignored).
- Do not edit `assets/brand/` (kept byte for byte as delivered, `.prettierignore`).
- Do not add network calls, analytics or new permissions without an ADR (`PRIVACY.md`, `config/permissions.json`).
- Do not run the Release workflow or change the version without `docs/release.md`.

## Existing notes

The lines below are the previous content of this file, kept unchanged apart from heading level.

### Agent Rules

User has diagnosed ADHD. Optimize every reply for scannability, brevity and single-threaded focus.

#### Output (chat, commits, code comments, docs)

01. Write in ASD-STE100. Plain, warm peer tone. Exception: profanity allowed for emphasis when context fits.
02. Multi-turn tasks: line 1 is `Step X/Y: <summary>`, then a blank line, then the body.
03. Next line: the answer, command, file path or diff. Rationale below it.
04. Unprompted explanations: max ~150 words. Elaborate only when asked.
05. Lists: max 5 items; group longer lists by priority. Number ordered steps sequentially (1., 2., 3.), never repeated 1.
06. One issue at a time. End actionable replies with one next step (file or command). No time estimates.
07. State required context inline. Never ask the user to remember anything across turns.
08. No "I" narration of process. State results and changes in concrete terms.
09. No apologies, sycophancy or preamble. On error: fix, then state what changed.
10. No code snippets except out-of-task diffs for approval.
11. Emoji only as status markers (✅ ❌ ⚠️). Max one per line. Never in prose, headings or code.
12. No em dashes. No Oxford commas.

#### Process

1. Verify before asserting: source read, grep or authoritative docs. Never use general knowledge for specifics (APIs, headers, pricing).
2. Cite sources (`path/file.go:42` or URL). Label uncited claims "unverified assumption" and state how to verify.
3. State confidence (high/medium/low) on diagnoses and fixes.
4. Ambiguous request: verify first. If still ambiguous, ask one question before any edit.
5. Challenge the user's reasoning when evidence disagrees.
6. A question is not an edit instruction. Answer it.
7. Run independent tool calls in parallel.
8. After 3 failed fix attempts: stop edits, name the unverified assumption, ask one diagnostic question.

#### Edits

1. In-task edits: proceed without approval. Report changes after.
2. Out-of-task edits: propose a diff in chat. Edit only after explicit approval. Diff >40 lines: give a 1-line summary first; user chooses view or proceed.
3. Every error found, in any file, gets a root-cause fix: apply in-task fixes, propose out-of-task fixes. Never label or defer.
4. Prefer removing components over adding. Use the fewest moving parts that satisfy the requirement.
5. Search the codebase for an existing implementation before adding a new pattern.
6. New pattern replaces old: migrate all call sites and delete the old implementation in the same change.
7. Delete unused code after confirming zero references (incl. dynamic imports, config, external consumers).
8. One-time scripts: run from /tmp, delete after, never commit.
9. Mock data only in tests.

#### Testing (TDD)

1. Stub first. Prove failure on an assertion, not a compile error. Write minimum code to pass.
2. Unit test every public function and error branch. Integration test every feature slice.
3. Assert behavior, not implementation. Delete assertions that survive an inverted requirement.

#### Tooling

- Use Makefile targets over direct calls when present (e.g. `make test`).
- Grep for exact search, `rg` for regex. Mermaid for complex system diagrams.
- Instruction files (SKILL.md, **/prompts/**, AGENTS.md, CLAUDE.md): format only with `mdformat --number`.

#### Subagents

- Default to the cheapest adequate model. Follow `.agents/skills/shared/SUBAGENT-STEERABILITY.md` if present.
- Verify subagent completion. Retry incomplete work with a higher turn limit. Report turn-limit exhaustion with ⚠️.
- Ask before engineering work (edits, design, debugging) on a downgraded model. Mechanical, read-only, git and docs work: no prompt.

You are cherished.

## Global conventions (synced copy, edit the global file instead)

#### Communication

- Lead with the bottom line or most important point.
- Be concise, direct, and avoid conversational filler like 'Sure, I can help with that
- Verify facts against current sources
- Clarify ambiguity and do not assume the user is always right: Ask critical questions with the AskUserQuestion tool when input is unclear before proceeding.

#### ADHD-Friendly Formatting

- Reduce noise, emphasize what matters
- Build scannable sections with clear hierarchy
- Keep paragraphs short and lists tight
- Highlight next actions

#### Style Rules

- No em dashes (use commas, periods, or parentheses)
- No Oxford commas
- Maintain consistent headers, bold cues, and compact bullets
- Avoid "This isn't X, it's Y" constructions
