# AI Agent Handoff

**English** · [فارسی](AGENTS.fa.md)

> This file is written for the AI agents (and humans) who work on this project next.
> Read it end to end before changing anything. Its purpose is to tell you **what was
> built, why it was built this way, what has actually been tested, and what has not** —
> so you don't rediscover expensive decisions from scratch, or accidentally break them.

**Project language policy.** Documentation and public surfaces (this file, README, CI job
names, CLI output, release notes) are **English, canonical**, with a Persian mirror under
the `.fa` suffix — `AGENTS.md` / `AGENTS.fa.md`. **Code comments, product UI text and
user-facing error messages stay Persian** — Mira is Persian-first by design. Identifiers
(variables, functions, classes, files) are English. Keep this style.

**Commit messages are English.** This changed when the repository went public: a commit
message must be **short and in English**, because GitHub shows it next to every folder in
the file list, where Persian text gets truncated and unreadable. Style:
`type(scope): short imperative summary` — e.g. `feat(dashboard): add sidebar shell`.
An optional body is fine, also in English.

> Commits made before this decision are in Persian and were **deliberately not
> rewritten**: rewriting history changes every SHA and breaks 10 published tags, 3
> releases and every PR reference. Not worth it.

---

## 1. What this project is

**Mira (میرا)** — a **self-hosted** AI-powered live chat support platform, an alternative
to hosted SaaS (Goftino, Crisp, Tawk.to), originally built for a mobile-accessories shop
running WordPress/WooCommerce.

Repository: `https://github.com/hami9/mira`

Two Persian roadmap files are the **final authority** on requirements but are **not in this
repository** — the owner keeps them separate and private (`1-نقشه-راه-KGChat.md` and
`2-پرامپت-Claude-Code-KGChat.md`). If you have access to them and find a conflict with this
file, **the roadmap wins**; if you don't, this file is your reference.

> Historical note: the project was first called "KGChat" and was renamed to "Mira / میرا"
> mid-development. A few traces of the old name remain **on purpose**: the project
> directory on disk is `kgchat/`, and the Postgres database and user are both named
> `kgchat`. Changing them means a database migration and a churned workspace for no real
> benefit. Leave them alone.

---

## 2. Architecture at a glance

An npm workspaces monorepo:

```
apps/
  api/         NestJS + Socket.io gateway (REST + realtime)   ← the heart of the system
  worker/      plain Node script + BullMQ (AI jobs and webhooks)
  dashboard/   React + Vite + Tailwind (operator panel)
  widget/      the chat widget injected into the customer's site (esbuild)
packages/
  shared-types/  types shared by everything — the only shared dependency of api and worker
wordpress-plugin/  the WooCommerce PHP plugin
deploy/        Caddyfile and backup script (production only)
package/       Debian/Linux installation package (not to be confused with packages/)
docs/          GitHub Pages landing, brand guide, screenshots
```

Infrastructure (all in `docker-compose.yml`): PostgreSQL + pgvector, Redis, MinIO.

### The important data flow

```
Visitor (widget) ──Socket.io──┐
                              ├──► api ──► Postgres
Operator (dashboard) ─────────┘     │
                                    ├──► BullMQ (Redis) ──► worker ──► Gemini/OpenAI
                                    │                          │
                                    └◄── Redis pub/sub ◄────────┘
                                        (channel mira:socket-events)
```

**Why the Redis pub/sub bridge?** The worker is a separate process with no access to the
Socket.io server. Instead of adding `@socket.io/redis-emitter`, it reuses the `ioredis`
client that was already there with one simple channel: the worker publishes, `ChatGateway`
in the api subscribes and broadcasts.

---

## 3. Rules you must follow (non-negotiable)

These are either security requirements from the roadmap or lessons learned the expensive
way (real production bugs):

1. **`synchronize` is never enabled.** Every schema change = a new migration with a larger
   timestamp. Migrations run automatically before the api starts.
2. **Every query is filtered by `siteId`.** The system is multi-tenant; a cross-site data
   leak is the worst possible bug here. Even `messages` carries a redundant `siteId` column
   so it can be filtered without a join.
3. **No secret in the source.** Only `.env` (which is gitignored). **Logs must never print
   a token or password** — this bug happened once and was fixed (section 6).
4. **AI calls are never on the request/socket path.** Always through the BullMQ queue. The
   live chat path must never wait on a language model.
5. **User input is always sanitised** — `sanitizeMessageContent` is the single entry point.
6. **After every piece of work: commit and push.** An explicit, standing request from the
   project owner.
7. **Test against the real service, not by reading code.** Nearly every real bug in this
   project was found only by actually running it (see section 6). Never claim "tested"
   without running it.
8. **"Manage operators" never becomes a permission** — otherwise an operator could make
   themselves an admin (privilege escalation).

---

## 4. What was built in each phase

| Phase | Contents                                                                | Test status                        |
| ----- | ----------------------------------------------------------------------- | ---------------------------------- |
| 0     | Infrastructure: monorepo, Docker, initial schema                        | ✅ ran                             |
| 1     | Live chat: Socket.io, widget, minimal dashboard, JWT                    | ✅ real test                       |
| 2     | Canned responses, CSAT, departments/tags, business hours, notifications | ✅ real test                       |
| 3     | WordPress/WooCommerce plugin + customer panel                           | ⚠️ **never installed for real**    |
| 4     | RAG, answering bot, Copilot, summarisation, escalation                  | ✅ with a real Gemini key          |
| 5     | Reporting: statistics, response time, CSAT, CSV export                  | ✅ real test                       |
| 6     | Automation, internal notes, API/webhooks, 2FA, role-based permissions   | ✅ real test                       |
| 7     | Hardening, CSP, idempotency, Caddy/SSL, backups                         | ⚠️ never deployed to a real server |

Between phases 3 and 4 a separate feature was added: **the unread badge and
"unanswered / answered" grouping**, backed by the `conversation_reads` table.

After phase 6 a requested bundle was added: **operator management, profiles, three visitor
pages, and the full AI settings UI**.

After phase 7 the "version 1.0.0" bundle was added (full description in `CHANGELOG.md`):

- **Brand identity** from the owner's logo: the palette (`primary #2E6BE6`,
  `teal #17B8A6`, `accent #F5A623`), a vector and an animated logo in `docs/brand/`, the
  Vazirmatn font (self-hosted from an npm package — deliberately no CDN).
- **Dashboard redesign**: a sidebar shell (`Sidebar.tsx` + `MiraLogo.tsx`); pages now
  render inside `<main>` instead of full-screen. The `onClose` props were removed from the
  5 pages reachable from the sidebar; the two detail pages (operator/visitor profile)
  deliberately keep `onClose`. The first logout was added too (client-side only — tokens
  live in memory).
- **Widget**: an inline SVG mark + gradient + animations; the `data-color` custom colour
  still works exactly as before and takes over from the gradient (`--mira-gradient` is set
  at the same time).
- **The production dashboard is no longer a dev server**: `Dockerfile.prod` serves the
  static bundle with nginx; Caddy proxies to `dashboard:80`.
- **Linux installation package** in `package/` (not to be confused with `packages/`):
  a `.deb` build, the `mira` CLI (setup/start/doctor/…), a systemd service, and an
  installation guide. Server configuration lives in `/etc/mira/mira.env` with a symlink to
  `/opt/mira/app/.env`.
- **Repository infrastructure**: the AGPL-3.0 license (the WordPress plugin stays GPLv2+),
  CI (lint/format/build/50 KB gzip widget budget/deb build), an automatic Release on `v*`
  tags, issue/PR templates, dependabot, CONTRIBUTING/SECURITY/CHANGELOG.
- **Several latent bugs fixed**: `bottom-end` in the seed (the widget only understands
  `bottom-left`/`bottom-right`); `vite build` breaking on a CJS workspace package (fixed
  with `build.commonjsOptions` — the dashboard production build had never been run before);
  two old ESLint errors; and a repo-wide prettier pass (a global `format:check` had never
  passed).
- **Image publishing to GHCR** (`docker-publish.yml`): on every push to main and every tag,
  the three images `ghcr.io/hami9/mira-{api,worker,dashboard}` are published. So the
  dashboard image works on any domain, the API URL is injected **at runtime**:
  `public/config.js` + the `/docker-entrypoint.d/10-mira-config.sh` script in the nginx
  image (precedence: `window.__MIRA_API_URL__` ← `VITE_API_URL` at build time ←
  localhost). The `docker-compose.ghcr.yml` overlay + the "prebuilt image" option in
  `mira setup` provide a build-free installation path; building from source stayed the
  default on purpose, because ghcr access is not guaranteed from every server.

Version 1.1.0 then made **English the canonical language of every public surface** (full
description in `CHANGELOG.md`). The naming convention: the conventional filename holds the
English text, the Persian mirror sits beside it with a `.fa` suffix, and both carry a
language bar. This covers the root docs, the installation guide, the GitHub Pages landing
page, the brand guide, and every string GitHub renders in its UI — workflow/job/step names
and the title and body of each Release. The `mira` CLI and the packaging scripts print
English, following Debian convention. **Product i18n was deliberately excluded**: the
dashboard, widget and plugin UI, plus all code comments, stay Persian. The same release
fixed bug #8 below.

### Migrations (in order)

```
1737300000000-InitSchema                    phase 0
1737300100000-Phase2Schema                  phase 2
1737300200000-Phase3Schema                  phase 3
1737300300000-ConversationReads             unread badge
1737300400000-Phase4AiSchema                phase 4 (embedding dimension later 1536 → 768)
1737300500000-Phase6Schema                  phase 6
1737300600000-Phase6bProfilesPermissionsAi  profiles/permissions/AI settings
1737300700000-Phase7Hardening               idempotency + indexes
```

Tables: `sites`, `agents`, `visitors`, `conversations`, `messages`, `canned_responses`,
`csat_ratings`, `visitor_page_views`, `conversation_reads`, `knowledge_base_documents`,
`knowledge_base_chunks`, `automation_rules`, `internal_notes`, `webhooks`.

---

## 5. Architecture decisions and **why**

If you want to change one of these, read the reason first — it has probably already been
considered.

- **The worker is not a NestJS app.** It is deliberately a plain Node script with a few
  `bullmq.Worker`s, talking directly to `pg.Pool` with raw SQL. Reason: all it does is
  "a few queries + an AI call"; building a separate NestJS app with its own
  DataSource/entities would just duplicate the api's infrastructure.

- **Gemini through the OpenAI-compatible client.** Instead of a dedicated adapter, Google's
  official OpenAI-compatibility endpoint is used (`OPENAI_BASE_URL`). The same single
  client works with real OpenAI, Gemini, or any compatible endpoint — just change the env.

- **The embedding dimension is 768, not 1536.** Because the actual provider is Gemini. The
  `gemini-embedding-001` model returns 3072 by default and is truncated with the
  `dimensions: 768` parameter. (`text-embedding-004` returned 404 for this key.)

- **The confidence threshold uses one call, not two.** The model answers in the format
  `CONFIDENCE: <number>\nANSWER: <text>` and it is parsed with a regex. If parsing fails,
  the fail-safe is "not confident" and the conversation goes to a human.

- **Handoff has no new data mechanism.** It simply means the bot stays quiet and
  `assignedAgentId` stays empty; because the unread badge counts every
  `senderType != 'agent'` as unread, the conversation automatically shows up in the
  "unanswered" group.

- **Escalation and human-request detection use keywords, not AI.** They run on the live
  message path, so they must be instant and free. The list lives in
  `packages/shared-types/src/keywords.ts`.

- **Internal notes live in their own table, not as a new `senderType` in `messages`.** If
  they shared the table, any code path that forgot to filter would leak them to the
  visitor. A separate table is structural isolation, not a condition someone has to
  remember.

- **Permissions are not in the JWT.** `PermissionGuard` reads them fresh from the database
  every time, so revoking access takes effect **immediately** rather than after the token
  expires (15 minutes).

- **Raw SQL for analytical queries.** Reports and the visitor pages use
  `DataSource.query()` because CTEs, `FILTER (WHERE ...)` and `LEFT JOIN LATERAL` become
  unreadable through the QueryBuilder.

- **No chart library and no helmet.** The charts are built from divs and CSS, and the
  security headers are written by hand. A project principle: "no unnecessary complexity"
  (an explicit request from the owner).

- **CSV export, not real xlsx.** With a BOM (`﻿`) it opens correctly in Persian Excel;
  adding `exceljs` was not necessary.

---

## 6. Real bugs found and fixed (the expensive lessons)

**Every one of these was found only by actually running the system, never by reading
code.** This is the most important section of this file.

1. **Gemini rejects a request that ends with a model turn.**
   `400 Requests ending with a model turn are not supported`. Multi-turn
   `user`/`assistant` history broke whenever the last message came from the bot.
   **Fix:** the whole history is sent as one plain text block inside a **single** `user`
   turn. In `suggest-reply.ts` and `summarize-conversation.ts`. Do not turn this back into
   multi-turn.

2. **The automation keyword separator only recognised the ASCII comma**, while the UI's own
   placeholder told the user to separate with the Persian comma "،" — meaning **no rule
   ever matched**. **Fix:** `split(/[,،]/)`.

3. **The column was named `visitedAt` but the query said `viewedAt`** → the visitor list
   endpoint returned 500.

4. **`seed.ts` printed the admin password to stdout** → the password ended up in the
   container logs. **Fix:** it is never printed; under `NODE_ENV=production` the seed does
   not run at all without `SEED_ADMIN_PASSWORD`.

5. **Static files did not pass through the Nest middleware chain** → the widget demo page
   was served with no security headers and leaked `X-Powered-By`. **Fix:** the middleware
   moved to `main.ts` and **before** `useStaticAssets`.

6. **CSP was set on JSON but not on HTML** (using `req.path` instead of `req.originalUrl`
   in the Nest middleware).

7. **A dead Postgres pool → unbounded login hang.** Idle connections were being dropped
   silently by the Docker network. The misleading symptom: `/health` was fine (it does not
   touch the database) while every database-backed route hung forever. **Fix:** `keepAlive`,
   `idleTimeoutMillis`, `connectionTimeoutMillis` in the TypeORM `extra` settings.
   **If you ever see "I can't log in" again, look here first.**

8. **A Persian header name → the WooCommerce integration never worked, from day one.**
   `wordpress.service.ts` sent the header `'X-میرا-Api-Key'` while the plugin reads
   `get_header('x-mira-api-key')`. More importantly, a non-ASCII header name is outright
   invalid: `fetch` throws `TypeError: Cannot convert argument to a ByteString` before
   sending — meaning **no request ever reached WordPress**. The function's own `catch`
   block swallowed the error and returned `null`, and the dashboard showed "WooCommerce is
   not configured or the customer was not found" — so a hard failure was indistinguishable
   from "not configured".
   **Fix:** the header became `X-Mira-Api-Key`; verified against a mock WordPress server
   implementing exactly the plugin's auth logic (before: request never sent; after:
   HTTP 200 with customer data).
   **General lesson: no Persian text may sit in a wire protocol (a header name, a JSON key,
   a parameter name)** — only in content displayed to a user.

---

## 7. Development environment traps (Windows + Docker Desktop)

The project owner works on **Windows 10 with Git Bash and Docker Desktop**. These have
cost real time repeatedly:

- **Never send Persian text inline with `curl -d '...'`** — the shell turns it into `????`.
  Write the JSON to a file and use `curl --data-binary @file`. (We mistook this for an
  application bug more than once.)
- **`docker cp` sometimes corrupts files.** Alternative:
  `docker exec -i <c> sh -c 'cat > /path && node /path'`.
- **A Node script inside a container must live under `/repo`**, otherwise it won't find
  `node_modules`.
- **Docker Desktop crashes frequently.** Fix: `taskkill //F //IM "Docker Desktop.exe"` then
  start it again and wait until `docker info` responds.
- **The base image sometimes times out on TLS.** Pull `node:20-alpine` separately first.
- **Builds are slow (several minutes).** Run them in the background and wait for the
  notification; output is buffered until the end, so an empty output file mid-build means
  "still running", not an error.
- **No automated browser tool was available originally** — no page had been visually
  verified. That changed later (Playwright + Chromium); if you have the tool, use it.

---

## 8. How to really test (the project's standard pattern)

```bash
# 1) log in as admin and grab a token
TOKEN=$(curl -s -X POST http://localhost:3000/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@kgkala.test","password":"ChangeMe123!"}' \
  | grep -oP '"accessToken":"\K[^"]+')

# 2) call the endpoint with the token
curl -s http://localhost:3000/v1/reports/overview -H "Authorization: Bearer $TOKEN"

# 3) verify the result directly in the database (the most important step)
docker exec mira_postgres psql -U kgchat -d kgchat -c "SELECT ..."
```

To test the live path (widget/Socket.io), run a Node script inside the `mira_dashboard`
container (`socket.io-client` is there). Use `API=http://api:3000` but
`Origin: http://localhost:3000` — the domain check runs against Origin, not host.

After every test: **delete the test data.**

---

## 9. Current status and remaining work

### Not tested (honestly)

1. **The WooCommerce plugin has never been installed on a real WordPress site.** The code
   is written but the roadmap's acceptance criterion ("install on a test WooCommerce
   site") was never met. **This is the top priority.** (The 1.0.0 settings-page redesign
   was only checked with `php -l`, not rendered in a real WordPress.) Note that bug #8 in
   section 6 means this path could not have worked end to end before v1.1.0 — the fix is
   verified against a mock, not against a real WooCommerce.
2. **Production deployment on a real server has never happened.** The Caddy/SSL/backup
   files are written and `docker compose config` validates, but real certificate issuance
   is unverified.
3. **The Debian package has never been installed on a real server.** The `.deb` is built
   and inspected with `dpkg-deb`, and every script passes `bash -n`, but the full
   `dpkg -i` → `mira setup` → `mira start` cycle has not been run on a real Debian box.
4. **The new dashboard production container (nginx) has never been run.** A local
   `vite build` succeeds and the static output was verified in a real browser, but the
   `Dockerfile.prod` image itself has not been built/run (no Docker daemon was available in
   the environment where these changes were made). The runtime config mechanism
   (`config.js`) was verified by simulating the entrypoint script in a real browser — the
   login request went to the injected address — but not by running the script inside the
   nginx container.
5. **The new UI has only been visually verified against a mocked API.** The login page, the
   sidebar shell, the conversation view and the widget were captured with real Chromium
   screenshots (Playwright + fetch mocking) and looked correct — but not connected to a
   real backend. A full-flow test (real socket, all settings/reports/visitors pages) is
   still needed.
6. **There is no automated test suite (unit/e2e).** All testing has been manual.

### Known technical debt

- **File attachments do not exist** — the `attachmentUrl` column and the MinIO service are
  reserved but upload is not implemented. If you add it: type/size limits, checking the
  **real** file type (not the extension), and signed links with expiry are mandatory (an
  unticked item on the security checklist).
- **`AI_MAX_TOKENS_PER_CONVERSATION` exists in env but is not enforced.** Cost control is
  currently handled by `aiMaxRepliesPerConversation` (per site).
- **The default password `ChangeMe123!`** is still in `seed.ts` for development. In
  production `SEED_ADMIN_PASSWORD` is required, but for a real deployment change it.
- **Test data in the development database:** the sample site's `offlineMessage` is an
  inappropriate test string and the knowledge base has one meaningless document
  ("hello = hello"). Delete these from the dashboard before any real demo.

### Suggested next roadmap phases (not started)

Multi-channel (WhatsApp/Instagram/Telegram), automatic multilingual translation, an
operator mobile app.

---

## 10. Frequently used commands

```bash
# bring up the development environment
docker compose up -d

# rebuild after a code change (slow — run it in the background)
docker compose build api worker dashboard
docker compose up -d --force-recreate api worker dashboard

# logs
docker logs mira_api --tail 50
docker logs mira_worker --tail 50

# database (both the user and the database are named kgchat, not mira)
docker exec mira_postgres psql -U kgchat -d kgchat -c "\dt"

# production deployment
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d

# build the Debian installation package (output: package/dist/mira_<version>_all.deb)
bash package/build-deb.sh

# releasing a version: first add the version section to CHANGELOG.md
# (heading: "## [1.1.0] — ..."), bump the version in every package.json and in the plugin,
# then tag. The release notes are read automatically from that CHANGELOG section;
# if the section is missing, the release fails.
git tag v1.1.0 && git push origin v1.1.0

# lint/format/build on the host (no Docker — CI runs exactly these)
npm ci && npm run lint && npm run format:check && npm run build
```

Development addresses: dashboard `http://localhost:5173` — API `http://localhost:3000`
— widget demo `http://localhost:3000/demo.html`
— login: `admin@kgkala.test` / `ChangeMe123!`

---

## 11. When you add a new feature

The order followed throughout the project, which should continue:

1. Shared types in `packages/shared-types/src/` and exported from `index.ts`
2. A new migration (timestamp larger than all others) + update the entity + register it in
   `database.module.ts`
3. The api module: service → controller → module, registered in `app.module.ts`
4. Permissions: if it is a new section, add a permission in `permissions.ts` and put
   `@RequirePermission(...)` on the controller
5. Dashboard: a method in `api.ts` → the component → wire it up in `App.tsx` (behind a
   permission gate)
6. Build, recreate, **a real test with curl/socket plus verification in the database**,
   then clean up the test data
7. Update `README.md` and `README.fa.md` (technical note + phase table) and **this file
   plus its Persian mirror**
8. Commit with a **short English message** (`type(scope): summary`) + push

**And most importantly:** if you find a real bug, add it to section 6 of this file. The
value of this file is exactly those lessons that are written down nowhere else.
