const VISITOR_REF_KEY = 'mira_visitor_ref';

// طبق الزام امنیتی: فقط یک شناسه تصادفی غیرحساس (نه توکن، نه PII) در localStorage نگه می‌داریم
// تا مکالمه بین بازخوانی‌های صفحه ادامه پیدا کنه. خود توکن هیچ‌وقت اینجا ذخیره نمی‌شه.
export function getStoredVisitorRef(): string | null {
  try {
    return window.localStorage.getItem(VISITOR_REF_KEY);
  } catch {
    return null;
  }
}

export function storeVisitorRef(ref: string): void {
  try {
    window.localStorage.setItem(VISITOR_REF_KEY, ref);
  } catch {
    // localStorage در دسترس نیست (مثلاً حالت خصوصی مرورگر) — مشکلی نیست، فقط ادامه‌ی مکالمه بین بازخوانی از دست می‌ره
  }
}
