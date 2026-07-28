# Mira Enterprise Roadmap

**English** · [فارسی](ROADMAP.fa.md)

> **Status of this document.** Every claim below was checked against the code on `main`
> before this file was committed. Three claims in the original draft did not survive that
> check and have been corrected in place — see
> [Corrections against `main`](#corrections-against-main). Do not treat any line here as
> verified unless the risk register in §4 says so.

## Executive Summary & Architectural Vision

**Mira** is an open-source (AGPL-3.0), self-hosted AI live chat and customer support platform for WordPress/WooCommerce shops, built Persian-first. It is an npm-workspaces monorepo: **NestJS API + Socket.io gateway**, **React/Vite operator dashboard**, **framework-free embeddable widget** (~21 KB gzip, CI-capped at 50 KB), a **plain-Node BullMQ worker**, and a **PHP WooCommerce plugin**.

This document is the master execution plan and GitHub release roadmap for the next generation of the platform. It details 7 architectural extensions — Universal AI/BYO-LLM, multi-agent orchestration, deep WooCommerce in-chat operations, a visual automation engine, social-grade chat UX, an AI sales copilot, and zero-trust E2EE — structured into milestone-driven phases.

**This roadmap is written against the real state of `main`, not a greenfield.** Phases 0–7 of the original build are complete; several capabilities this document extends **already exist in some form**, and several things this document depends on **do not exist yet**. Each section below states which is which. Do not re-implement what is already there, and do not schedule work on top of an unvalidated foundation.

### Baseline: what actually exists today

| Capability                                         | State on `main`                                                                                          | Implication for this roadmap                                          |
| :------------------------------------------------- | :------------------------------------------------------------------------------------------------------- | :-------------------------------------------------------------------- |
| Multi-tenancy                                      | **Exists.** `siteId` isolation enforced on every query since Phase 0                                     | Phase 6 adds _billing/plans_, **not** tenancy                         |
| RBAC & permissions                                 | **Exists.** `PermissionGuard` reads permissions live from DB on every request                            | Extend the permission list only; do not move permissions into the JWT |
| AI provider layer                                  | **Partially exists.** One OpenAI-compatible client; Gemini via `OPENAI_BASE_URL`                         | Phase 2 = multi-provider + per-operator keys, not a new engine        |
| RAG / knowledge base                               | **Exists.** pgvector, **768-dim** embeddings (`gemini-embedding-001`, `dimensions: 768`)                 | See the embedding-dimension trap in §1.1                              |
| Reply Copilot, summaries, escalation               | **Exists.** `suggest-reply.ts`, `summarize-conversation.ts`, keyword escalation                          | Phase 6 extends the Copilot with commerce context                     |
| Automation rules                                   | **Exists** (`automation_rules` table, keyword/trigger rules)                                             | Phase 4 = visual builder + stateful execution on top                  |
| Outgoing webhooks                                  | **Exists**, HMAC-signed                                                                                  | Reuse; do not build a second webhook path                             |
| CSP, sanitization, 2FA, rate limiting              | **Exists.** Hand-written headers in `main.ts`; `sanitizeMessageContent` is the single sanitization point | Phase 1 adds **E2EE + SAST**, not basic hardening                     |
| Dependabot, CI (lint/format/build/widget-size/deb) | **Exists**                                                                                               | Phase 1 adds CodeQL/SAST only                                         |
| **File attachments**                               | **Does not exist.** `attachmentUrl` column and MinIO are reserved; upload is unimplemented               | **Hard blocker for Phase 5**                                          |
| **Automated test suite**                           | **Does not exist.** All testing to date is manual                                                        | **Hard blocker for the PR policy in §2**                              |
| WooCommerce plugin on a real site                  | **Never installed on real WordPress**                                                                    | **Hard blocker for Phase 3**                                          |
| Production deployment / `.deb` install             | **Never executed on a real server**                                                                      | Operational risk for every phase                                      |

---

## 0. Non-Negotiable Engineering Invariants

Every task in this roadmap inherits these. They are either security requirements or lessons paid for with production bugs. A PR that violates one is rejected regardless of feature value.

1. **`synchronize` is never enabled.** Every schema change is a new TypeORM migration with a strictly larger timestamp, registered in `database.module.ts`. Migrations run automatically before the API boots.
2. **Every query filters by `siteId`.** Cross-site data leakage is the worst possible bug. `messages` deliberately carries a redundant `siteId` so it can be filtered without a join.
3. **No secrets in source, and no secrets in logs.** `.env` only. A seed script once printed the admin password to stdout — do not repeat it.
4. **AI calls never run on the request or socket path.** Always via BullMQ. Live chat must never wait on a language model. This applies to _every_ new AI feature in this roadmap, including inter-agent loops and the sales copilot.
5. **All user input passes through `sanitizeMessageContent`** — one function, one place.
6. **The worker is intentionally not a NestJS app.** It is a plain Node script with `bullmq.Worker` instances and a raw `pg.Pool`. Do not "upgrade" it. Worker → client events go through the Redis pub/sub channel `mira:socket-events`, consumed by `ChatGateway`.
7. **"Manage operators" is never a permission** — it would let an operator promote itself to admin.
8. **Test against real services, not by reading code.** Nearly every real bug in this project was found only by running it. "Tested" without an execution log is not tested.
9. **Persian-first.** UI text, user-facing errors, code comments and docs are Persian; identifiers are English; commit messages are English (`type(scope): short imperative summary`). Every UI feature in this roadmap must be RTL-correct and must accept the Persian comma `،` wherever it accepts `,` — a keyword-splitter that only understood `,` silently broke _every_ automation rule once.
10. **Widget bundle budget is enforced by CI at 50 KB gzip** (currently ~21 KB). Any widget-side feature must fit, or ship as a lazily-loaded chunk fetched on demand.

---

## 1. Core Feature Extensions & Detailed Requirements

### 1.1 Universal AI Provider Sync & Multi-Agent Workflows (Items 1 & 6)

_Already in place:_ a single OpenAI-compatible client driven by `OPENAI_BASE_URL`, serving both OpenAI and Gemini; RAG retrieval; confidence-gated hand-off parsed from a `CONFIDENCE: <n>\nANSWER: <text>` single-call response with fail-safe to human.

- **Bring Your Own AI (BYO-AI) & API Key Management**:
  - Admin/Operator settings GUI to add, validate and rotate credentials per provider: **OpenAI**, **Anthropic Claude**, **Google Gemini**, **Groq**, **Mistral**, and local runtimes (**Ollama**, **vLLM**, **LocalAI**).
  - Credentials are stored **encrypted at rest** (AES-256-GCM, key from `.env`), never returned to the client after save, never logged, and masked in every API response.
  - **Provider capability matrix, not a flat list.** Most targets are OpenAI-compatible and reuse the existing client with a different base URL. Anthropic's Messages API is _not_ OpenAI-compatible and needs a real adapter. Model the difference explicitly rather than pretending one interface fits all.
  - **Validation on save**: a real cheap round-trip call before the credential is accepted; store `lastValidatedAt` and surface failures in the UI.
- **⚠ Embedding-dimension trap (must be solved before BYO-AI ships).** The `knowledge_base_chunks` vector column is fixed at **768 dimensions** because the provider is Gemini. OpenAI's `text-embedding-3-small` is 1536. Switching a site's embedding provider silently produces unusable vectors or migration errors. Required design:
  - Persist `embeddingProvider`, `embeddingModel` and `embeddingDimensions` **per site** on the knowledge base.
  - Separate the _chat_ provider from the _embedding_ provider — changing the chat model must not touch the index.
  - A background re-index job that re-embeds the whole knowledge base when the embedding model changes, with progress and a blocked-until-complete state in the UI.
  - Either one vector column per supported dimension, or dimension-tagged partitioned tables. Decide and record this as an ADR before writing the migration.
- **Granular per-operator AI assignments**: operators may bind their own key/model for personal drafting workflows. Per-operator usage is attributed and counted separately from site-level usage.
- **Inter-Agent Autonomous Communication (Bot-to-Agent Loop)**:
  - Bi-directional channel between the customer-facing bot and internal agents (Inventory Agent, Refund Approval Agent, …), executed **entirely inside the worker**.
  - Structured JSON protocol: `Request`, `Clarify`, `Approve`, `Respond`, each carrying `conversationId`, `siteId`, `depth`, `traceId`.
  - **Runaway protection is mandatory, not optional**: max delegation depth (default 3), max agents per conversation turn, per-turn wall-clock timeout, cycle detection on `traceId`, and a hard token budget per conversation. An agent loop that cannot terminate will bill a real credit card.
  - Any agent action with side effects (refund, order edit) requires an explicit approval step — never an autonomous write.
- **Custom AI Node Workflow Builder**: drag-and-drop canvas (React Flow) for prompt chaining, condition checks, RAG retrieval steps and tool calls. Graphs are versioned and stored as JSON; execution is a worker job, and every node execution is logged.
- **Cost governance (closes existing debt)**: `AI_MAX_TOKENS_PER_CONVERSATION` currently exists in `.env` but **is not enforced** — only `aiMaxRepliesPerConversation` is. BYO-keys, multi-agent loops and the sales copilot multiply spend by an order of magnitude, so enforcement must land in this phase, with per-site and per-operator token/cost counters and a hard cutoff.

### 1.2 Social-Media-Style Professional Chat UX (Item 2)

_Blocking prerequisite:_ **there is no file-upload pipeline.** `attachmentUrl` and the MinIO service are reserved but unimplemented. Everything below depends on it.

- **Attachment pipeline (prerequisite, security-critical)**:
  - Type and size limits; **real content-type sniffing (magic bytes), never trusting the extension**; per-site quota; virus/heuristic screening hook.
  - Signed, expiring object-storage URLs — never a public bucket path.
  - This is an unchecked item on the original security checklist; treat it as security work, not media work.
- **Interactive Media**: voice notes via `MediaRecorder` with waveform rendering, image/video galleries with a lightbox, file previews.
  - **Bundle-budget note**: waveform + recorder + lightbox will not fit in the widget's 50 KB gzip budget. Ship them as dynamically imported chunks loaded on first use, and add a CI assertion for the _initial_ bundle specifically.
  - `MediaRecorder` codec support differs across Safari/iOS; define a fallback (upload-a-file path) rather than a broken button.
- **Social Engagement**: emoji reactions, threaded replies, edit/delete history, typing indicators, presence badges (Online, Away, In Consultation).
  - Reactions and threads change the message read-model — verify the unread-badge logic still holds, since it counts any `senderType != 'agent'` as unread.
- **Community & Announcement Channels**: broadcast cards, a stories/updates banner in the widget header, public community tabs.
  - **Scope warning**: community tabs are a moderation surface (spam, abuse, PII in public view). Either ship moderation tooling with it or defer it out of this roadmap.
- **User & Operator Profiles**: profile cards with badges, localized timezones (Jalali dates for Persian locale), custom fields, activity timeline.

### 1.3 Deep WordPress & WooCommerce In-Chat Operations (Item 3)

_Already in place:_ read-side WooCommerce context — the operator sees cart, order history and total spend beside the conversation; abandoned-cart triggers.
_Blocking prerequisite:_ **the plugin has never been installed on a real WordPress site.** Every write-side feature below is speculative until that acceptance criterion is met.

- **Full In-Chat E-Commerce Operations**:
  - **Order Creation & Checkout**: build a cart inside the conversation and either send a one-click checkout link or create the order via the WooCommerce REST API.
  - **Order Modification & Refunds**: view, edit line items, update shipping address, initiate returns/refunds from the conversation panel.
  - **⚠ Money-touching operations need their own guardrails**: a dedicated permission per action, an idempotency key on every write (the platform already has an idempotency mechanism from hardening — reuse it), an immutable audit record of _who_ changed _what_, a confirmation step, and a configurable refund ceiling above which admin approval is required. An AI agent must never hold a write credential directly.
  - **Auth model**: WooCommerce REST with application passwords + nonce; store per-site credentials encrypted; scope the key to the minimum required capabilities; document key rotation.
- **Interactive Product Cards**: catalog search, rich cards with live stock, variant selectors, "Add to Cart" inside the widget. Cards must render RTL and handle Persian numerals and Rial/Toman formatting.
- **Live Cart & Order Sync**: WooCommerce-side listener pushes cart contents to Mira over the existing socket path.
  - **Performance note**: this fires on high-traffic shop pages. Debounce on the WordPress side, cap payload size, and make the listener fail-open — a Mira outage must never break checkout on the customer's shop.

### 1.4 Enterprise Automation Engine (Item 4)

_Already in place:_ `automation_rules` with keyword/condition rules and HMAC-signed outgoing webhooks. This phase upgrades them to a visual, stateful engine — it does not replace the existing rules, which must keep working (write a migration path, not a rewrite).

- **Visual Trigger-Action Engine**:
  - **Triggers**: page URL match, cart-value threshold, inactivity, exit intent, geography, inbound webhook, keyword match, sentiment shift.
  - **Actions**: assign to team/operator, trigger AI response, update WooCommerce customer metadata, call an external webhook, send email/SMS, tag the conversation.
  - Sentiment-shift triggers require a model call — per invariant 4 they run in the worker and are therefore **eventually consistent**, not instant. Design the UX around that.
- **Stateful Flow Management**: `IF/ELSE`, `WAIT FOR USER INPUT`, `LOOP`, `DELAY`, with per-step audit logging.
  - `LOOP` and `DELAY` create long-lived state: define maximum flow lifetime, maximum iterations, what happens when a conversation closes mid-flow, and how in-flight flows behave when their definition is edited (answer: pinned to the version they started on).
- **Safety rails**: a dry-run/simulation mode against a real past conversation, and a global kill switch per site. An automation engine that can message every visitor is also an engine that can spam every visitor.

### 1.5 AI Sales Copilot & Dynamic Recommendation Cards (Item 5)

_Already in place:_ the operator reply Copilot, conversation summarization, and confidence-gated hand-off. This is an extension of that surface with commerce context.

- **Real-time Operator Suggestions**: three ranked suggestions with one-click insert and tone control (Professional, Friendly, Concise). Suggestions are always operator-reviewed — never auto-sent.
- **AI-Driven Upselling & Cross-selling**: recommendations grounded in the customer's actual cart, order history and stated intent. **Recommendations must be filtered against live stock and price before display** — recommending an out-of-stock or wrongly-priced item is worse than recommending nothing.
- **Live Knowledge Lookup**: real-time semantic retrieval surfacing KB chunks, internal notes and canned responses beside the conversation, with the source document shown so the operator can verify before sending.
- **Measurement**: without attribution this feature cannot be justified. Track suggestion acceptance rate, and revenue on conversations where a recommendation was sent versus not.

### 1.6 Zero-Trust Security, E2EE & Infrastructure Hardening (Item 7)

_Already in place:_ 2FA, DB-backed RBAC, strict CORS, hand-written CSP headers, rate limiting, automatic HTTPS via Caddy, input sanitization, idempotency, Dependabot.

- **⚠ E2EE and server-side AI are mutually exclusive. This must be resolved before any code is written.**
  If the server only ever holds ciphertext, then for those conversations the following **cannot work**: the RAG bot, reply Copilot, summarization, keyword escalation, sentiment triggers, keyword-based automation rules, dashboard search, and content-based reporting. Server-side sanitization also cannot run, which moves XSS defence entirely to the client.
  Required before implementation:
  1. **A written degradation matrix**: for each feature, what it does when a conversation is E2EE — disabled, client-side only, or degraded.
  2. **E2EE is opt-in per conversation or per department, never global**, and the widget must show the visitor plainly which mode they are in.
  3. **An honest threat model.** The widget JavaScript is served by the same server the encryption is protecting against; a compromised API server can serve modified widget code and capture plaintext. E2EE here meaningfully protects against **database dumps, backup theft, and a compromised database host** — it does not protect against a compromised application server. Say this in the docs. Overstating it is worse than not shipping it.
  4. **Key lifecycle**: keys live on the client. Define what happens on browser-data clear, device change, operator offboarding, and multi-operator access to one conversation (group key / per-recipient wrapping). Decide explicitly whether recovery exists — and if it does not, say so loudly in the UI.
- **End-to-End Encryption (E2EE)**: WebCrypto, ECDH P-256 key agreement, AES-GCM-256 payload encryption. The server stores ciphertext plus public keys and wrapped key blocks only.
- **Open-Source Hardening**:
  - Complete audit logging for all administrative and money-touching actions.
  - Automated **CodeQL SAST** and dependency-vulnerability scanning in GitHub Actions (Dependabot already present).
  - Secret-scanning enabled on the repository, and a documented rotation procedure.
  - GDPR/CCPA data export and erasure workflows — noting that erasure must also purge KB embeddings derived from the erased conversations, not just the message rows.

---

## 2. GitHub-Driven Execution & Release Strategy

- **Branching**: `main` (release), `feature/issue-<id>-<name>`, `fix/issue-<id>-<name>`. Add `develop` only if a second contributor joins — for a solo maintainer it is ceremony, not safety.
- **Commit convention**: English, `type(scope): short imperative summary` (e.g. `feat(dashboard): add workflow canvas`). Pre-rename Persian commits are deliberately not rewritten — history rewriting would break 10 tags, 3 releases and every PR reference.
- **Pull Request requirements**:
  - Every PR links an open Issue.
  - CI must pass: ESLint, Prettier `format:check`, TypeScript build, widget gzip budget, `.deb` build.
  - **Unit and E2E tests are listed here on purpose, but no test suite exists yet.** Phase 0 creates it. Until Phase 0 lands, PRs carry a **manual verification log** — the commands run and the DB query proving the result — pasted into the PR body. This matches invariant 8.
  - At least one maintainer approval; self-merge is allowed for the sole maintainer only with the verification log attached.
- **Versioning & releases** — follow the repo's existing mechanism exactly:
  - Bump the version in every `package.json` **and** the WordPress plugin header.
  - Add the matching `## [x.y.z] — <date>` section to `CHANGELOG.md` **first**. The release workflow reads its notes from that section and **fails the release if the section is missing.**
  - Then `git tag vX.Y.Z && git push origin vX.Y.Z`.
  - **Do not use suffixed tags such as `v2.0.0-universal-ai`.** Under semver a hyphen suffix is a _pre-release_ and sorts _before_ `v2.0.0`, which will make the release badge (`sort=semver`) show the wrong version. Use plain `vX.Y.Z` tags and put the descriptive name in the **GitHub Milestone title** instead.
- **Licensing constraint**: the platform is **AGPL-3.0**; the WordPress plugin stays **GPLv2-or-later**. Any Phase 6 commercial/SaaS work inherits AGPL — offering a modified Mira as a network service obliges you to publish the modified source. Decide the commercial model (open-core with a separately-licensed billing module, or fully AGPL) **before** writing billing code, not after.

---

## 3. Granular Development Roadmap & Implementation Phases

```
┌──────────────────────────────────────────────────────────────────────────────────┐
│ PHASE 0: Foundation Validation — Real Deployment & Test Harness      [BLOCKING]   │
├──────────────────────────────────────────────────────────────────────────────────┤
│ PHASE 1: Zero-Trust Security, E2EE & Socket Hardening                            │
├──────────────────────────────────────────────────────────────────────────────────┤
│ PHASE 2: Universal AI Engine & Custom Workflow Canvas                            │
├──────────────────────────────────────────────────────────────────────────────────┤
│ PHASE 3: Deep WooCommerce E-Commerce & In-Chat Operations                        │
├──────────────────────────────────────────────────────────────────────────────────┤
│ PHASE 4: Enterprise Automation Engine & Proactive Triggers                       │
├──────────────────────────────────────────────────────────────────────────────────┤
│ PHASE 5: Social-Media-Style Rich Chat UX & Media Engine                          │
├──────────────────────────────────────────────────────────────────────────────────┤
│ PHASE 6: AI Sales Copilot & Multi-Tenant B2B SaaS Layer                          │
└──────────────────────────────────────────────────────────────────────────────────┘
```

**Sequencing rationale.** Phase 0 is new and blocking: shipping six phases of enterprise features onto a stack that has never run on a real server, whose WooCommerce plugin has never been installed, and which has zero automated tests, converts every later phase into an unbounded debugging session. Phase 3 additionally cannot start until the plugin is validated on real WordPress, and Phase 5 cannot start until the attachment pipeline exists.

**Duration realism.** The estimates below are engineering-days for a solo maintainer working with AI assistance, and they exclude the manual verification cycle that this project's testing model requires. Assume a 1.4–1.7× multiplier end-to-end and treat the ordering, not the dates, as the commitment.

---

### ⚫ Phase 0: Foundation Validation — Real Deployment & Test Harness

> **Goal**: Prove that what already exists actually runs in production, and build the safety net every later phase assumes.
> **GitHub Milestone**: `Foundation Validation` — tag `v1.2.0` | **Duration**: 2 Weeks | **Status**: BLOCKING

#### Granular Tasks:

1. **Install the WooCommerce plugin on a real WordPress site** (staging shop, real WooCommerce). Verify the settings page renders, the customer panel loads, cart/order data reaches the operator dashboard, and the abandoned-cart trigger fires.
2. **Execute a real production deployment**: `dpkg -i` → `mira setup` → `mira start` on a clean Debian host. Confirm Caddy issues a real Let's Encrypt certificate, `mira doctor`/`backup`/`restore` work, and the systemd unit survives a reboot.
3. **Build and run the production dashboard image** (`Dockerfile.prod` + nginx) and verify the runtime `config.js` API-URL injection inside the actual container. Trigger `docker-publish.yml` once and make the three GHCR packages public.
4. **Test harness**:
   - Unit tests (Vitest/Jest) for pure logic first: sanitization, keyword splitting (`,` **and** `،`), confidence parsing, permission resolution, `siteId` scoping helpers.
   - Integration tests against ephemeral Postgres + Redis containers covering auth, message send/receive, and idempotency.
   - One Playwright E2E happy path: visitor opens widget → sends message → operator replies → visitor receives it.
   - Wire all three into CI and make them required checks.
5. **Cleanup** — ⚠️ _mostly already done; see Corrections._ `seed.ts` creates only a site
   and an admin account: it contains **no** knowledge-base document and **no**
   `offlineMessage`. Those are rows in the maintainer's local development database, so
   deleting them is a local DB chore, not a repository change. A non-default admin password
   is **already enforced** — `seed.ts` exits 1 under `NODE_ENV=production` when
   `SEED_ADMIN_PASSWORD` is unset, and `mira setup` generates a random one. What remains:
   clean the maintainer's own dev database before recording any demo.

#### Acceptance Criteria:

- A screenshot or log of Mira serving a real WooCommerce site over HTTPS on a real domain.
- CI green on a PR with tests as required checks; a deliberately broken `siteId` filter causes a test failure.
- `AGENTS.md` §9 "untested" list reduced to zero items 1–4.

---

### 🟢 Phase 1: Zero-Trust Security, E2EE & Socket Hardening

> **Goal**: Add client-side encryption and automated security scanning on top of the existing hardening, and make socket delivery resilient to network loss.
> **GitHub Milestone**: `Security & E2EE` — tag `v1.3.0` | **Duration**: 3 Weeks
> **Precondition**: Phase 0 complete. **The E2EE degradation matrix (§1.6) is written and merged as an ADR before any crypto code is written.**

#### Granular Tasks:

1. **E2EE design ADR** — degradation matrix, opt-in scope, threat model, key lifecycle and recovery policy. Reviewed and merged first.
2. **Client-Side E2EE Engine**:
   - WebCrypto module in `apps/widget` and `apps/dashboard`: ECDH P-256 key agreement, AES-GCM-256 payloads, per-recipient key wrapping for multi-operator access.
   - Migration in `apps/api` for public keys, wrapped key blocks and a per-conversation `encryptionMode` flag.
   - Feature-flagged and opt-in; AI/search/automation visibly disabled for encrypted conversations per the matrix.
   - Widget-side crypto ships as a lazily-loaded chunk to protect the 50 KB budget.
3. **WebSocket Resilience & Ack Queue**:
   - Offline outbound queue (IndexedDB in the widget, in-memory + session storage in the dashboard) with replay on reconnect, deduplicated by the existing idempotency key.
   - Reconnection backoff with jitter; heartbeat monitoring over the existing Redis pub/sub bridge.
   - Regression guard for the dead-Postgres-pool hang: keep `keepAlive`/`idleTimeoutMillis`/`connectionTimeoutMillis` configured and extend `/health` to include a real DB round-trip, since the old `/health` passed while every DB route hung forever.
4. **Security Pipeline**: CodeQL SAST workflow, dependency vulnerability gate, repository secret scanning, and a documented rotation procedure. Add a CSP regression test covering **both** HTML and JSON responses — CSP was previously applied to JSON but not HTML because the middleware read `req.path` instead of `req.originalUrl`.

#### Acceptance Criteria:

- A DB dump of an encrypted conversation contains no readable message text.
- Killing the network mid-send delivers the message exactly once on reconnect, verified in the DB.
- CodeQL runs on every PR; a deliberately introduced vulnerable dependency blocks the merge.
- `curl -I` shows CSP on the widget demo HTML page and on a JSON endpoint.

---

### 🔵 Phase 2: Universal AI Engine & Custom Workflow Canvas

> **Goal**: Support any LLM provider, per-operator AI credentials, bounded inter-agent orchestration, and enforced AI cost control.
> **GitHub Milestone**: `Universal AI` — tag `v1.4.0` | **Duration**: 4 Weeks
> **Precondition**: embedding-dimension strategy (§1.1) merged as an ADR.

#### Granular Tasks:

1. **Universal AI Provider Management**:
   - Dashboard UI for credentials, base URLs and model selection across OpenAI, Anthropic, Gemini, Groq, Mistral, Ollama/vLLM/LocalAI.
   - AES-256-GCM encrypted credential storage in `apps/api`; masked on read; never logged.
   - A real validation round-trip on save, with `lastValidatedAt` surfaced in the UI.
   - A dedicated Anthropic adapter (its Messages API is not OpenAI-compatible); everything else reuses the existing OpenAI-compatible client.
   - Preserve the existing Gemini workaround: full conversation history is flattened into a **single** `user` turn, because Gemini rejects requests ending on a model turn. Do not restore multi-turn history.
2. **Embedding provider separation & re-index job**: per-site embedding model/dimension tracking, chat-provider/embedding-provider decoupling, and a worker job that re-embeds the knowledge base on model change with progress reporting.
3. **Operator-Specific AI Integration**: per-operator key binding, per-operator preference toggles, per-operator usage attribution.
4. **Inter-Agent Communication Engine**: BullMQ orchestration in `apps/worker` (plain Node — invariant 6), a structured `Request/Clarify/Approve/Respond` JSON schema, and hard limits on depth, fan-out, wall clock, tokens and cycles. Emit results to clients over `mira:socket-events`.
5. **AI cost governance**: enforce `AI_MAX_TOKENS_PER_CONVERSATION` (currently dead config), add per-site and per-operator token/cost counters, a soft warning threshold and a hard cutoff, and a cost dashboard panel.
6. **Workflow Builder Canvas**: React Flow canvas in `apps/dashboard` for prompt chaining, branching and RAG nodes. Versioned JSON graphs, worker-side execution, per-node execution logs, RTL-correct canvas.

#### Acceptance Criteria:

- The same conversation produces a valid reply through OpenAI, Gemini and a local Ollama model with only a settings change.
- Switching a site's embedding model triggers re-indexing and RAG answers stay correct afterwards.
- A deliberately recursive agent workflow terminates at the depth cap and logs the reason.
- A conversation exceeding its token budget stops calling the model and hands off to a human.

---

### 🟣 Phase 3: Deep WooCommerce E-Commerce & In-Chat Operations

> **Goal**: Turn Mira into a conversational commerce platform with safe, audited write access to WooCommerce.
> **GitHub Milestone**: `Conversational Commerce` — tag `v1.5.0` | **Duration**: 3 Weeks
> **Precondition**: Phase 0 task 1 complete — the plugin is proven on a real WooCommerce site.

#### Granular Tasks:

1. **In-Chat Order Management**:
   - REST endpoints in `wordpress-plugin/mira` to create, modify and query orders, with capability checks on the WordPress side as well as the Mira side.
   - Idempotency key on every write; immutable audit record (actor, before, after, timestamp); dedicated permissions per action; a refund ceiling above which admin approval is required.
   - Operator-facing Order Card UI for quantities, discounts and payment links.
2. **Rich Product Card Sharing**: product search modal with live stock/variant lookup; interactive cards in the widget with carousel, price, variant selection and add-to-cart. RTL layout, Persian numerals, Toman/Rial formatting.
3. **Real-Time Cart Synchronization**: debounced WooCommerce-side listener pushing cart contents over the existing socket path; live cart panel beside the conversation. **Fail-open**: any Mira error must be swallowed on the shop side so checkout is never blocked.
4. **AI tool-calling boundary**: expose commerce operations to AI agents as _proposals_ only. Writes execute after human approval; the agent never holds the WooCommerce credential.

#### Acceptance Criteria:

- An operator creates a real order from inside a conversation and it appears correctly in WooCommerce admin.
- A duplicated write request (same idempotency key) creates exactly one order — verified in the WooCommerce DB.
- Stopping the Mira API leaves the shop's checkout fully functional.
- An AI-proposed refund cannot execute without an explicit operator approval event in the audit log.

---

### 🟠 Phase 4: Enterprise Automation Engine & Proactive Triggers

> **Goal**: Upgrade the existing rule engine to a visual, stateful, auditable automation builder without breaking existing rules.
> **GitHub Milestone**: `Automation Engine` — tag `v1.6.0` | **Duration**: 3 Weeks

#### Granular Tasks:

1. **Visual Automation Canvas**: node-based trigger/action builder (React Flow, RTL-correct) with triggers `Page View URL`, `Cart Value > X`, `Inactivity > Y`, `Exit Intent`, `Geography`, `Inbound Webhook`, `Keyword`, `Sentiment Shift`. Keyword inputs accept `,` and `،`.
2. **Migration path for existing rules**: every current `automation_rules` row is converted into an equivalent graph, or the legacy engine keeps running alongside. Existing customer automations must not silently stop firing.
3. **Execution Engine & Auditor**: stateful runner in `apps/api/src/modules/automation` with actions `Send Widget Message`, `Assign Agent`, `Add Tag`, `Trigger External Webhook` (reusing the existing HMAC signer), `Execute WP Hook`. Flow instances pin to the graph version they started on. Maximum lifetime and iteration caps enforced.
4. **Safety and observability**: dry-run against a real historical conversation, a per-site kill switch, and a step-by-step execution log viewer showing success/failure and payloads per run.

#### Acceptance Criteria:

- A pre-existing keyword rule still fires after the upgrade.
- A flow with `WAIT FOR USER INPUT` resumes correctly after a 24-hour gap and terminates cleanly if the conversation closes.
- The kill switch halts all in-flight flows for a site within one execution cycle.
- Editing a live flow does not alter the behaviour of already-running instances.

---

### 🟡 Phase 5: Social-Media-Style Rich Chat UX & Media Engine

> **Goal**: A modern, engaging chat experience — built on a secure attachment pipeline that does not yet exist.
> **GitHub Milestone**: `Rich Chat UX` — tag `v1.7.0` | **Duration**: 4 Weeks (was 3 — the attachment pipeline is a full workstream)
> **Precondition**: none of this ships without task 1.

#### Granular Tasks:

1. **Attachment pipeline (security-critical prerequisite)**: MinIO/S3 upload with type and size limits, **magic-byte content sniffing rather than extension trust**, per-site quotas, signed expiring download URLs, and an EXIF-stripping step for uploaded images.
2. **Audio Voice Notes & Media Galleries**: `MediaRecorder` capture with waveform preview, lightbox gallery and inline video — all as **dynamically imported chunks**, with a CI assertion on the initial widget bundle and a documented fallback for browsers without `MediaRecorder` support.
3. **Social Interactions**: emoji reactions, threaded replies, edit-history badge, richer typing indicators. Re-verify unread-badge and "unanswered/answered" grouping against the new message shapes.
4. **Announcements & Stories Banner**: promotional/status cards in the widget header, per-site configurable, dismissible and RTL-correct.
5. **Community tabs**: **deferred** unless moderation tooling ships with it — recorded here so the decision is explicit rather than forgotten.

#### Acceptance Criteria:

- A `.php` file renamed to `.jpg` is rejected by content sniffing.
- Download URLs expire and are unusable afterwards.
- Initial widget bundle remains under 50 KB gzip with media features present but unloaded.
- A voice note recorded on Android plays back correctly on iOS Safari, or the documented fallback appears.

---

### 🔴 Phase 6: AI Sales Copilot & Commercial SaaS Layer

> **Goal**: Commerce-aware AI selling assistance, and the billing/plan layer on top of the tenancy that already exists.
> **GitHub Milestone**: `Sales Copilot & SaaS` — tag `v1.8.0` | **Duration**: 4 Weeks
> **Precondition**: the licensing decision in §2 is made and documented.

#### Granular Tasks:

1. **AI Sales Copilot Panel**: extend the existing reply Copilot with three ranked suggestions, cart-aware upsell/cross-sell and discount proposals. **Every recommendation is validated against live stock and price before it is shown.** Suggestions are always operator-reviewed.
2. **Plans, quotas and billing — not tenancy.** `siteId` isolation already exists and is an invariant; this phase adds a `plans`/`subscriptions` model keyed to existing sites, plus quota enforcement (conversations, AI tokens, storage, operator seats) and graceful degradation on overage.
   - **Payment gateway**: build against a gateway-agnostic interface. Stripe is unavailable to Iranian merchants, so ship an Iranian PSP adapter (Zarinpal/IDPay/Zibal class) as the first concrete implementation and keep Stripe as an optional adapter for non-Iranian deployments.
3. **Analytics Dashboard**: response times, resolution rate, CSAT trends, operator leaderboard, AI cost/usage per site and per operator, and copilot suggestion-acceptance and attributed revenue. Reuse the existing raw-SQL analytics pattern (`DataSource.query()`) rather than adding a charting library — the project deliberately builds charts from `div` + CSS.
4. **Tenant isolation regression suite**: automated tests asserting that no endpoint, socket room, Redis key or report leaks across `siteId`. This is the highest-severity bug class in the project; it should be machine-verified before commercial use.

#### Acceptance Criteria:

- A site exceeding its plan quota degrades gracefully with a clear message, and does not lose data.
- A payment succeeds end-to-end through the Iranian PSP adapter on a real sandbox.
- The isolation suite fails if a `siteId` filter is removed from any repository method.
- Copilot suggestion-acceptance rate is visible in the analytics tab.

---

## 4. Verification, Assumptions & Open Risk Register

The previous version of this table marked all ten items "✅ Verified". That was self-certification without evidence, which is contrary to how this project documents itself. Below, **Verified** means it was executed and observed; everything else is an assumption or an open risk with an owner.

| #   | Audit Item                      | Criterion                                                                                                                                                 | Status                                                                                                                                                            |
| :-- | :------------------------------ | :-------------------------------------------------------------------------------------------------------------------------------------------------------- | :---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | **Monorepo alignment**          | Matches real layout: `apps/{api,worker,dashboard,widget}`, `packages/shared-types`, `wordpress-plugin/`, `package/`, `deploy/`                            | ✅ Verified against `main`                                                                                                                                        |
| 2   | **Worker architecture**         | Plain Node + BullMQ + `pg.Pool`; **not** a NestJS app; client events via `mira:socket-events`                                                             | ✅ Verified — do not "upgrade"                                                                                                                                    |
| 3   | **Tenancy**                     | `siteId` isolation exists platform-wide; Phase 6 adds billing, not tenancy                                                                                | ✅ Verified                                                                                                                                                       |
| 4   | **E2EE feasibility**            | ECDH P-256 + AES-GCM-256 are standard, but E2EE **disables server-side AI, search and automation** for encrypted conversations                            | ⚠️ Open design conflict — ADR required (Phase 1 task 1)                                                                                                           |
| 5   | **E2EE threat model**           | Protects against DB dumps and backup theft; **does not** protect against a compromised API server serving modified widget JS                              | ⚠️ Must be stated honestly in user docs                                                                                                                           |
| 6   | **BYO-AI embedding dimensions** | pgvector column is fixed at 768; other providers emit 1536/3072                                                                                           | ❌ Unsolved — blocking for Phase 2                                                                                                                                |
| 7   | **Inter-agent loop safety**     | Depth, fan-out, timeout, cycle and token caps                                                                                                             | ❌ Not designed yet — required before implementation                                                                                                              |
| 8   | **AI cost enforcement**         | `AI_MAX_TOKENS_PER_CONVERSATION` exists in env but is **not enforced**                                                                                    | ❌ **Verified against code**: parsed into `apps/worker/src/config.ts:26` as `maxTokensPerConversation` and never read anywhere. Dead config. Must land in Phase 2 |
| 9   | **WooCommerce write path**      | Plugin has **never been installed on a real WordPress site**                                                                                              | ❌ Blocking for Phase 3 — Phase 0 task 1                                                                                                                          |
| 10  | **Attachment pipeline**         | `attachmentUrl` and MinIO reserved; upload unimplemented; an unchecked security-checklist item                                                            | ❌ Blocking for Phase 5                                                                                                                                           |
| 11  | **Widget bundle budget**        | CI caps the widget at 50 KB gzip; Phase 5 media features exceed it if bundled eagerly                                                                     | ⚠️ Mitigation: lazy chunks + initial-bundle CI assertion                                                                                                          |
| 12  | **Automated tests**             | No unit or E2E suite existed; the PR policy assumes one                                                                                                   | 🟡 Partly closed in v1.2.0 — 55 unit tests + 27 integration tests on real Postgres run in CI. Playwright E2E still missing (needs the stack running)              |
| 13  | **Production deployment**       | Caddy/SSL, `.deb` install and the nginx dashboard image have never run on a real server                                                                   | ❌ Phase 0 tasks 2–3                                                                                                                                              |
| 14  | **Release mechanism**           | Tags must be plain `vX.Y.Z`; a `CHANGELOG.md` section must exist first or the release workflow fails                                                      | ✅ Verified — suffixed tags removed from this plan                                                                                                                |
| 15  | **Licensing**                   | AGPL-3.0 platform, GPLv2+ plugin; commercial SaaS work inherits AGPL obligations                                                                          | ⚠️ Decision required before Phase 6                                                                                                                               |
| 16  | **Payment gateway**             | Stripe is unavailable to Iranian merchants — the project's primary market                                                                                 | ⚠️ Gateway-agnostic interface + Iranian PSP adapter first                                                                                                         |
| 17  | **Compliance claims**           | SAST + Dependabot + CSP are good practice but **do not constitute SOC 2 compliance**, which requires an audited control framework and an external auditor | ⚠️ Claim corrected — do not market as SOC 2                                                                                                                       |
| 18  | **Persian/RTL correctness**     | Every new UI surface (canvas, product cards, media, stories) must be RTL-correct and accept `،` alongside `,`                                             | ⚠️ Per-phase acceptance criterion                                                                                                                                 |

### Corrections against `main`

The draft of this roadmap was checked line by line against the code before being committed.
Most of it held up. These three claims did not, and are corrected in place above:

| Draft claim                                                                                                         | What the code actually shows                                                                                                                                                                                                                                                                                                      |
| :------------------------------------------------------------------------------------------------------------------ | :-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Phase 0 task 5: "remove the placeholder seed knowledge-base document and the inappropriate sample `offlineMessage`" | `apps/api/src/database/seed.ts` (81 lines) creates **only** a site and an admin agent. It writes no knowledge-base document and no `offlineMessage`. Those rows live in the maintainer's local dev database — `AGENTS.md` §9 files them under "test data in the development database", not under code. **Not a repository task.** |
| Phase 0 task 5: "enforce a non-default admin password on every install path"                                        | **Already enforced.** `seed.ts:23` exits with code 1 when `NODE_ENV=production` and `SEED_ADMIN_PASSWORD` is unset, and `mira setup` generates a random password for every server install. Nothing to do.                                                                                                                         |
| Phase tags `v1.5.0` … `v2.1.0`                                                                                      | The released line is at `v1.1.0`, so those numbers would have skipped three minor versions. Retagged `v1.2.0` … `v1.8.0`, keeping the roadmap's ordering. The roadmap itself says to treat the ordering, not the numbers, as the commitment.                                                                                      |

Confirmed accurate on inspection: the dead `AI_MAX_TOKENS_PER_CONVERSATION` config, the
`[,،]` keyword splitter, the single-call confidence parse with fail-safe hand-off, the
768-dimension embedding column, and the unimplemented attachment pipeline.

### What v1.2.0 actually delivered

Phase 0 is **partly** complete. Honest split:

| Phase 0 task                                         | State                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| :--------------------------------------------------- | :-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 4. Test harness                                      | ✅ **Done.** Vitest; 55 unit tests over sanitization, keyword splitting (`,` and `،`), confidence parsing, permission resolution, business hours and user-agent parsing; 27 integration tests over migrations, schema, tenant isolation and message idempotency, running against real Postgres + Redis service containers in CI as a required check. Proven to catch regressions by reverting the `[,،]` fix and observing the failure. |
| 5. Cleanup                                           | ✅ **Done / not applicable** — see Corrections above.                                                                                                                                                                                                                                                                                                                                                                                   |
| 1. Plugin on real WordPress                          | ⛔ **Blocked on hardware.** Needs a real WooCommerce site. See [`docs/PHASE0-RUNBOOK.md`](docs/PHASE0-RUNBOOK.md).                                                                                                                                                                                                                                                                                                                      |
| 2. Real Debian deployment                            | ⛔ **Blocked on hardware.** Needs a VPS with a real domain for Let's Encrypt.                                                                                                                                                                                                                                                                                                                                                           |
| 3. Production dashboard image + public GHCR packages | ⛔ **Blocked on hardware.** Needs a Docker daemon; the three GHCR packages are still private.                                                                                                                                                                                                                                                                                                                                           |

Phases 1–6 remain gated on tasks 1–3, exactly as the sequencing rationale requires.

### Deferred / out of scope for this roadmap

Recorded so they are not silently lost: multichannel messaging (WhatsApp, Instagram, Telegram), automatic multilingual translation, an operator mobile app, and public community tabs with moderation tooling.
