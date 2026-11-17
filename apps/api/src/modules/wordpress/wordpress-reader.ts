import { lookup } from 'node:dns/promises';
import { request } from 'node:https';
import { BlockList, isIP } from 'node:net';

const blocked = new BlockList();
const blockedV6 = new BlockList();
const publicV6 = new BlockList();
publicV6.addSubnet('2000::', 3, 'ipv6');
for (const [ip, bits] of [
  ['0.0.0.0', 8],
  ['10.0.0.0', 8],
  ['100.64.0.0', 10],
  ['127.0.0.0', 8],
  ['169.254.0.0', 16],
  ['172.16.0.0', 12],
  ['192.0.0.0', 24],
  ['192.0.2.0', 24],
  ['192.168.0.0', 16],
  ['198.18.0.0', 15],
  ['198.51.100.0', 24],
  ['203.0.113.0', 24],
  ['224.0.0.0', 3],
] as const)
  blocked.addSubnet(ip, bits, 'ipv4');
for (const [ip, bits] of [
  ['::', 96],
  ['::ffff:0:0', 96],
  ['64:ff9b::', 96],
  ['100::', 64],
  ['2001::', 32],
  ['2001:db8::', 32],
  ['2002::', 16],
  ['fc00::', 7],
  ['fe80::', 10],
  ['ff00::', 8],
] as const)
  blockedV6.addSubnet(ip, bits, 'ipv6');

export function isPublicAddress(address: string): boolean {
  const family = isIP(address);
  return family === 4
    ? !blocked.check(address, 'ipv4')
    : family === 6 && publicV6.check(address, 'ipv6') && !blockedV6.check(address, 'ipv6');
}

// فقط endpoint ثابت سایت تنظیم‌شده؛ بدون ریدایرکت، DNS مجدد یا URL ارسالی بازدیدکننده.
export async function readSiteJson(url: URL, apiKey: string): Promise<unknown> {
  if (
    url.protocol !== 'https:' ||
    (url.port && url.port !== '443') ||
    url.username ||
    url.password
  ) {
    throw new Error('آدرس منبع باید HTTPS عمومی باشد');
  }
  let dnsTimer: ReturnType<typeof setTimeout> | undefined;
  const addresses = await Promise.race([
    lookup(url.hostname.replace(/^\[|\]$/g, ''), { all: true }),
    new Promise<never>((_resolve, reject) => {
      dnsTimer = setTimeout(() => reject(new Error('مهلت یافتن منبع تمام شد')), 8000);
    }),
  ]).finally(() => clearTimeout(dnsTimer));
  if (!addresses.length || addresses.some((item) => !isPublicAddress(item.address))) {
    throw new Error('آدرس شبکه داخلی مجاز نیست');
  }
  const pinned = addresses[0];
  return new Promise((resolve, reject) => {
    const req = request(
      url,
      {
        method: 'GET',
        family: pinned.family,
        headers: { 'X-Mira-Api-Key': apiKey, Accept: 'application/json' },
        lookup: (_host, _options, callback) => callback(null, pinned.address, pinned.family),
      },
      (response) => {
        if (
          response.statusCode !== 200 ||
          !response.headers['content-type']?.includes('application/json')
        ) {
          response.resume();
          req.destroy(new WordPressReadError(response.statusCode ?? 0));
          return;
        }
        const chunks: Buffer[] = [];
        let length = 0;
        response.on('data', (chunk: Buffer) => {
          length += chunk.length;
          if (length > 256_000) req.destroy(new Error('حجم منبع بیش از حد است'));
          else chunks.push(chunk);
        });
        response.on('error', reject);
        response.on('end', () => {
          clearTimeout(timer);
          try {
            resolve(JSON.parse(Buffer.concat(chunks).toString('utf8')));
          } catch {
            reject(new Error('فرمت منبع معتبر نیست'));
          }
        });
      },
    );
    const timer = setTimeout(() => req.destroy(new Error('مهلت دریافت منبع تمام شد')), 8000);
    req.on('error', (error) => {
      clearTimeout(timer);
      reject(error);
    });
    req.end();
  });
}

export class WordPressReadError extends Error {
  constructor(readonly status: number) {
    super('دریافت وردپرس ناموفق بود');
  }
}
