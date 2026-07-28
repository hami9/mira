# package/ — بسته‌بندی و نصب میرا روی سرور لینوکس

[English](README.md) · **فارسی**

> ⚠️ این پوشه با `packages/` (پکیج‌های npm مونوریپو) فرق دارد —
> این‌جا فقط ابزارهای ساخت پکیج نصب سرور است.

| فایل/پوشه                        | نقش                                                                |
| -------------------------------- | ------------------------------------------------------------------ |
| [`INSTALL.fa.md`](INSTALL.fa.md) | **راهنمای کامل نصب فارسی** — دبیان، اوبونتو و سایر توزیع‌ها        |
| [`INSTALL.md`](INSTALL.md)       | همان راهنما به انگلیسی (نسخه‌ی اصل)                                |
| `build-deb.sh`                   | ساخت پکیج `mira_<version>_all.deb` با dpkg-deb                     |
| `install.sh`                     | نصاب دستی برای توزیع‌های غیر deb (Alma/Rocky/Fedora/...)           |
| `bin/mira`                       | ابزار خط فرمان مدیریت سرور (setup/start/status/logs/backup/doctor) |
| `systemd/mira.service`           | سرویس systemd — شروع خودکار استک بعد از ریبوت                      |
| `debian/`                        | فایل‌های کنترل پکیج دبیان (control/postinst/prerm/postrm)          |
| `dist/`                          | خروجی build (در گیت نیست)                                          |

## ساخت سریع پکیج

```bash
bash package/build-deb.sh
# خروجی: package/dist/mira_<version>_all.deb
```

در CI هم با هر tag نسخه (`v*`)، همین پکیج ساخته و به GitHub Release پیوست می‌شود
(workflow ‏`.github/workflows/release.yml`).

## ایمیج‌های آماده (GHCR)

ایمیج‌های Docker سه سرویس با هر push به `main` و هر tag نسخه، خودکار در
GitHub Container Registry منتشر می‌شوند (workflow ‏`docker-publish.yml`):

```
ghcr.io/hami9/mira-api
ghcr.io/hami9/mira-worker
ghcr.io/hami9/mira-dashboard
```

استفاده روی سرور: در `mira setup` گزینه‌ی «ایمیج آماده از GHCR» — یا دستی با
لایه‌ی `docker-compose.ghcr.yml`. جزئیات در [`INSTALL.fa.md`](INSTALL.fa.md).
