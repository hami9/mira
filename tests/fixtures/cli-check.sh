#!/usr/bin/env bash
set -euo pipefail

# فقط کانتینر خالیِ تست؛ فایل تنظیمات نصب واقعی نباید لمس شود.
[ "${MIRA_CLI_FIXTURE:-}" = "1" ] && [ -f /.dockerenv ] && [ ! -e /etc/mira/mira.env ] || exit 1
mkdir -p /etc/mira /opt/mira/app
cat > /etc/mira/mira.env <<'EOF'
NODE_ENV='production'
SEED_ADMIN_PASSWORD='fixture only'
SEED_SITE_NAME=Example Shop
APP_DOMAIN=chat.example.com
DASHBOARD_DOMAIN=panel.example.com
UNTRUSTED=$(touch /tmp/mira-env-executed)
EOF
bash /repo/package/bin/mira doctor > /tmp/mira-doctor.out 2>&1
test ! -e /tmp/mira-env-executed
grep -q 'Docker or the compose plugin is not available' /tmp/mira-doctor.out
echo 'CLI dotenv parsing check passed.'
