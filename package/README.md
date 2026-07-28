# package/ — packaging and installing Mira on a Linux server

**English** · [فارسی](README.fa.md)

> ⚠️ This directory is not `packages/` (the monorepo's npm packages) —
> it only holds the tooling that builds the server installation package.

| File / directory                 | Role                                                                     |
| -------------------------------- | ------------------------------------------------------------------------ |
| [`INSTALL.md`](INSTALL.md)       | **The full installation guide** — Debian, Ubuntu and other distributions |
| [`INSTALL.fa.md`](INSTALL.fa.md) | The same guide in Persian                                                |
| `build-deb.sh`                   | Builds the `mira_<version>_all.deb` package with dpkg-deb                |
| `install.sh`                     | Manual installer for non-deb distributions (Alma/Rocky/Fedora/…)         |
| `bin/mira`                       | The server management CLI (setup/start/status/logs/backup/doctor)        |
| `systemd/mira.service`           | The systemd service — starts the stack automatically after a reboot      |
| `debian/`                        | Debian package control files (control/postinst/prerm/postrm)             |
| `dist/`                          | Build output (not in git)                                                |

## Building the package

```bash
bash package/build-deb.sh
# output: package/dist/mira_<version>_all.deb
```

CI builds the same package on every version tag (`v*`) and attaches it to the GitHub
Release (the `.github/workflows/release.yml` workflow).

## Prebuilt images (GHCR)

Docker images for the three services are published automatically to the GitHub Container
Registry on every push to `main` and every version tag (the `docker-publish.yml` workflow):

```
ghcr.io/hami9/mira-api
ghcr.io/hami9/mira-worker
ghcr.io/hami9/mira-dashboard
```

To use them on a server: pick "prebuilt images from GHCR" during `mira setup`, or apply the
`docker-compose.ghcr.yml` overlay by hand. Details in [`INSTALL.md`](INSTALL.md).
