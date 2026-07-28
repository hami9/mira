# Phase 0 runbook — the three tasks that need real hardware

**English** · [فارسی](PHASE0-RUNBOOK.fa.md)

Phase 0 of [`ROADMAP.md`](../ROADMAP.md) is blocking: no later phase should start until the
existing stack is proven to run for real. Task 4 (the test harness) and task 5 (cleanup) are
done. The three tasks below cannot be automated from a sandbox — they need a real
WordPress site, a real server with a real domain, and a Docker daemon.

Each section states what to run, what "pass" looks like, and **what to copy back** so the
result can be recorded in `AGENTS.md` §9 and the Phase 0 tracking issue.

---

## Task 1 — Install the plugin on a real WooCommerce site

**Why it blocks:** the entire write-side commerce feature set (Phase 3) is speculative until
the read-side is proven on real WordPress. Note that bug #8 in `AGENTS.md` §6 means this
path could not have worked at all before v1.1.0 — the fix is verified against a mock server,
never against real WooCommerce.

### Option A — the throwaway site already in the repo (fastest)

```bash
cd wordpress-plugin
docker compose -f docker-compose.test.yml up -d

docker compose -f docker-compose.test.yml run --rm wpcli core install \
  --url=http://localhost:8081 --title="KG Kala Test" \
  --admin_user=admin --admin_password=admin123 \
  --admin_email=admin@example.test --skip-email

docker compose -f docker-compose.test.yml run --rm wpcli plugin install woocommerce --activate
docker compose -f docker-compose.test.yml run --rm wpcli plugin activate mira
```

### Option B — an existing staging shop

Upload `mira-wordpress-plugin.zip` from the
[latest release](https://github.com/hami9/mira/releases/latest) through
**Plugins → Add New → Upload**, then activate it.

### Configure

1. WordPress admin → **Settings → Mira**
   - Backend URL: your Mira API address
   - Widget key and API key: the values `mira setup` printed
2. Mira dashboard → **Settings → WordPress/WooCommerce connection**: the shop URL and the
   same API key.
3. Create a customer with a real email and place **two** orders for them.
4. Open the shop front-end logged in as that customer and start a chat.

### Pass criteria

- [ ] The settings page renders correctly (RTL, brand header, colour picker works)
- [ ] The widget script is present on the shop front-end and **absent** in `/wp-admin/`
- [ ] `curl` against the endpoint returns `401` with no key or a wrong key, `200` with the right one
- [ ] **The customer panel beside the conversation in Mira shows total spend, the latest
      order status and the order history** — this is the one that has never worked
- [ ] Name and email are pre-filled for the logged-in customer
- [ ] With a non-empty cart, the abandoned-cart trigger appears

### Report back

```bash
# from the Mira server
sudo mira logs api | grep -i wordpress | tail -20
```

Plus a screenshot of the customer panel showing real order data.

---

## Task 2 — A real production deployment

**Why it blocks:** Caddy/SSL, the `.deb` install path and the backup scripts have never been
executed on a real host. Every later phase assumes they work.

### Requirements

- A clean Debian 12/13 VPS, 2 GB RAM minimum
- Two DNS **A records** pointing at the server: `chat.example.com`, `panel.example.com`
- Ports 80 and 443 open

### Run

```bash
wget https://github.com/hami9/mira/releases/latest/download/mira_1.1.0_all.deb
sudo dpkg -i mira_*_all.deb || sudo apt -f install

sudo mira setup      # save the credentials it prints — shown exactly once
sudo mira start      # first run builds images, 5–15 minutes
sudo mira status
sudo mira doctor
```

### Pass criteria

- [ ] `https://chat.example.com/health` answers over **real HTTPS** with a valid
      Let's Encrypt certificate (not self-signed)
- [ ] `https://panel.example.com` loads the dashboard and login works
- [ ] `sudo mira doctor` reports every check green
- [ ] `sudo mira backup` produces a `.sql.gz`, and `sudo mira restore <file>` restores it
- [ ] **After `sudo reboot`, the stack comes back on its own** (the systemd unit)
- [ ] `/demo.html` returns **404** in production (it is gated on `NODE_ENV=production`)

### Report back

```bash
sudo mira doctor
curl -sI https://chat.example.com/health | head -5
sudo docker compose -f /opt/mira/app/docker-compose.yml logs caddy 2>&1 | grep -i certificate | tail -5
```

---

## Task 3 — The production dashboard image and public GHCR packages

**Why it blocks:** `Dockerfile.prod` and the runtime `config.js` injection were verified by
simulating the entrypoint in a browser, never by running the real nginx container.

### Run

```bash
docker build -f apps/dashboard/Dockerfile.prod -t mira-dashboard:test .
docker run --rm -p 8080:80 -e VITE_API_URL=https://chat.example.com mira-dashboard:test

# in another terminal:
curl -s http://localhost:8080/config.js
# expected: window.__MIRA_API_URL__ = 'https://chat.example.com';
```

### Make the three packages public

The `Docker Publish` workflow already pushes on every merge to `main`, but the packages are
**private by default** — anonymous pulls currently fail, so `mira setup`'s "prebuilt image"
option cannot work for anyone.

For each of `mira-api`, `mira-worker`, `mira-dashboard`:
**github.com/hami9?tab=packages** → package → **Package settings** → **Change visibility** →
Public.

Verify from a machine that is not logged in:

```bash
docker pull ghcr.io/hami9/mira-api:latest
```

### Pass criteria

- [ ] `config.js` contains the injected URL, not `localhost`
- [ ] The dashboard loads from the nginx container and the login request goes to the
      injected API address
- [ ] All three packages pull anonymously
- [ ] A full install using the "prebuilt images from GHCR" option in `mira setup` succeeds

---

## While you are at it

Two small chores that do not need a runbook but do need your account:

1. **Repository metadata** — the description is still `live chat by mira`. Something like
   _"Self-hosted AI-powered live chat support for WordPress/WooCommerce — a Goftino
   alternative. Persian-first, multi-tenant, AGPL-3.0."_ reads better on a public repo. Add
   topics (`self-hosted`, `ai`, `chatbot`, `woocommerce`, `customer-support`, `nestjs`,
   `rag`, `rtl`) and set the homepage to the Pages URL.
2. **GitHub Pages** — Settings → Pages → branch `main`, folder `/docs`. The landing page
   is built and committed but currently serves nothing.

## When all three pass

Update `AGENTS.md` §9 — items 1 through 4 of the "not tested" list come off, and Phase 1
of the roadmap unblocks.
