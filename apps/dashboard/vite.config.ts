import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    host: true,
  },
  // @mira/shared-types یک پکیج workspace است که از symlink بیرون از node_modules resolve می‌شه؛
  // Vite به‌صورت پیش‌فرض چنین پکیج‌هایی رو از مرحله‌ی pre-bundle (تبدیل CJS به ESM) کنار می‌گذاره،
  // در نتیجه dist/index.js (که CommonJS خالص است) بدون تبدیل مستقیم به مرورگر سرو می‌شد و می‌شکست.
  optimizeDeps: {
    include: ['@mira/shared-types'],
  },
});
