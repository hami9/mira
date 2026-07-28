# راهنمای نصب میرا روی سرور لینوکس

[English](INSTALL.md) · **فارسی**

این راهنما نصب کامل **میرا** (پلتفرم چت پشتیبانی خودمیزبان با هوش مصنوعی) را روی یک سرور
لینوکسی توضیح می‌دهد — از صفر تا داشبورد آماده با SSL خودکار.

**توزیع‌های پشتیبانی‌شده:**

| توزیع                              | روش نصب                    |
| ---------------------------------- | -------------------------- |
| دبیان ۱۲ (Bookworm) و ۱۳ (Trixie)  | پکیج `.deb` ✅ (توصیه‌شده) |
| اوبونتو ۲۲.۰۴ / ۲۴.۰۴ و جدیدتر     | پکیج `.deb` ✅             |
| AlmaLinux / Rocky / Fedora         | اسکریپت `install.sh`       |
| هر توزیع دیگری با systemd و Docker | اسکریپت `install.sh`       |

> کل استک میرا داخل Docker اجرا می‌شود؛ بنابراین تفاوت توزیع‌ها فقط در «روش نصب پکیج» است،
> نه در اجرای خود برنامه — روی همه یکسان و قابل اتکا کار می‌کند.

---

## ۱. پیش‌نیازها

- یک سرور لینوکسی با حداقل **۲ گیگابایت RAM** و **۱۰ گیگابایت دیسک** (برای build ایمیج‌ها)
- دسترسی root (یا sudo)
- **دو رکورد DNS نوع A** که به IP سرور اشاره کنند:
  - `chat.example.com` → دامنه‌ی API و ویجت
  - `panel.example.com` → دامنه‌ی داشبورد اپراتور
- پورت‌های **۸۰ و ۴۴۳** باز (برای صدور خودکار گواهی SSL توسط Caddy/Let's Encrypt)
- Docker + افزونه‌ی Compose — اگر نصب نباشد، دستور `mira setup` خودش پیشنهاد نصب می‌دهد

نصب دستی Docker (در صورت تمایل، قبل از شروع):

```bash
curl -fsSL https://get.docker.com | sh
sudo systemctl enable --now docker
```

---

## ۲. نصب روی دبیان / اوبونتو (پکیج deb.)

### دریافت پکیج

از بخش [Releases گیت‌هاب](https://github.com/hami9/mira/releases) آخرین `mira_<version>_all.deb`
را دانلود کن، یا خودت از سورس بساز:

```bash
git clone https://github.com/hami9/mira.git
cd mira
bash package/build-deb.sh          # خروجی: package/dist/mira_<version>_all.deb
```

### نصب

```bash
sudo dpkg -i mira_*_all.deb || sudo apt -f install
```

پکیج این‌ها را نصب می‌کند:

| مسیر                                   | محتوا                                                 |
| -------------------------------------- | ----------------------------------------------------- |
| `/opt/mira/app`                        | سورس کامل میرا (ایمیج‌ها روی همین سرور build می‌شوند) |
| `/usr/bin/mira`                        | ابزار مدیریت (setup/start/status/logs/backup/...)     |
| `/usr/lib/systemd/system/mira.service` | سرویس systemd (شروع خودکار بعد از ریبوت)              |
| `/usr/share/doc/mira/INSTALL.fa.md`    | همین راهنما (نسخه‌ی انگلیسی: `INSTALL.md`)            |

### راه‌اندازی اولیه

```bash
sudo mira setup
```

این دستور تعاملی:

- دامنه‌ها، ایمیل SSL و ایمیل ادمین را می‌پرسد
- **همه‌ی رمزها و کلیدها را به‌صورت تصادفی امن تولید می‌کند** (رمز دیتابیس، JWT، کلید ویجت،
  کلید API وردپرس و رمز ادمین)
- تنظیمات را در `/etc/mira/mira.env` می‌نویسد (فقط قابل خواندن توسط root)
- **اطلاعات ورود ادمین را فقط همین یک بار نمایش می‌دهد** — همان لحظه ذخیره‌شان کن!

### بالا آوردن

```bash
sudo mira start      # بار اول چند دقیقه طول می‌کشد (build ایمیج‌ها)
sudo mira status     # وضعیت کانتینرها + سلامت API
```

بعد از سبز شدن همه‌چیز:

- داشبورد اپراتور: `https://panel.example.com`
- بررسی سلامت API: `https://chat.example.com/health`

گواهی SSL خودکار توسط Caddy گرفته و تمدید می‌شود — نه certbot لازم است نه cron.

### نصب خیلی سریع‌تر با ایمیج آماده (اختیاری)

ایمیج‌های Docker میرا با هر نسخه به‌صورت خودکار در
[GitHub Packages](https://github.com/hami9?tab=packages&repo_name=mira) ‏(ghcr.io) منتشر می‌شوند:
`mira-api`، `mira-worker`، `mira-dashboard`.

هنگام `mira setup` اگر گزینه‌ی **«ایمیج آماده از GHCR»** را انتخاب کنی، `mira start` به‌جای
build چند دقیقه‌ای از سورس، ایمیج‌ها را در ۱–۲ دقیقه pull می‌کند و به RAM کمتری هم نیاز دارد.
نسخه‌ی ایمیج را می‌توانی با `MIRA_IMAGE_TAG` در `/etc/mira/mira.env` قفل کنی (پیش‌فرض `latest`).

> ⚠️ دسترسی به `ghcr.io` از بعضی سرورهای داخل ایران ممکن است محدود/مسدود باشد.
> اگر `mira start` در مرحله‌ی pull گیر کرد، دوباره `sudo mira setup` را اجرا کن و
> گزینه‌ی ۱ (build از سورس) را انتخاب کن — این مسیر به هیچ registry خارجی وابسته نیست.

---

## ۳. نصب روی AlmaLinux / Rocky / Fedora / سایر توزیع‌ها

```bash
git clone https://github.com/hami9/mira.git
cd mira
sudo bash package/install.sh
sudo mira setup
sudo mira start
```

`install.sh` همان چیدمان پکیج deb را دستی برقرار می‌کند (`/opt/mira/app` + دستور `mira` +
سرویس systemd). اگر Docker نصب نیست، `mira setup` نصبش را پیشنهاد می‌دهد
(اسکریپت رسمی get.docker.com روی همه‌ی این توزیع‌ها کار می‌کند).

---

## ۴. اتصال فروشگاه وردپرس/ووکامرس

1. پوشه‌ی `wordpress-plugin/mira` را (به‌صورت zip) در وردپرس نصب و فعال کن.
2. در **تنظیمات → میرا** در پیشخوان وردپرس:
   - آدرس بک‌اند: `https://chat.example.com`
   - کلید ویجت و کلید API: همان‌هایی که `mira setup` نمایش داد
3. در داشبورد میرا → تنظیمات → «اتصال وردپرس/ووکامرس»، آدرس سایت وردپرس و همان کلید API را وارد کن.
4. مطمئن شو دامنه‌ی فروشگاه در `SEED_ALLOWED_DOMAINS` (هنگام setup) وارد شده — وگرنه ویجت
   به دلیل بررسی Origin بارگذاری نمی‌شود. برای تغییر بعدی: `/etc/mira/mira.env` را ویرایش کن
   یا از داشبورد، دامنه‌های مجاز سایت را به‌روز کن.

## ۵. فعال‌سازی هوش مصنوعی (اختیاری)

فایل `/etc/mira/mira.env` را ویرایش کن:

```bash
# با Gemini (از طریق سازگاری OpenAI):
OPENAI_API_KEY=<کلید تو>
OPENAI_BASE_URL=https://generativelanguage.googleapis.com/v1beta/openai/
OPENAI_MODEL=gemini-2.0-flash
OPENAI_EMBEDDING_MODEL=gemini-embedding-001
```

سپس: `sudo mira restart`

---

## ۶. مدیریت روزمره

```bash
sudo mira status            # وضعیت سرویس‌ها
sudo mira logs api          # لاگ زنده‌ی هر سرویس (api, worker, dashboard, postgres, caddy)
sudo mira backup            # بک‌آپ فوری دیتابیس
sudo mira restore <file>    # بازگردانی
sudo mira doctor            # عیب‌یابی خودکار
sudo mira stop / restart    # توقف / اعمال تغییرات تنظیمات
```

- **بک‌آپ خودکار:** روزانه در `/opt/mira/app/backups` با نگه‌داری ۱۴ روز (سرویس `postgres_backup`).
- **شروع خودکار بعد از ریبوت:** با اولین `mira start` فعال می‌شود (`systemctl enable mira`).

## ۷. به‌روزرسانی نسخه

```bash
sudo dpkg -i mira_<نسخه جدید>_all.deb   # یا: git pull + install.sh در روش دستی
sudo mira update
```

مایگریشن‌های دیتابیس **خودکار و بدون از دست رفتن داده** پیش از بالا آمدن api اجرا می‌شوند
(اسکیما فقط با مایگریشن‌های نسخه‌بندی‌شده تغییر می‌کند — synchronize همیشه خاموش است).

## ۸. حذف

```bash
sudo apt remove mira        # حذف برنامه — تنظیمات و داده‌ها می‌مانند
sudo apt purge mira         # + حذف تنظیمات (/etc/mira)
# حذف کامل داده‌ها (برگشت‌ناپذیر!):
cd /opt/mira/app && sudo docker compose down -v
```

---

## ۹. عیب‌یابی

| علامت                                    | علت محتمل                                       | راه‌حل                                                 |
| ---------------------------------------- | ----------------------------------------------- | ------------------------------------------------------ |
| `mira start` طولانی شد                   | build اولیه‌ی ایمیج‌هاست                        | طبیعی است (۵–۱۵ دقیقه بار اول)                         |
| کانتینر `mira_api` مدام ری‌استارت می‌شود | `SEED_ADMIN_PASSWORD` خالی در production        | `sudo mira doctor` — سپس `sudo mira setup` دوباره      |
| گواهی SSL صادر نمی‌شود                   | DNS هنوز propagate نشده یا پورت ۸۰/۴۴۳ بسته است | `sudo mira doctor` و `sudo mira logs caddy`            |
| ویجت روی سایت لود نمی‌شود                | دامنه‌ی سایت در دامنه‌های مجاز نیست             | دامنه را در داشبورد یا `SEED_ALLOWED_DOMAINS` اضافه کن |
| لاگین داشبورد برای همیشه هنگ می‌کند      | اتصال مرده‌ی pool دیتابیس                       | `sudo mira restart` — اگر تکرار شد `mira logs api`     |
| «no space left on device» هنگام build    | دیسک پر                                         | `docker system prune -a` و فضای بیشتر                  |

اگر مشکل حل نشد، خروجی این‌ها را در issue گیت‌هاب بگذار:

```bash
sudo mira doctor
sudo mira logs api | tail -50
```
