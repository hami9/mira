# راهنمای اجرایی فاز ۰ — سه کاری که سخت‌افزار واقعی می‌خواهد

[English](PHASE0-RUNBOOK.md) · **فارسی**

فاز ۰ در [`ROADMAP.fa.md`](../ROADMAP.fa.md) بلوک‌کننده است: تا وقتی استک موجود واقعاً
اجرا نشده، هیچ فاز بعدی نباید شروع شود. بند ۴ (هارنس تست) و بند ۵ (پاکسازی) انجام شده‌اند.
سه بند زیر از داخل sandbox قابل خودکارسازی نیستند — به یک سایت وردپرس واقعی، یک سرور با
دامنه‌ی واقعی، و یک daemon داکر نیاز دارند.

هر بخش می‌گوید چه چیزی را اجرا کن، «قبولی» یعنی چه، و **چه چیزی را برگردان** تا نتیجه در
`AGENTS.fa.md` بخش ۹ و issue ردیاب فاز ۰ ثبت شود.

---

## بند ۱ — نصب افزونه روی یک ووکامرس واقعی

**چرا بلوک‌کننده است:** کل قابلیت‌های نوشتنِ تجاری (فاز ۳) تا وقتی سمت خواندن روی وردپرس
واقعی اثبات نشده، حدس‌وگمان است. توجه: باگ ۸ بخش ۶ `AGENTS.fa.md` یعنی این مسیر تا نسخه‌ی
۱.۱.۰ اصلاً نمی‌توانست کار کند — رفعش با سرور ماک تأیید شده، نه با ووکامرس واقعی.

### گزینه‌ی الف — سایت یک‌بارمصرفی که از قبل در مخزن است (سریع‌ترین)

```bash
cd wordpress-plugin
docker compose -f docker-compose.test.yml up -d

docker compose -f docker-compose.test.yml run --rm wpcli core install \
  --url=http://localhost:8081 --title="KG Kala Test" \
  --admin_user=admin --admin_password=admin123 \
  --admin_email=admin@example.test --skip-email

docker compose -f docker-compose.test.yml run --rm wpcli plugin install woocommerce --activate
docker compose -f docker-compose.test.yml run --rm wpcli plugin activate mira
```

### گزینه‌ی ب — یک فروشگاه staging موجود

فایل `mira-wordpress-plugin.zip` را از
[آخرین ریلیز](https://github.com/hami9/mira/releases/latest) بگیر و از مسیر
**افزونه‌ها ← افزودن ← بارگذاری** نصب و فعال کن.

### تنظیم

۱. پیشخوان وردپرس ← **تنظیمات ← میرا**: آدرس بک‌اند، کلید ویجت و کلید API (همان‌هایی که
`mira setup` نشان داد).
۲. داشبورد میرا ← **تنظیمات ← اتصال وردپرس/ووکامرس**: آدرس فروشگاه و همان کلید API.
۳. یک مشتری با ایمیل واقعی بساز و **دو** سفارش برایش ثبت کن.
۴. با همان کاربر واردشده، فرانت فروشگاه را باز کن و یک گفتگو شروع کن.

### معیار قبولی

- [ ] صفحه‌ی تنظیمات درست رندر می‌شود (RTL، هدر برند، انتخاب‌گر رنگ کار می‌کند)
- [ ] اسکریپت ویجت در فرانت هست و در `/wp-admin/` **نیست**
- [ ] با curl: بدون کلید یا کلید غلط `401`، با کلید درست `200`
- [ ] **پنل مشتری کنار گفتگو در میرا مجموع خرید، وضعیت آخرین سفارش و تاریخچه را نشان
      می‌دهد** — همان چیزی که تا امروز هرگز کار نکرده
- [ ] برای کاربر واردشده، نام و ایمیل خودکار پیش‌فرم می‌شوند
- [ ] با سبد غیرخالی، پیام محرک سبد رهاشده ظاهر می‌شود

### چه چیزی برگردان

```bash
sudo mira logs api | grep -i wordpress | tail -20
```

به‌همراه یک اسکرین‌شات از پنل مشتری با داده‌ی سفارش واقعی.

---

## بند ۲ — یک استقرار پروداکشن واقعی

**چرا بلوک‌کننده است:** Caddy/SSL، مسیر نصب `.deb` و اسکریپت‌های بک‌آپ هرگز روی یک هاست
واقعی اجرا نشده‌اند و همه‌ی فازهای بعدی فرض می‌کنند کار می‌کنند.

### پیش‌نیاز

- یک VPS تمیز دبیان ۱۲/۱۳ با حداقل ۲ گیگ RAM
- دو رکورد DNS نوع **A**: ‏`chat.example.com` و `panel.example.com`
- پورت‌های ۸۰ و ۴۴۳ باز

### اجرا

```bash
wget https://github.com/hami9/mira/releases/latest/download/mira_1.1.0_all.deb
sudo dpkg -i mira_*_all.deb || sudo apt -f install

sudo mira setup      # اطلاعاتی که چاپ می‌کند را ذخیره کن — فقط یک‌بار نمایش داده می‌شود
sudo mira start      # بار اول ۵ تا ۱۵ دقیقه (ساخت ایمیج‌ها)
sudo mira status
sudo mira doctor
```

### معیار قبولی

- [ ] `https://chat.example.com/health` روی **HTTPS واقعی** با گواهی معتبر Let's Encrypt
      پاسخ می‌دهد (نه self-signed)
- [ ] `https://panel.example.com` داشبورد را می‌آورد و ورود کار می‌کند
- [ ] `sudo mira doctor` همه‌ی بررسی‌ها را سبز گزارش می‌کند
- [ ] `sudo mira backup` فایل `.sql.gz` می‌سازد و `sudo mira restore <file>` برمی‌گرداند
- [ ] **بعد از `sudo reboot` استک خودش بالا می‌آید** (سرویس systemd)
- [ ] `/demo.html` در پروداکشن **۴۰۴** می‌دهد

### چه چیزی برگردان

```bash
sudo mira doctor
curl -sI https://chat.example.com/health | head -5
sudo docker compose -f /opt/mira/app/docker-compose.yml logs caddy 2>&1 | grep -i certificate | tail -5
```

---

## بند ۳ — ایمیج پروداکشن داشبورد و عمومی‌کردن پکیج‌های GHCR

**چرا بلوک‌کننده است:** `Dockerfile.prod` و تزریق زمان‌اجرای `config.js` فقط با شبیه‌سازی
اسکریپت entrypoint در مرورگر تأیید شده‌اند، نه با اجرای واقعی کانتینر nginx.

### اجرا

```bash
docker build -f apps/dashboard/Dockerfile.prod -t mira-dashboard:test .
docker run --rm -p 8080:80 -e VITE_API_URL=https://chat.example.com mira-dashboard:test

# در ترمینال دیگر:
curl -s http://localhost:8080/config.js
# انتظار: window.__MIRA_API_URL__ = 'https://chat.example.com';
```

### عمومی‌کردن سه پکیج

‏workflow ‏`Docker Publish` با هر merge به `main` ایمیج‌ها را push می‌کند، ولی پکیج‌ها
**به‌طور پیش‌فرض private هستند** — الان pull ناشناس شکست می‌خورد، پس گزینه‌ی «ایمیج آماده»
در `mira setup` برای هیچ‌کس کار نمی‌کند.

برای هر سه‌تای `mira-api`، `mira-worker`، `mira-dashboard`:
**github.com/hami9?tab=packages** ← پکیج ← **Package settings** ← **Change visibility** ←
Public.

تأیید از ماشینی که لاگین نیست:

```bash
docker pull ghcr.io/hami9/mira-api:latest
```

### معیار قبولی

- [ ] `config.js` آدرس تزریق‌شده را دارد، نه `localhost`
- [ ] داشبورد از کانتینر nginx بالا می‌آید و درخواست ورود به آدرس تزریقی می‌رود
- [ ] هر سه پکیج به‌صورت ناشناس pull می‌شوند
- [ ] یک نصب کامل با گزینه‌ی «ایمیج آماده از GHCR» موفق است

---

## دو کار کوچک دیگر (نیازمند حساب خودت)

۱. **متادیتای مخزن** — توضیح مخزن هنوز `live chat by mira` است. چیزی مثل «پلتفرم لایو چت
پشتیبانی خودمیزبان با هوش مصنوعی برای وردپرس/ووکامرس — جایگزین گفتینو، فارسی‌محور،
چندمستأجری، AGPL-3.0» بهتر خوانده می‌شود. تاپیک‌ها را هم کامل کن
(`self-hosted`، `ai`، `chatbot`، `woocommerce`، `customer-support`، `nestjs`، `rag`، `rtl`)
و homepage را روی آدرس Pages بگذار.
۲. **GitHub Pages** — ‏Settings ← Pages ← شاخه `main`، پوشه `/docs`. صفحه‌ی لندینگ ساخته و
کامیت شده ولی الان چیزی سرو نمی‌شود.

## وقتی هر سه قبول شدند

بخش ۹ `AGENTS.fa.md` را به‌روز کن — بندهای ۱ تا ۴ فهرست «تست‌نشده‌ها» حذف می‌شوند و فاز ۱
نقشه‌راه باز می‌شود.
