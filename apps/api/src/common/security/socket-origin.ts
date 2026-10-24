import type { IncomingHttpHeaders } from 'node:http';

export function socketOrigin(headers: IncomingHttpHeaders, transport: string): string | undefined {
  if (headers.origin !== undefined) return headers.origin;
  // GET هم‌مبدأ در polling هدر Origin ندارد؛ مرورگر مبدأ را با Referer و Fetch Metadata مشخص می‌کند.
  // Origin صریح همیشه مقدم است و برای وب‌سوکت یا درخواست بین‌مبدأ این جایگزین فعال نمی‌شود.
  if (transport !== 'polling' || headers['sec-fetch-site'] !== 'same-origin' || !headers.referer)
    return undefined;
  try {
    const url = new URL(headers.referer);
    return ['https:', 'http:'].includes(url.protocol) ? url.origin : undefined;
  } catch {
    return undefined;
  }
}
