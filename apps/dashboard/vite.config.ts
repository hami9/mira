import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// اگر داشبورد پشت دامنه‌ی واقعی با dev server اجرا شود (فقط حالت توسعه/آزمایشی)،
// Vite از نسخه‌ی 5.4.12 هدر Host را allowlist می‌کند؛ دامنه از env اضافه می‌شود.
const dashboardDomain = process.env.DASHBOARD_DOMAIN;

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    host: true,
    ...(dashboardDomain ? { allowedHosts: [dashboardDomain] } : {}),
  },
  // @mira/shared-types یک پکیج workspace است که از symlink بیرون از node_modules resolve می‌شه؛
  // Vite به‌صورت پیش‌فرض چنین پکیج‌هایی رو از مرحله‌ی pre-bundle (تبدیل CJS به ESM) کنار می‌گذاره،
  // در نتیجه dist/index.js (که CommonJS خالص است) بدون تبدیل مستقیم به مرورگر سرو می‌شد و می‌شکست.
  optimizeDeps: {
    include: ['@mira/shared-types'],
  },
  build: {
    // همان مشکل بالا در build پروداکشن: پلاگین commonjs راولاپ به‌صورت پیش‌فرض فقط
    // node_modules را تبدیل می‌کند؛ مسیر واقعی پکیج workspace هم باید صریح اضافه شود
    // وگرنه import نام‌دار (مثل SocketEvent) از خروجی CJS پیدا نمی‌شود.
    commonjsOptions: {
      include: [/packages\/shared-types/, /node_modules/],
    },
  },
});
