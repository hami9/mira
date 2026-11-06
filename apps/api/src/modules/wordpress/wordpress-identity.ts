import { createHmac, timingSafeEqual } from 'node:crypto';

// فقط امضای ساخته‌شده در سرور وردپرس هویت حساب را متصل می‌کند؛ ایمیل مرورگر کافی نیست.
export function verifyWordPressIdentity(
  proof: string | undefined,
  key: string | null,
  widgetKey: string,
  now = Math.floor(Date.now() / 1000),
): string | null {
  if (!proof || !key) return null;
  const match = /^wp1\.([1-9]\d{0,12})\.(\d{10})\.([a-f0-9]{64})$/.exec(proof);
  if (!match) return null;
  const [, id, expiry, signature] = match;
  if (Number(expiry) <= now || Number(expiry) > now + 900) return null;
  const expected = createHmac('sha256', key).update(`${widgetKey}:${id}:${expiry}`).digest();
  if (!timingSafeEqual(expected, Buffer.from(signature, 'hex'))) return null;
  return `wp:${id}:${expiry}`;
}

export function wordPressUserId(
  externalId: string | null,
  now = Math.floor(Date.now() / 1000),
): string | null {
  const match = /^wp:([1-9]\d{0,12}):(\d{10})$/.exec(externalId || '');
  return match && Number(match[2]) > now ? match[1] : null;
}
