// ساخت تنظیمات کاملاً محلی است؛ هیچ درخواست شبکه‌ای در این صفحه وجود ندارد.
document.getElementById('configure-form').addEventListener('submit', (event) => {
  event.preventDefault();
  const form = new window.FormData(event.currentTarget);
  const value = (key) => String(form.get(key) || '');
  const status = document.getElementById('status');
  try {
    const origin = (key) => {
      const url = new window.URL(value(key));
      if (
        url.protocol !== 'https:' ||
        url.username ||
        url.password ||
        url.pathname !== '/' ||
        url.search ||
        url.hash
      )
        throw new Error();
      return url.origin;
    };
    const publicUrl = origin('publicUrl');
    const shopUrl = origin('shopUrl');
    const database = new window.URL(value('database'));
    if (
      !['postgresql:', 'postgres:'].includes(database.protocol) ||
      !database.hostname ||
      database.pathname === '/'
    )
      throw new Error();
    const quote = (text) => {
      if (/[\r\n\0'\\]/.test(text)) throw new Error();
      return `'${text}'`;
    };
    const secret = () =>
      Array.from(window.crypto.getRandomValues(new Uint8Array(32)), (n) =>
        n.toString(16).padStart(2, '0'),
      ).join('');
    const settings = {
      NODE_ENV: 'production',
      SERVE_DASHBOARD: 'true',
      PUBLIC_API_URL: publicUrl,
      DASHBOARD_URL: publicUrl,
      CORS_ALLOWED_ORIGINS: publicUrl,
      DATABASE_URL: value('database'),
      REDIS_HOST: value('redisHost'),
      REDIS_PORT: value('redisPort'),
      REDIS_PASSWORD: value('redisPassword'),
      JWT_ACCESS_SECRET: secret(),
      JWT_REFRESH_SECRET: secret(),
      WIDGET_TOKEN_SECRET: secret(),
      SEED_SITE_NAME: value('siteName'),
      SEED_ADMIN_NAME: 'مدیر',
      SEED_ADMIN_EMAIL: value('email'),
      SEED_ADMIN_PASSWORD: value('password'),
      SEED_WIDGET_KEY: secret(),
      SEED_ALLOWED_DOMAINS: [...new Set([shopUrl, publicUrl])].join(','),
      QUEUE_PREFIX: `mira-${secret().slice(0, 12)}`,
      API_DB_POOL_MAX: '5',
      WORKER_DB_POOL_MAX: '3',
      WORKER_CONCURRENCY: '2',
      OPENAI_API_KEY: '',
      AVALAI_API_KEY: '',
      AVALAI_BASE_URL: 'https://api.avalai.ir/v1',
      AVALAI_MODEL: 'deepseek-v4-flash',
    };
    const text =
      Object.entries(settings)
        .map(([key, val]) => `${key}=${quote(val)}`)
        .join('\n') + '\n';
    const href = window.URL.createObjectURL(
      new window.Blob([text], { type: 'text/plain;charset=utf-8' }),
    );
    const link = document.createElement('a');
    link.href = href;
    link.download = 'mira.env';
    link.click();
    window.setTimeout(() => window.URL.revokeObjectURL(href), 1000);
    status.textContent =
      'فایل mira.env ساخته شد. در پوشه خصوصی برنامه بارگذاری و به .env تغییر نام دهید. سپس برنامه را از پنل میزبان Restart کنید. فایل را از کامپیوتر عمومی پاک کنید.';
  } catch {
    status.textContent =
      'آدرس‌ها باید HTTPS و بدون مسیر باشند. اتصال دیتابیس را بررسی کنید. مقادیر نباید خط جدید، بک‌اسلش یا تک‌نقل‌قول داشته باشند.';
  }
});
