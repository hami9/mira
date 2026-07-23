// فقط برای نمایش در UI؛ این decode هیچ اعتبارسنجی امنیتی انجام نمی‌ده (اون کار سمت سرور انجام می‌شه)
export function decodeJwtPayload<T>(token: string): T | null {
  try {
    const [, payloadBase64] = token.split('.');
    const json = atob(payloadBase64.replace(/-/g, '+').replace(/_/g, '/'));
    return JSON.parse(json) as T;
  } catch {
    return null;
  }
}
