// تنظیمات زمان اجرای داشبورد میرا.
// در ایمیج Docker پروداکشن، این فایل هنگام start کانتینر از روی متغیر محیطی
// VITE_API_URL بازنویسی می‌شود (apps/dashboard/docker-entrypoint.d/10-mira-config.sh)
// تا یک ایمیج واحد روی هر دامنه/سروری قابل استفاده باشد.
window.__MIRA_API_URL__ = '';
