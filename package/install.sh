#!/usr/bin/env bash
# نصاب سراسری میرا برای توزیع‌های لینوکسی که پکیج .deb ندارند
# (AlmaLinux / Rocky / Fedora / openSUSE / ...) — روی دبیان/اوبونتو هم کار می‌کند
# ولی آن‌جا پکیج .deb توصیه می‌شود (package/build-deb.sh یا GitHub Releases).
#
# اجرا از ریشه‌ی ریپوی کلون‌شده:
#   sudo bash package/install.sh
set -euo pipefail

[ "$(id -u)" = "0" ] || { echo "Run as root: sudo bash package/install.sh"; exit 1; }

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
APP_DIR="/opt/mira/app"

command -v systemctl >/dev/null 2>&1 || { echo "This installer requires systemd."; exit 1; }

echo "— Installing Mira into $APP_DIR —"

# روی سیستم‌های deb-محور پیشنهاد بهتر را یادآوری کن (ولی جلوی ادامه را نگیر)
if command -v apt-get >/dev/null 2>&1; then
  echo "Note: on Debian/Ubuntu, installing the .deb package is cleaner:"
  echo "  bash package/build-deb.sh && sudo dpkg -i package/dist/mira_*_all.deb"
  echo "Continuing with the manual install in 5 seconds... (Ctrl+C to cancel)"
  sleep 5
fi

mkdir -p "$APP_DIR"
# کپی با tar تا وابستگی به rsync نباشد؛ .env و backups موجود دست نمی‌خورند
tar -C "$REPO_ROOT" -cf - \
  --exclude='./.git' \
  --exclude='./.claude' \
  --exclude='./.github' \
  --exclude='./package/dist' \
  --exclude='./backups' \
  --exclude='./wordpress-plugin/docker-compose.test.yml' \
  --exclude='./tests' \
  --exclude='./vitest.config.ts' \
  --exclude='node_modules' \
  --exclude='dist' \
  --exclude='.env' \
  . | tar -C "$APP_DIR" -xf -

install -D -m 755 "$SCRIPT_DIR/bin/mira" /usr/local/bin/mira
install -D -m 644 "$SCRIPT_DIR/systemd/mira.service" /etc/systemd/system/mira.service
install -D -m 644 "$SCRIPT_DIR/INSTALL.md" /usr/share/doc/mira/INSTALL.md
install -D -m 644 "$SCRIPT_DIR/INSTALL.fa.md" /usr/share/doc/mira/INSTALL.fa.md
systemctl daemon-reload

echo ""
echo "Mira installed ✔"
echo "Next step (first-time setup and secure secret generation):"
echo "    sudo mira setup"
echo "Full guide: /usr/share/doc/mira/INSTALL.md (Persian: INSTALL.fa.md)"
