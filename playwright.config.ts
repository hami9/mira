import { defineConfig, devices } from '@playwright/test';

// تست E2E فقط وقتی معنی دارد که کل استک واقعاً بالا باشد (قاعده‌ی ۸).
// در CI ‏(job ‏`E2E`) این‌طور اجرا می‌شود:
//   Postgres + Redis service container → migration → seed → بوت واقعی API →
//   سرو باندل استاتیک داشبورد → همین تست‌ها
// روی ماشین توسعه هم اگر استک با `docker compose up -d` بالا باشد کار می‌کند.
const API_URL = process.env.E2E_API_URL || 'http://localhost:3000';
const DASHBOARD_URL = process.env.E2E_DASHBOARD_URL || 'http://localhost:5173';

export default defineConfig({
  testDir: './tests/e2e',
  // مسیر زنده‌ی سوکت گاهی چند ثانیه طول می‌کشد؛ سخت‌گیری بی‌جا فقط تست را flaky می‌کند
  timeout: 90_000,
  expect: { timeout: 20_000 },
  // دو context مرورگری هم‌زمان داریم؛ موازی‌سازی فایل‌ها لازم نیست و فقط نویز می‌سازد
  workers: 1,
  fullyParallel: false,
  retries: process.env.CI ? 1 : 0,
  // سقف کل سوئیت. اگر داشبورد اصلاً بالا نیاید، هر تست تا آخرِ timeout خودش صبر
  // می‌کند و با retry جمعاً خیلی طولانی می‌شود؛ این سقف کل اجرا را قطع می‌کند.
  globalTimeout: process.env.CI ? 10 * 60_000 : undefined,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : [['list']],
  use: {
    baseURL: API_URL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'off',
    // ویجت و داشبورد هر دو فارسی/RTL هستند
    locale: 'fa-IR',
  },
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        // کرومیوم از قبل نصب است (PLAYWRIGHT_BROWSERS_PATH)؛ دانلود دوباره لازم نیست
        launchOptions: process.env.PLAYWRIGHT_CHROMIUM_PATH
          ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH }
          : {},
      },
    },
  ],
  metadata: { apiUrl: API_URL, dashboardUrl: DASHBOARD_URL },
});
