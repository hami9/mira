#!/usr/bin/env bash
# ساخت پکیج دبیان میرا: mira_<version>_all.deb
# اجرا از ریشه‌ی ریپو یا از داخل package/ — خروجی در package/dist/
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
OUT_DIR="$SCRIPT_DIR/dist"

command -v dpkg-deb >/dev/null 2>&1 || { echo "dpkg-deb is required (on Debian/Ubuntu: apt install dpkg)"; exit 1; }

VERSION=$(sed -n 's/.*"version": "\([^"]*\)".*/\1/p' "$REPO_ROOT/package.json" | head -1)
[ -n "$VERSION" ] || { echo "Could not read the version from package.json"; exit 1; }

STAGING=$(mktemp -d)
trap 'rm -rf "$STAGING"' EXIT

echo "Building the mira package, version $VERSION ..."

# ---------- payload: سورس کامل در /opt/mira/app ----------
# (ایمیج‌های داکر روی خود سرور build می‌شوند، پس کل سورس لازم است)
# کپی با tar (نه rsync) تا روی هر سیستمی بدون وابستگی اضافه کار کند
APP_DEST="$STAGING/opt/mira/app"
mkdir -p "$APP_DEST"
tar -C "$REPO_ROOT" -cf - \
  --exclude='./.git' \
  --exclude='./.claude' \
  --exclude='./.github' \
  --exclude='./package/dist' \
  --exclude='./backups' \
  --exclude='./wordpress-plugin/docker-compose.test.yml' \
  --exclude='./tests' \
  --exclude='./vitest.config.ts' \
  --exclude='./playwright.config.ts' \
  --exclude='./playwright-report' \
  --exclude='./test-results' \
  --exclude='node_modules' \
  --exclude='dist' \
  --exclude='.env' \
  . | tar -C "$APP_DEST" -xf -

# ---------- CLI و سرویس systemd ----------
install -D -m 755 "$SCRIPT_DIR/bin/mira" "$STAGING/usr/bin/mira"
install -D -m 644 "$SCRIPT_DIR/systemd/mira.service" "$STAGING/usr/lib/systemd/system/mira.service"

# ---------- مستندات ----------
install -D -m 644 "$SCRIPT_DIR/INSTALL.md" "$STAGING/usr/share/doc/mira/INSTALL.md"
install -D -m 644 "$SCRIPT_DIR/INSTALL.fa.md" "$STAGING/usr/share/doc/mira/INSTALL.fa.md"
install -D -m 644 "$REPO_ROOT/LICENSE" "$STAGING/usr/share/doc/mira/copyright" 2>/dev/null || \
  echo "AGPL-3.0 — https://github.com/hami9/mira" > "$STAGING/usr/share/doc/mira/copyright"

# ---------- فایل‌های کنترل دبیان ----------
mkdir -p "$STAGING/DEBIAN"
sed "s/__VERSION__/$VERSION/" "$SCRIPT_DIR/debian/control.template" > "$STAGING/DEBIAN/control"
install -m 755 "$SCRIPT_DIR/debian/postinst" "$STAGING/DEBIAN/postinst"
install -m 755 "$SCRIPT_DIR/debian/prerm" "$STAGING/DEBIAN/prerm"
install -m 755 "$SCRIPT_DIR/debian/postrm" "$STAGING/DEBIAN/postrm"

# اندازه‌ی نصب‌شده (کیلوبایت) برای هدر control
INSTALLED_SIZE=$(du -sk "$STAGING" | cut -f1)
echo "Installed-Size: $INSTALLED_SIZE" >> "$STAGING/DEBIAN/control"

mkdir -p "$OUT_DIR"
DEB_PATH="$OUT_DIR/mira_${VERSION}_all.deb"
dpkg-deb --build --root-owner-group "$STAGING" "$DEB_PATH" >/dev/null

echo "✔ Built: $DEB_PATH"
dpkg-deb --info "$DEB_PATH" | sed -n '2,12p'
echo
echo "Install on a Debian/Ubuntu server:"
echo "  sudo dpkg -i $(basename "$DEB_PATH") || sudo apt -f install"
echo "  sudo mira setup && sudo mira start"
