# package/ — بسته‌بندی و نصب میرا روی سرور لینوکس

> ⚠️ این پوشه با `packages/` (پکیج‌های npm مونوریپو) فرق دارد —
> این‌جا فقط ابزارهای ساخت پکیج نصب سرور است.

| فایل/پوشه | نقش |
|---|---|
| [`INSTALL.fa.md`](INSTALL.fa.md) | **راهنمای کامل نصب فارسی** — دبیان، اوبونتو و سایر توزیع‌ها |
| `build-deb.sh` | ساخت پکیج `mira_<version>_all.deb` با dpkg-deb |
| `install.sh` | نصاب دستی برای توزیع‌های غیر deb (Alma/Rocky/Fedora/...) |
| `bin/mira` | ابزار خط فرمان مدیریت سرور (setup/start/status/logs/backup/doctor) |
| `systemd/mira.service` | سرویس systemd — شروع خودکار استک بعد از ریبوت |
| `debian/` | فایل‌های کنترل پکیج دبیان (control/postinst/prerm/postrm) |
| `dist/` | خروجی build (در گیت نیست) |

## ساخت سریع پکیج

```bash
bash package/build-deb.sh
# خروجی: package/dist/mira_<version>_all.deb
```

در CI هم با هر tag نسخه (`v*`)، همین پکیج ساخته و به GitHub Release پیوست می‌شود
(workflow ‏`.github/workflows/release.yml`).
