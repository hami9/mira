#!/bin/sh
# هنگام start کانتینر nginx اجرا می‌شود (مکانیزم استاندارد /docker-entrypoint.d ایمیج رسمی nginx).
# آدرس عمومی API را از env داخل config.js می‌گذارد تا ایمیجِ ازپیش‌ساخته (GHCR) روی هر دامنه‌ای کار کند.
set -eu

CONFIG_FILE=/usr/share/nginx/html/config.js

if [ -n "${VITE_API_URL:-}" ]; then
  # فقط کاراکترهای امنِ یک URL را نگه می‌داریم تا تزریق JS ممکن نباشد
  SAFE_URL=$(printf '%s' "$VITE_API_URL" | tr -cd 'A-Za-z0-9:/._~%-')
  printf 'window.__MIRA_API_URL__ = "%s";\n' "$SAFE_URL" > "$CONFIG_FILE"
  echo "میرا: آدرس API زمان اجرا تنظیم شد: $SAFE_URL"
fi
