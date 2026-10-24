# Hosting Mira

**English** · [فارسی](HOSTING.fa.md)

All features in the self-hosted distribution are free of Mira subscriptions and activation keys.
Pay your hosting and AI provider separately. Copyright: **hami9 — https://hami9.ir**.
See [NOTICE](../NOTICE) and the existing AGPL-3.0 license; the WordPress plugin remains GPLv2+.

## Choose an installation

| Hosting capabilities                                                                                        | Installation                                                                                       |
| ----------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| Linux server with Docker                                                                                    | Standalone low-resource Compose file; existing web server terminates HTTPS                         |
| cPanel / DirectAdmin with Node.js, npm installation, persistent child processes, PostgreSQL + vector, Redis | Upload the hosting archive and start `app.cjs` from the panel; no customer SSH required            |
| Ordinary PHP/MySQL shared hosting                                                                           | Upload the WordPress plugin or paste the widget code; run the Mira backend on another capable host |

The control-panel brand alone does not provide Node.js, PostgreSQL, Redis, WebSockets or permission
to run workers. Ask the provider to confirm these before choosing the full backend installation.
Mira is not a PHP/MySQL application. This release does not implement a second PHP backend.

## Low-resource server

`docker-compose.lite.yml` is a **standalone** file, not an overlay. It starts PostgreSQL, Redis,
the API (including the static dashboard), and the separate queue worker. MinIO is reserved for
future attachments and is not started; the Vite development server and separate nginx/Caddy
containers are unnecessary. No self-hosted feature is paywalled in this profile.

With the Debian package, run `sudo mira setup --lite`, then `sudo mira start`. Existing
installations should back up their database and configuration first; `setup` replaces the
configuration, and the lite Compose project must retain the existing project/volume names.
Do not run setup again merely to tune an existing installation. The CLI supports
`mira resources`, `mira backup`, `mira restore`, and `mira doctor` for this profile.

For a source checkout, copy `.env.example` to `.env`, set production credentials and seed values,
and point `DATABASE_URL` at `postgres:5432`. Set `PUBLIC_API_URL`, `DASHBOARD_URL` and
`CORS_ALLOWED_ORIGINS` to the same public HTTPS origin. Include the shop and Mira origins in
`SEED_ALLOWED_DOMAINS`. Then:

```bash
docker compose -f docker-compose.lite.yml up -d --build
# Use images from a release containing this profile to avoid building on the server:
docker compose -f docker-compose.lite.yml up -d --no-build
docker compose -f docker-compose.lite.yml stats --no-stream
```

Default container memory ceilings are API 384 MiB, worker 256 MiB, PostgreSQL 384 MiB, Redis
192 MiB (1,216 MiB combined). These are limits, **not measured consumption or reserved memory**.
Start with a server that has at least 2 GiB available for Mira and the OS; leave additional
headroom for the website and other programs. Builds need extra memory; prefer prebuilt images
on a busy server. Measure your own workload before lowering the limits.

`API_DB_POOL_MAX=5`, `WORKER_DB_POOL_MAX=3`, `WORKER_CONCURRENCY=2` are the runtime defaults.
Concurrency is shared across all five queues. Container ceilings can be changed with
`API_MEMORY_LIMIT`, `WORKER_MEMORY_LIMIT`, `POSTGRES_MEMORY_LIMIT`, `REDIS_MEMORY_LIMIT` and
the corresponding `*_CPU_LIMIT` variables. Redis uses persistence and `noeviction`: when full,
writes fail instead of silently deleting queued jobs. Increase capacity before it fills.
Logs rotate at 5 MiB with two files per container. Conversation history is never automatically
deleted to meet a memory target. Back up PostgreSQL regularly; this profile does not run the
separate scheduled-backup container from the production overlay.

The only exposed port is `127.0.0.1:3300`, configurable with `MIRA_HTTP_PORT`. Database and
Redis ports are private. It does not occupy 80/443 or modify an existing website. For example,
add a **new hostname** to an existing Caddy installation:

```caddy
chat.example.com {
    reverse_proxy 127.0.0.1:3300
}
```

Or add this to a separate nginx virtual host that already has HTTPS configured:

```nginx
location / {
    proxy_pass http://127.0.0.1:3300;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_read_timeout 120s;
}
```

The address can be a subdomain of the shop, a different domain, or the provider's HTTPS
hostname. Mira does not require a particular domain or sell domain names. Root-origin
deployment is supported; mounting the whole application under `/mira` is not supported.
Local HTTP/IP access is suitable for private testing. Public installs need HTTPS for secure
login and browser features. With multiple installations, use distinct Compose project names,
ports and volumes; do not share a PostgreSQL database or queue namespace.

## cPanel / DirectAdmin without SSH

Build the archive on a development computer with `npm ci && npm run package:hosting`, or
download `mira-hosting-<version>.tar.gz` from a release that includes it. Compiled JavaScript,
dashboard, widget, migrations, license notices and configuration helper are included; production
npm dependencies are installed on the host, with no TypeScript build required there.

1. Extract the archive on your computer. Open `mira/configure.html` locally, enter a dedicated
   empty PostgreSQL database (pgvector must be installed), Redis credentials, shop name, admin
   credentials and public HTTPS address. Download `mira.env`. This page makes no network requests.
2. In File Manager, upload/extract the archive into a private application directory **outside
   `public_html`**. Upload `mira.env` there and rename it `.env`; restrict file permissions to
   the application owner. Never serve the whole archive as static website files.
3. cPanel: open **Application Manager** or the provider's **Setup Node.js App**. Select Node.js
   22.12 or newer, production mode, the private application root, and startup file `app.cjs`.
   Register the HTTPS hostname at its root. Use **Enable Dependencies / Run NPM Install**.
   If the panel fixes the startup name to `app.js`, rename `app.cjs` to `app.js` (the package
   uses CommonJS). The hosting package's `.npmrc` omits development dependencies.
4. DirectAdmin: use the provider's **Setup Node.js App** when offered; select the same root
   and startup file, install npm dependencies, and start/restart. DirectAdmin's Nginx Unit
   alternative requires a provider-installed Node runtime, working dependency installation
   and a compatible Unit launcher; **the Passenger-style launcher has not been certified on
   Unit**. Do not assume a Unit menu alone makes this archive compatible.
5. Set `NODE_OPTIONS=--max-old-space-size=256` in the panel. Require one always-on application
   instance, child-process permission and WebSocket support (or working Socket.IO polling with
   sticky sessions). Disable idle suspension through the provider. If the host disallows this,
   place the backend elsewhere; cron requests are not a substitute for a persistent worker.
6. Start/restart the application. `app.cjs` runs compiled migrations and initial seed before
   starting the API and a separate queue worker. Open `/health`, then `/` to sign in. The
   dashboard, API, widget and `/chat.html?key=...` share the same origin. The panel manages SSL.
7. In Mira settings, copy the site ID into `SYSTEM_SITE_ID` in the private `.env`, then restart
   to enable host metrics. If using AvalAI, set its key and `AVALAI_SITE_ID` similarly.

Keep `.env`, the database, and Redis persistence when updating. Back up first; replace compiled
application files, rerun production dependency installation, and restart. Never use a fresh
seed key or an empty database as an update mechanism.

Official provider references: [cPanel Application Manager](https://docs.cpanel.net/cpanel/software/application-manager/),
[DirectAdmin Nginx Unit](https://docs.directadmin.com/webservices/nginx_unit/), and
[Passenger application lifecycle](https://www.phusionpassenger.com/docs/advanced_guides/config_and_optimization/standalone/optimization.html).
The bundle is a capability-dependent installation path. A real cPanel/DirectAdmin account and
provider-specific process/SSL rules still require deployment verification.

## Connect and customize

In **Settings → Installation and customization**, edit allowed origins, widget color and position,
copy the embed snippet or direct chat link. Add Mira's own origin to the site's allowed origins
to enable the direct link. Assistant identity, greeting, suggested questions, knowledge sources,
guardrails and model settings are available in the AI section. These controls are site-scoped.

Install the WordPress ZIP through **Plugins → Add New → Upload** on cPanel, DirectAdmin or any
WordPress hosting. Enter the backend URL and widget key; no SSH is needed on the website host.
This connects that website to the backend; it does not install Node.js inside WordPress.

**Settings → System resources** reports API/worker RSS memory and CPU, database size and runtime
limits on demand. It requires a fresh database admin role and an exact `SYSTEM_SITE_ID` match;
ordinary site admins cannot inspect another installation owner's metrics. No Docker socket,
remote shell, paid control plane or external telemetry service is used.
