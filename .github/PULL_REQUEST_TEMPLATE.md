## What changed?

<!-- A short description of the change and why -->

## Type of change

- [ ] Bug fix
- [ ] New feature
- [ ] Refactor / improvement with no behaviour change
- [ ] Documentation

## Checklist (project rules — AGENTS.md)

- [ ] Tested against the **real service**, not just by reading code (describe the test below)
- [ ] Database schema change? → a new migration was added (`synchronize` is never enabled)
- [ ] New queries are filtered by `siteId` (multi-tenancy)
- [ ] No secret or token in the code or the logs
- [ ] No Persian text in a wire protocol (header name, JSON key, parameter name)
- [ ] AI calls are not on the request path (they go through the BullMQ queue)
- [ ] `npm run lint` and `npm run format:check` are green
- [ ] Docs updated where needed — `README.md` / `README.fa.md` and `AGENTS.md` / `AGENTS.fa.md`
      (change an English doc and its `.fa.md` mirror in the same commit)

## How was it tested?

<!-- The real commands/scenario you ran -->
