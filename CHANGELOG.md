# Changelog

**English** · [فارسی](CHANGELOG.fa.md)

Format based on [Keep a Changelog](https://keepachangelog.com/), versioning follows
[SemVer](https://semver.org/).

## [1.5.2] — 2026-10-26

AI source settings can approve up to ten published store phone numbers. Exact digit matches
survive source and answer filtering while visitor questions/history, other phone numbers and
credentials remain redacted. This fixes public contact questions being handed off to a human.
Existing stores default to no approved numbers; no database migration is required.

## [1.5.1] — 2026-10-26

Viewing a conversation no longer assigns it to an operator and silently stops AI replies.
Chat controls show who is answering, with explicit human takeover and return to AI. Sending
an operator reply takes ownership and pauses AI before publishing the message. Returning to
AI requires an enabled assistant and the assigned operator or a fresh administrator role.
Existing conversations and human handoffs are retained; no schema change is needed.
Standalone greetings use the configured welcome message without a model call or human handoff.

## [1.5.0] — 2026-10-25

Operators can switch stores, follow visitor page context and start conversations directly.
Knowledge and AI controls now have separate settings tabs and clearer processing states.

### Added

- Independent in-memory store sessions, a store selector, complete unread totals and store-named background notifications. Logout can remove one account or all accounts.
- Current and conversation-entry pages in visitor cards and chat details, operator-started conversations, SPA page tracking and bounded visible-tab activity updates.
- Markdown import by file picker or drag and drop, keyword editing, source activation, download, processing retry and per-document citation counts.
- A store guardrail switch for blocked topics, retrieval similarity and confidence thresholds. Tenant isolation, safe sources, sensitive-output filtering and resource limits remain independent.
- A compact chat layout with multiline replies, delivery acknowledgements, preserved text on send failure, timestamps and mobile visitor details.
- A rounded widget with a compact composer, smooth answer entry and queue-driven AI status animations that respect reduced motion.
- Assistant and operator image uploads with a 10 MiB limit, adjustable circular crop and small server-validated PNG avatars.

### Fixed

- Late views and requests retaining the previous store's client or conversation draft.
- Stale embedding jobs replacing newer document revisions, and disabled knowledge contributing a late answer or duplicate usage count.
- The existing source-type constraint rejecting Markdown, and provider compatibility when the SDK assumes base64 embedding responses.

### Upgrade

Three forward migrations add nullable conversation entry context, knowledge controls and bounded avatar storage. Existing messages, image URLs and source content are retained; historical entry pages and citation counts are not reconstructed. Refresh the dashboard and sign in to each store again. See [the workspace guide](docs/operator-workspace.md).

## [1.4.0] — 2026-10-24

Mira now provides grounded AI support, usage and billing reports, and lighter installation options. All shipped self-hosted features remain free of Mira subscriptions and activation keys; hosting and AI provider charges are separate.

### Added

- Persian chat with thinking states, suggested questions, verified product cards, source links, mobile layouts and durable human handoff.
- Site-specific assistant identity, knowledge sources and guardrails. Store names and retrieved data stay scoped to each site.
- Admin usage reports with token totals and per-visitor averages, plus AvalAI credit, model prices, transaction-cost reconciliation and a link to the provider's payment page.
- A four-service Docker Lite profile, a compiled hosting archive with an offline configuration helper, and direct chat and embed links in installation settings.
- Admin resource diagnostics, bounded database pools and shared AI task concurrency. Production images use Node 22, omit development tools and run without root.
- Copyright attribution to hami9 and https://hami9.ir in NOTICE and distribution files. The future private sales/subscription panel is outside this repository.

### Fixed

- Paused conversations, outside-hours behavior, late AI replies and provider configuration defaults.
- Same-origin polling when WebSocket is unavailable, and incomplete settings responses after saving AI policy.
- Local `.env.*` files entering installation payloads, and the CLI evaluating dotenv files as shell scripts.

### Validation and limits

Unit and real-database tests cover tenant isolation, usage, permissions and resource controls. Live Chromium scenarios exercise visitor/operator chat, queued AI, two independent stores and the compiled hosting launcher, including a host that rejects WebSocket upgrades. The WordPress integration was installed on a disposable WooCommerce fixture, and DeepSeek through AvalAI was tested with real usage and cost reconciliation.

PHP-only hosting can embed Mira but cannot run its backend. Hosting the backend requires compatible Node support, PostgreSQL with pgvector, Redis and a persistent worker. Real cPanel/DirectAdmin deployment, production TLS, a complete Debian installation cycle and Luna remain unverified. See [the hosting guide](package/HOSTING.md).

## [1.3.0] — 2026-07-28

Phase 0's test harness is now complete: the project has a **real end-to-end browser test**
that boots the actual API and drives a live visitor↔operator conversation. Plus the
security scanning the roadmap asks for in Phase 1.

### Added

- **Real E2E test** (`tests/e2e/`, Playwright) — the last unchecked item of Phase 0 task 4
  - Visitor opens the widget on the demo page → sends a message → the operator sees the
    conversation appear live → replies → **the reply reaches the visitor without a reload**,
    proving the whole Socket.io path
  - A second test sends `<script>` and `<img onerror>` through the widget and asserts the
    operator's DOM is clean and nothing executed — rule 5 (`sanitizeMessageContent`)
  - Runs in CI in a new `E2E` job: Postgres + Redis service containers, migrations, seed,
    the API booted with the same command the Dockerfile uses, and the dashboard bundle served
- **CodeQL SAST** (`codeql.yml`) — TypeScript and PHP, on every PR and push plus a weekly run
- **Dependency review** (`dependency-review.yml`) — blocks PRs adding vulnerable or
  licence-incompatible dependencies
- **12 unit tests for the security headers middleware** — the only significant piece of
  security logic that had no coverage. Guards real bug #5 (`X-Powered-By` leaking on static
  files) and real bug #6 (CSP applied to JSON but not HTML, including the query-string case
  that caused it)

### Changed

- `AGENTS.md` §9 now describes all three test levels honestly, and states plainly what is
  still uncovered: the AI/worker path, the WordPress plugin, and the settings/reports pages

### Notes

Two things were learned by running the stack rather than reading it, and are worth knowing:
reloading the dashboard logs the operator out (tokens are held in memory, by design), and
the login endpoint is throttled to 10 requests/minute — running the E2E suite repeatedly
back to back trips that limit, which is the rate limiter working correctly rather than a
flaky test.

## [1.2.0] — 2026-07-27

Phase 0 of the roadmap, as far as it can go without hardware: the project has an automated
test suite for the first time, and the roadmap itself now lives in the repository.

### Added

- **Test suite** (`npm test`) — the project had none before this release
  - 55 unit tests over the pure logic that has historically broken: input sanitization,
    keyword splitting (both `,` and the Persian `،`), the AI confidence parse and its
    fail-safe hand-off, permission resolution, business hours in the Tehran timezone, and
    user-agent parsing
  - 27 integration tests against **real Postgres + Redis** service containers in CI —
    migrations, schema shape, multi-tenant `siteId` isolation, and message idempotency.
    They self-skip without `TEST_DATABASE_URL`, so `npm test` stays green on any machine
  - A `Tests` job in CI, running both as a required check
- [`ROADMAP.md`](ROADMAP.md) / [`ROADMAP.fa.md`](ROADMAP.fa.md) — the seven-phase enterprise
  roadmap, checked line by line against the code before being committed
- [`docs/PHASE0-RUNBOOK.md`](docs/PHASE0-RUNBOOK.md) — step-by-step instructions for the
  three Phase 0 tasks that need real hardware (WordPress install, Debian deployment,
  production dashboard image), each with pass criteria

### Changed

- `parseModelOutput` moved out of `bot-reply.ts` into `apps/worker/src/ai/parse-model-output.ts`
  and the automation keyword splitter into `splitKeywords()` in `packages/shared-types` —
  both were unreachable from a test before. Behaviour is unchanged
- `AGENTS.md` §9 now describes the test suite honestly: unit and integration coverage
  exists, browser E2E does not

### Notes

Three claims in the roadmap draft did not survive checking against the code and were
corrected before commit: the seed script contains no placeholder knowledge-base document or
`offlineMessage` (those are rows in a local dev database, not code), a non-default admin
password is already enforced, and the phase tags were realigned to the real version line.
The dead `AI_MAX_TOKENS_PER_CONVERSATION` config was confirmed real and stays scheduled for
Phase 2.

## [1.1.0] — 2026-07-27

English is now the canonical language of every surface a visitor sees, with a Persian
mirror alongside it. The product itself stays Persian-first — this release changes
documentation and tooling, not the UI.

### Fixed

- **The WooCommerce integration never worked, from the very first commit.** The API sent a
  header named `X-میرا-Api-Key`; a non-ASCII header name is invalid, so `fetch` threw
  before sending and **no request ever reached WordPress**. The function's own `catch`
  swallowed the error and returned `null`, so the dashboard reported "not configured or
  customer not found" — making a hard failure indistinguishable from an unconfigured site.
  The header is now `X-Mira-Api-Key`, matching what the plugin reads. Verified against a
  mock server implementing the plugin's `hash_equals` auth: the request now returns HTTP
  200 with the customer's data.

### Added

- `package/INSTALL.md` — the installation guide in English; both it and the Persian
  `INSTALL.fa.md` ship inside the `.deb`
- `docs/fa.html` — the Persian landing page, with a language switcher on both pages
- Persian mirrors kept under the `.fa.md` suffix: `AGENTS.fa.md`, `CONTRIBUTING.fa.md`,
  `SECURITY.fa.md`, `CHANGELOG.fa.md`, `package/README.fa.md`, `docs/brand/README.fa.md`

### Changed

- `README`, `AGENTS`, `CONTRIBUTING`, `SECURITY`, `CHANGELOG`, the brand guide and the
  package docs are English at their canonical names; `CODE_OF_CONDUCT.md` is reordered
  English first
- Every user-visible GitHub surface is English: workflow, job and step names (shown in the
  public Actions tab), the issue forms, the PR template, and **the title and body of every
  GitHub Release** — release notes are now read from the English `CHANGELOG.md`
- The `mira` CLI, `install.sh`, `build-deb.sh`, the Debian maintainer scripts and the backup
  loop print English, following Debian command-line convention; `.env.example` comments are
  English
- `docs/index.html` (the GitHub Pages entry point) is the English landing page
- The design-system preview is `dir="ltr"` with the Persian specimens explicitly marked
  `dir="rtl"` — English text inside the RTL container rendered with punctuation on the
  wrong side
- Package `description` fields and the brand SVG `aria-label`s are English
- The language policy is now written down in `CONTRIBUTING.md`, `AGENTS.md` and `CLAUDE.md`:
  documentation and public surfaces English (canonical) with a `.fa.md` mirror; code
  comments, product UI and user-facing error messages Persian; commit messages English
- Corrected a false claim in the phase-3 test checklist: the WooCommerce order panel had
  only been verified at the WordPress endpoint with curl, never end to end through Mira

## [1.0.2] — 2026-07-27

### Changed

- The Debian package `Maintainer` field is back to the maintainer's real email address.
  Version 1.0.1 replaced it with a GitHub `noreply` address out of caution, but in the
  Debian standard this field is **how users reach the package maintainer** — a `noreply`
  address made it useless. It now also matches the email in the commit metadata.

## [1.0.1] — 2026-07-27

Preparing the repository to go public.

### Added

- **Bilingual README**: `README.md` in English (the project's public face) and
  `README.fa.md` in Persian (the full documentation), with a language switcher
- **Real product screenshots** in `docs/screenshots/` (dashboard, widget, login, design
  system) as WebP — ~176 KB in total
- **GitHub Pages landing page** at `docs/index.html` — self-contained, no external
  requests, ready for a custom domain later
- `CODE_OF_CONDUCT.md` (bilingual), `.editorconfig`
- `license` and `repository` fields in every `package.json`

### Changed

- Phase release tags (`0.0.1` through `0.0.7`) now point at the actual commit for each
  phase (created through the web UI, they all pointed at whatever HEAD was at the time)
- Debian package maintainer email changed to a GitHub noreply address
- `.claude/` added to the repository `.gitignore` (previously covered only by the
  machine's global gitignore)
- Sample development credentials in the README and CONTRIBUTING are now explicitly
  labelled "development only"

### Security

- `/demo.html` is no longer served when `NODE_ENV=production` (serving `widget-dist` is
  untouched) — so no real deployment leaves a public demo page with a sample widget key
- Full audit of the git history before going public: **no secret was ever committed**

## [1.0.0] — 2026-07-27

The first official, publishable release: Mira went from "complete code with no identity
and no installation path" to a product with a brand, an installation package and
automated releases.

### Visual identity and UI/UX

- Complete brand identity based on the Mira logo: the palette (blue `#2E6BE6`, teal
  `#17B8A6`, orange `#F5A623`) as tokens in `tailwind.config.js`, a vector logo and an
  **animated SVG logo**, a brand guide and a design-system preview page (`docs/brand/`)
- Full dashboard redesign: a new shell with a sidebar (inline icons, unread badge,
  profile block), the Vazirmatn font (self-hosted from npm, no CDN), a new login page
  with the brand gradient and the animated logo, the first logout button, a favicon
- Widget redesign: a brand SVG mark instead of an emoji, gradient, entry/open/typing
  animations, visually distinct bot messages, `prefers-reduced-motion` support —
  ~21 KB gzip (50 KB budget)
- WordPress plugin settings page redesign: brand header, sections as cards, a real colour
  picker instead of a text field

### Installation and deployment

- **Debian package** (`mira_<version>_all.deb`) + the `mira` command-line tool
  (setup/start/stop/restart/status/logs/update/backup/restore/doctor) + a systemd service
- `mira setup` generates every password and key randomly and securely, stores them in
  `/etc/mira/mira.env` with `chmod 600`, and displays them exactly once
- A complete installation guide for Debian 12/13, Ubuntu and RHEL-based distributions
  (+ `install.sh` for non-deb distributions)
- **The production dashboard is no longer a Vite dev server** — a static bundle on nginx

### Docker image publishing

- Three images published automatically to the GitHub Container Registry on every push to
  `main` and every tag: `ghcr.io/hami9/mira-api`, `ghcr.io/hami9/mira-worker`,
  `ghcr.io/hami9/mira-dashboard`
- The dashboard image works on any domain: the API URL is read at **runtime** from
  `config.js` instead of being baked in at build time (an entrypoint script in the nginx
  image)
- A "prebuilt image" option in `mira setup` — install in minutes with no build
  (building from source stays the default, since ghcr access is not guaranteed from
  every server)

### Repository infrastructure

- **AGPL-3.0** license (the WordPress plugin is GPLv2+, as that ecosystem requires)
- CI (lint/format/build of every workspace/widget size budget/deb build) and an automated
  Release on every tag
- Issue and PR templates, dependabot, CONTRIBUTING, SECURITY, CHANGELOG and a branded
  README

### Fixed

- `vite build` broke on a workspace package with CJS output
  (`"SocketEvent" is not exported`) — fixed with `build.commonjsOptions`; **the dashboard
  production build had never been run before this release**
- `seed.ts` wrote `position: 'bottom-end'`, a value the widget does not understand (only
  `bottom-left` / `bottom-right`) — corrected to a valid value and the brand colour
- Removed a hardcoded development email from the dashboard login form
- Fixed two long-standing ESLint errors and reformatted the whole repository
  (a repo-wide `format:check` had never passed before this release)

## [0.1.0] — before 1.0.0

The base product — phases 0 through 7 of the roadmap (no visual identity, no
installation package).

> This version was never tagged as a whole; each phase was released separately:
> [`0.0.1`](https://github.com/hami9/mira/releases/tag/0.0.1) (live chat core) through
> [`0.0.7`](https://github.com/hami9/mira/releases/tag/0.0.7) (hardening and deployment).

- Live chat (Socket.io) with an embeddable widget and a multi-tenant operator dashboard
- Canned responses, CSAT, departments/tags, business hours, sound/browser notifications,
  unread badge
- WordPress/WooCommerce plugin: widget injection, automatic pre-fill, customer order
  information next to the conversation, abandoned-cart trigger message
- AI: an answering bot with RAG, a reply-suggestion Copilot, summarisation, escalation,
  hand-off to a human (OpenAI-compatible/Gemini/Anthropic)
- Reporting (statistics, first-response time, CSAT, CSV export), automation and
  HMAC-signed webhooks
- Security: 2FA, role-based permissions read live from the database, rate limiting, CSP,
  message idempotency, daily backups and automatic SSL via Caddy
