import { lookup } from 'node:dns/promises';
import { request } from 'node:https';
import { BlockList, isIP } from 'node:net';
import type { AiPolicy, AiProduct, AiSource } from '@mira/shared-types';
import { plainText } from './guardrails';

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
          req.destroy(new Error('دریافت منبع ناموفق بود'));
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

export interface SiteContext {
  products: AiProduct[];
  documents: (AiSource & { content: string })[];
}

export function parseSiteContext(raw: unknown, origin: string, policy: AiPolicy): SiteContext {
  const data = raw as { products?: unknown[]; documents?: unknown[] } | null;
  const products: AiProduct[] = [];
  const documents: SiteContext['documents'] = [];
  const validUrl = (value: unknown): value is string => {
    try {
      const u = new URL(String(value));
      return u.origin === origin && u.protocol === 'https:' && !u.username && !u.password;
    } catch {
      return false;
    }
  };
  for (const value of (Array.isArray(data?.products) && policy.useProducts
    ? data.products
    : []
  ).slice(0, 6)) {
    const p = value as Record<string, unknown> | null;
    if (
      !p ||
      typeof p.id !== 'string' ||
      typeof p.name !== 'string' ||
      !validUrl(p.url) ||
      typeof p.price !== 'string' ||
      !/^\d+(?:\.\d{1,6})?$/.test(p.price) ||
      typeof p.currency !== 'string' ||
      typeof p.inStock !== 'boolean'
    )
      continue;
    products.push({
      id: `product:${p.id.slice(0, 80)}`,
      name: plainText(p.name, 200),
      url: p.url,
      imageUrl: validUrl(p.imageUrl) ? p.imageUrl : null,
      price: p.price.slice(0, 30),
      currency: plainText(p.currency, 12),
      inStock: p.inStock,
      ...(p.priceIsMinimum === true ? { priceIsMinimum: true } : {}),
      ...(typeof p.description === 'string' ? { description: plainText(p.description, 800) } : {}),
    });
  }
  for (const value of (Array.isArray(data?.documents) && policy.useWebsite
    ? data.documents
    : []
  ).slice(0, 5)) {
    const d = value as Record<string, unknown> | null;
    if (
      !d ||
      typeof d.id !== 'string' ||
      typeof d.title !== 'string' ||
      typeof d.content !== 'string' ||
      !validUrl(d.url)
    )
      continue;
    documents.push({
      id: `page:${d.id.slice(0, 80)}`,
      title: plainText(d.title, 200),
      content: plainText(d.content, 3000),
      url: d.url,
    });
  }
  return { products, documents };
}

export async function getSiteContext(
  siteUrl: string,
  key: string,
  question: string,
  policy: AiPolicy,
): Promise<SiteContext> {
  const base = new URL(siteUrl);
  const url = new URL(
    `${base.pathname.replace(/\/$/, '')}/wp-json/mira/v1/ai-context`,
    base.origin,
  );
  url.searchParams.set('search', siteSearchTerms(question));
  url.searchParams.set('products', policy.useProducts ? '1' : '0');
  url.searchParams.set('pages', policy.useWebsite ? '1' : '0');
  return parseSiteContext(await readSiteJson(url, key), base.origin, policy);
}

export function siteSearchTerms(question: string): string {
  const stopWords = new Set(
    'سلام لطفا لطفاً یه یک من ما شما برای از به با در و یا که این آن اون میخوام میخواهم می‌خواهم میشه می‌شود هست است آیا چطور چیه چیست چه کدام بهم بده بدید معرفی راهنمای راهنمایی انتخاب محصول محصولات خرید شرایط the a an i want need please can you show me about for to of is are'.split(
      ' ',
    ),
  );
  const terms = question
    .normalize('NFKC')
    .toLowerCase()
    .replace(/ي/g, 'ی')
    .replace(/ك/g, 'ک')
    .split(/[^\p{L}\p{N}\u200c-]+/u)
    .filter((word) => word.length > 1 && !stopWords.has(word));
  return [...new Set(terms)].slice(0, 5).join(' ').slice(0, 160) || question.slice(0, 160);
}
