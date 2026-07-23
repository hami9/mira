import { UAParser } from 'ua-parser-js';

export interface ParsedUserAgent {
  browser: string | null;
  os: string | null;
  deviceType: string | null;
}

// برای نمایش «مرورگر/سیستم» بازدیدکننده در پنل اطلاعات داشبورد
export function parseUserAgent(userAgent: string | null): ParsedUserAgent {
  if (!userAgent) {
    return { browser: null, os: null, deviceType: null };
  }

  const result = new UAParser(userAgent).getResult();
  const browser = result.browser.name
    ? `${result.browser.name} ${result.browser.version ?? ''}`.trim()
    : null;
  const os = result.os.name ? `${result.os.name} ${result.os.version ?? ''}`.trim() : null;
  const deviceType = result.device.type ?? 'desktop';

  return { browser, os, deviceType };
}
