// آدرس API به سه ترتیب: (۱) config.js زمان اجرا (ایمیج آماده‌ی Docker)،
// (۲) متغیر build ‏Vite (بیلد از سورس)، (۳) پیش‌فرض توسعه‌ی محلی
declare global {
  interface Window {
    __MIRA_API_URL__?: string;
  }
}

export const API_URL =
  window.__MIRA_API_URL__ || import.meta.env.VITE_API_URL || 'http://localhost:3000';
