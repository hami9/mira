# Contributing to Mira

**English** · [فارسی](CONTRIBUTING.fa.md)

Glad you want to help! This document summarises the rules the whole project is built on.
**Before changing anything, read [`AGENTS.md`](AGENTS.md) end to end** — the architecture,
the reasoning behind each decision, and the real bugs already found and fixed are there.

## Project languages

| Surface                                                              | Language                                            |
| -------------------------------------------------------------------- | --------------------------------------------------- |
| Documentation and public surfaces (README, CI job names, CLI output) | **English** (canonical) + a `.fa.md` Persian mirror |
| Code comments                                                        | Persian                                             |
| Product UI, user-facing error messages                               | Persian                                             |
| Identifiers (variables, functions, classes, files)                   | English                                             |
| Commit messages                                                      | English                                             |

Persian mirrors use the `.fa` suffix next to the canonical name — `README.md` /
`README.fa.md`, `CONTRIBUTING.md` / `CONTRIBUTING.fa.md`. When you change one, change the
other in the same commit.

Product i18n (dashboard, widget, WordPress plugin) is deliberately **not** part of this —
Mira is Persian-first by design and translating the product is a separate project.

### Commit messages

Keep them short and in English — GitHub shows them next to every folder in the file list,
where Persian text gets truncated and hard to read. Style: `type(scope): short imperative summary`

```
feat(dashboard): add sidebar shell with unread badge
fix(widget): keep custom color override on gradient
docs(readme): add product screenshots
chore(deps): bump vite to 5.4
```

Common prefixes: `feat` `fix` `docs` `chore` `refactor` `perf` `ci` `build`.
There is no enforcement tool (no commitlint) — this is a team convention.

## Development setup

```bash
git clone https://github.com/hami9/mira.git && cd mira
cp .env.example .env        # replace every *_PASSWORD / *_SECRET value
docker compose up -d --build
```

- Dashboard: `http://localhost:5173` — login: `admin@kgkala.test` / `ChangeMe123!`
  (⚠️ development default only; under `NODE_ENV=production` the seed does not run at all
  without `SEED_ADMIN_PASSWORD`)
- Widget demo: `http://localhost:3000/demo.html`

Lint/format on the host (needs only Node 20+):

```bash
npm ci && npm run lint && npm run format:check
```

## Non-negotiable rules

1. **`synchronize` is never enabled** — every schema change needs a new migration with a
   larger timestamp.
2. **Every query is filtered by `siteId`** — the system is multi-tenant; a cross-site data
   leak is the worst bug possible here.
3. **No secret in source or logs** — only in `.env`.
4. **AI calls are never on the request/socket path** — always through the BullMQ queue.
5. **User input is always sanitised** — single entry point: `sanitizeMessageContent`.
6. **Test against the real service, not by reading code** — nearly every real bug in this
   project was found only by actually running it.
7. **"Manage operators" is never a permission** — admin role only (prevents privilege
   escalation).
8. **No unnecessary complexity** — think twice before adding a new dependency.

## Adding a feature

Standard order (details in `AGENTS.md` section 11):

1. Shared types in `packages/shared-types` → 2. migration + entity → 3. api module
   → 4. permission (if needed) → 5. dashboard → 6. **real test** → 7. update docs
   → 8. English commit

## Pull requests

- Branch from `main`; commit messages short and in English (see above).
- CI must be green (lint + format + build of every workspace + widget stays under 50 KB gzip).
- In the PR description, describe the **real test** you ran — "I read the code" is not enough.
- If you found a real bug, add the lesson to section 6 of [`AGENTS.md`](AGENTS.md).

## Reporting a security issue

Do not open a public issue — see [`SECURITY.md`](SECURITY.md).
