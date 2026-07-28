#!/bin/sh
# بک‌آپ روزانه‌ی Postgres با نگه‌داری N روز آخر.
# عمداً یک حلقه‌ی ساده‌ی sh است نه cron: کانتینر همیشه در حال اجراست و restart policy
# داکر خودش تضمین می‌کند بعد از ری‌استارت سرور دوباره بالا بیاید — بدون نیاز به cron جدا.
set -eu

RETENTION_DAYS="${BACKUP_RETENTION_DAYS:-14}"
INTERVAL_SECONDS=86400

echo "[backup] started — a backup every 24 hours, keeping ${RETENTION_DAYS} days"

while true; do
  TIMESTAMP=$(date -u +%Y%m%d-%H%M%S)
  OUTPUT="/backups/mira-${TIMESTAMP}.sql.gz"

  if pg_dump -h postgres -U "$POSTGRES_USER" -d "$POSTGRES_DB" | gzip > "$OUTPUT"; then
    echo "[backup] created: ${OUTPUT} ($(du -h "$OUTPUT" | cut -f1))"
  else
    echo "[backup] failed to create the backup" >&2
    rm -f "$OUTPUT"
  fi

  # حذف بک‌آپ‌های قدیمی‌تر از بازه‌ی نگه‌داری
  find /backups -name 'mira-*.sql.gz' -type f -mtime "+${RETENTION_DAYS}" -delete 2>/dev/null || true

  sleep "$INTERVAL_SECONDS"
done
