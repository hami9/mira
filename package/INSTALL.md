# Installing Mira on a Linux server

**English** · [فارسی](INSTALL.fa.md)

This guide covers a complete installation of **Mira** (the self-hosted AI-powered live chat
support platform) on a Linux server — from nothing to a working dashboard with automatic SSL.

**Supported distributions:**

| Distribution                                   | Installation method             |
| ---------------------------------------------- | ------------------------------- |
| Debian 12 (Bookworm) and 13 (Trixie)           | `.deb` package ✅ (recommended) |
| Ubuntu 22.04 / 24.04 and newer                 | `.deb` package ✅               |
| AlmaLinux / Rocky / Fedora                     | the `install.sh` script         |
| Any other distribution with systemd and Docker | the `install.sh` script         |

> The whole Mira stack runs inside Docker, so the distribution only changes _how the package
> is installed_, not how the application runs — it behaves identically everywhere.

---

## 1. Requirements

- A Linux server with at least **2 GB RAM** and **10 GB disk** (for building the images)
- root access (or sudo)
- **Two DNS A records** pointing at the server's IP:
  - `chat.example.com` → the API and widget domain
  - `panel.example.com` → the operator dashboard domain
- Ports **80 and 443** open (so Caddy/Let's Encrypt can issue certificates automatically)
- Docker + the Compose plugin — if it is missing, `mira setup` offers to install it

Installing Docker manually beforehand, if you prefer:

```bash
curl -fsSL https://get.docker.com | sh
sudo systemctl enable --now docker
```

---

## 2. Installing on Debian / Ubuntu (the .deb package)

### Get the package

Download the latest `mira_<version>_all.deb` from
[GitHub Releases](https://github.com/hami9/mira/releases), or build it from source yourself:

```bash
git clone https://github.com/hami9/mira.git
cd mira
bash package/build-deb.sh          # output: package/dist/mira_<version>_all.deb
```

### Install

```bash
sudo dpkg -i mira_*_all.deb || sudo apt -f install
```

The package installs:

| Path                                   | Contents                                                  |
| -------------------------------------- | --------------------------------------------------------- |
| `/opt/mira/app`                        | The full Mira source (images are built on this server)    |
| `/usr/bin/mira`                        | The management tool (setup/start/status/logs/backup/…)    |
| `/usr/lib/systemd/system/mira.service` | The systemd service (starts automatically after a reboot) |
| `/usr/share/doc/mira/INSTALL.md`       | This guide (plus `INSTALL.fa.md` in Persian)              |

### First-time setup

```bash
sudo mira setup
```

This interactive command:

- Asks for the domains, the SSL email and the admin email
- **Generates every password and key as a secure random value** (database password, JWT
  secrets, widget key, WordPress API key and the admin password)
- Writes the configuration to `/etc/mira/mira.env` (readable by root only)
- **Displays the admin credentials exactly once** — save them right then!

### Bringing it up

```bash
sudo mira start      # the first run takes a few minutes (building the images)
sudo mira status     # container status + API health
```

Once everything is green:

- Operator dashboard: `https://panel.example.com`
- API health check: `https://chat.example.com/health`

Caddy obtains and renews the SSL certificate automatically — no certbot, no cron job.

### A much faster install with prebuilt images (optional)

Mira's Docker images are published automatically with every release to
[GitHub Packages](https://github.com/hami9?tab=packages&repo_name=mira) (ghcr.io):
`mira-api`, `mira-worker`, `mira-dashboard`.

If you pick **"prebuilt images from GHCR"** during `mira setup`, then `mira start` pulls the
images in 1–2 minutes instead of building from source for several minutes, and needs less
RAM. You can pin the image version with `MIRA_IMAGE_TAG` in `/etc/mira/mira.env` (the
default is `latest`).

> ⚠️ Access to `ghcr.io` is restricted or blocked from some networks. If `mira start` hangs
> during the pull, run `sudo mira setup` again and choose option 1 (build from source) —
> that path does not depend on any external registry.

---

## 3. Installing on AlmaLinux / Rocky / Fedora / other distributions

```bash
git clone https://github.com/hami9/mira.git
cd mira
sudo bash package/install.sh
sudo mira setup
sudo mira start
```

`install.sh` reproduces the same layout as the deb package by hand (`/opt/mira/app` + the
`mira` command + the systemd service). If Docker is not installed, `mira setup` offers to
install it (the official get.docker.com script works on all of these distributions).

---

## 4. Connecting a WordPress/WooCommerce shop

1. Install and activate the `wordpress-plugin/mira` directory (as a zip) in WordPress.
2. In **Settings → Mira** in the WordPress admin:
   - Backend URL: `https://chat.example.com`
   - Widget key and API key: the ones `mira setup` displayed
3. In the Mira dashboard → Settings → "WordPress/WooCommerce connection", enter the
   WordPress site URL and the same API key.
4. Make sure the shop's domain was entered in `SEED_ALLOWED_DOMAINS` during setup —
   otherwise the widget will not load, because of the Origin check. To change it later,
   edit `/etc/mira/mira.env` or update the site's allowed domains from the dashboard.

## 5. Enabling AI (optional)

Edit `/etc/mira/mira.env`:

```bash
# With Gemini (through its OpenAI compatibility layer):
OPENAI_API_KEY=<your key>
OPENAI_BASE_URL=https://generativelanguage.googleapis.com/v1beta/openai/
OPENAI_MODEL=gemini-2.0-flash
OPENAI_EMBEDDING_MODEL=gemini-embedding-001
```

Then: `sudo mira restart`

---

## 6. Day-to-day management

```bash
sudo mira status            # service status
sudo mira logs api          # follow any service's log (api, worker, dashboard, postgres, caddy)
sudo mira backup            # immediate database backup
sudo mira restore <file>    # restore
sudo mira doctor            # automatic diagnostics
sudo mira stop / restart    # stop / apply configuration changes
```

- **Automatic backups:** daily into `/opt/mira/app/backups`, keeping 14 days (the
  `postgres_backup` service).
- **Start on boot:** enabled by the first `mira start` (`systemctl enable mira`).

## 7. Updating

```bash
sudo dpkg -i mira_<new version>_all.deb   # or: git pull + install.sh for the manual method
sudo mira update
```

Database migrations run **automatically and without data loss** before the api starts (the
schema only ever changes through versioned migrations — `synchronize` is always off).

## 8. Uninstalling

```bash
sudo apt remove mira        # remove the application — configuration and data stay
sudo apt purge mira         # + remove the configuration (/etc/mira)
# remove all data (irreversible!):
cd /opt/mira/app && sudo docker compose down -v
```

---

## 9. Troubleshooting

| Symptom                                   | Likely cause                                     | Fix                                                  |
| ----------------------------------------- | ------------------------------------------------ | ---------------------------------------------------- |
| `mira start` takes a long time            | It is the initial image build                    | Normal (5–15 minutes the first time)                 |
| The `mira_api` container keeps restarting | `SEED_ADMIN_PASSWORD` is empty in production     | `sudo mira doctor`, then run `sudo mira setup` again |
| The SSL certificate is not issued         | DNS has not propagated, or port 80/443 is closed | `sudo mira doctor` and `sudo mira logs caddy`        |
| The widget does not load on the site      | The site's domain is not in the allowed domains  | Add it in the dashboard or in `SEED_ALLOWED_DOMAINS` |
| Dashboard login hangs forever             | A dead database pool connection                  | `sudo mira restart` — if it recurs, `mira logs api`  |
| "no space left on device" during build    | The disk is full                                 | `docker system prune -a` and free up more space      |

If that does not solve it, include the output of these in a GitHub issue:

```bash
sudo mira doctor
sudo mira logs api | tail -50
```
