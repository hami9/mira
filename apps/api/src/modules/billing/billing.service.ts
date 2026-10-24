import { ForbiddenException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { AiBillingDto, parseAiModelPrices } from '@mira/shared-types';

const TOP_UP_URL = 'https://chat.avalai.ir/platform/billing';
const ENDPOINTS = [
  'https://api.avalai.ir/v1',
  'https://api.avalai.org/v1',
  'https://api.avalapis.ir/v1',
];
const CACHE_MS = 120_000;

export function billingNumber(value: unknown, allowNegative = false): number | null {
  if (typeof value !== 'number' && (typeof value !== 'string' || !value.trim())) return null;
  const number = Number(value);
  return Number.isFinite(number) && (allowNegative || number >= 0) ? number : null;
}

@Injectable()
export class BillingService {
  private cache: { key: number; expiresAt: number; value: AiBillingDto } | null = null;
  private pending: { key: number; value: Promise<AiBillingDto> } | null = null;
  private account: { siteId: string; apiKey: string } | null = null;
  private revision = 0;

  constructor(
    private readonly config: ConfigService,
    @InjectDataSource() private readonly db: DataSource,
  ) {}

  async overview(siteId: string, agentId: string): Promise<AiBillingDto> {
    // نقش از دیتابیس تازه خوانده می‌شود؛ اجازه مالی به توکن یا دسترسی تنظیمات متکی نیست.
    const admin = await this.db.query(
      `SELECT id FROM agents WHERE id = $1 AND "siteId" = $2 AND role = 'admin'`,
      [agentId, siteId],
    );
    if (!admin.length)
      throw new ForbiddenException('مشاهده هزینه و اعتبار فقط برای مدیر سایت مجاز است');
    const apiKey = this.config.get<string>('AVALAI_API_KEY', '');
    const boundSite = this.config.get<string>('AVALAI_SITE_ID', '');
    const empty: AiBillingDto = {
      configured: false,
      checkedAt: new Date().toISOString(),
      topUpUrl: TOP_UP_URL,
      credit: null,
      usage: null,
      models: [],
      warnings: [],
    };
    if (!apiKey || boundSite !== siteId) return empty;
    // اعتبارنامه مثل ConfigService فقط در حافظه است؛ تغییر آن نسل کش را عوض می‌کند.
    if (this.account?.siteId !== siteId || this.account.apiKey !== apiKey) {
      this.account = { siteId, apiKey };
      this.revision++;
      this.cache = null;
      this.pending = null;
    }
    const key = this.revision;
    if (this.cache?.key === key && this.cache.expiresAt > Date.now()) return this.cache.value;
    if (this.pending?.key === key) return this.pending.value;
    const value = this.load(apiKey, empty, siteId)
      .then((result) => {
        if (this.revision === key)
          this.cache = { key, expiresAt: Date.now() + CACHE_MS, value: result };
        return result;
      })
      .finally(() => {
        if (this.pending?.key === key) this.pending = null;
      });
    this.pending = { key, value };
    return value;
  }

  private async load(key: string, empty: AiBillingDto, siteId: string): Promise<AiBillingDto> {
    const results = await Promise.allSettled([
      this.readJson('/user/v1/credit', key),
      this.readJson('/user/v1/transactions/summary?hours_ago=24&group_by=model', key),
      this.readJson('/public/models'),
    ]);
    const result: AiBillingDto = {
      ...empty,
      configured: true,
      checkedAt: new Date().toISOString(),
    };
    const credit = results[0];
    if (credit.status === 'fulfilled') {
      const c = credit.value as Record<string, unknown> | null;
      result.credit = {
        remainingIrt: billingNumber(c?.remaining_irt, true),
        remainingUsd: billingNumber(c?.remaining_unit, true),
        exchangeRate: billingNumber(c?.exchange_rate),
      };
    } else result.warnings.push('موجودی حساب دریافت نشد؛ اتصال و دسترسی کلید را بررسی کنید.');
    const usage = results[1];
    if (usage.status === 'fulfilled') {
      const u = usage.value as {
        totals?: {
          transactions?: unknown;
          tokens?: { total?: unknown };
          cost?: { unit?: unknown; paid_irt?: unknown };
        };
        by_model?: {
          model?: unknown;
          transactions?: unknown;
          tokens?: unknown;
          cost_unit?: unknown;
        }[];
      } | null;
      if (u?.totals)
        result.usage = {
          requests: billingNumber(u.totals.transactions),
          tokens: billingNumber(u.totals.tokens?.total),
          costUsd: billingNumber(u.totals.cost?.unit),
          paidIrt: billingNumber(u.totals.cost?.paid_irt),
          models: Array.isArray(u.by_model)
            ? u.by_model
                .slice(0, 100)
                .filter((m) => m && typeof m.model === 'string')
                .map((m) => ({
                  id: String(m.model).slice(0, 150),
                  requests: billingNumber(m.transactions),
                  tokens: billingNumber(m.tokens),
                  costUsd: billingNumber(m.cost_unit),
                }))
            : [],
        };
      else result.warnings.push('ساختار گزارش مصرف معتبر نبود.');
    } else result.warnings.push('گزارش مصرف دریافت نشد؛ ممکن است سقف درخواست آوالای پر شده باشد.');
    const models = results[2];
    if (models.status === 'fulfilled') result.models = parseAiModelPrices(models.value);
    if (!result.models.length)
      result.warnings.push('تعرفه زنده مدل‌ها دریافت نشد؛ برآورد هزینه فعلاً در دسترس نیست.');
    try {
      await this.reconcile(siteId, key);
    } catch {
      result.warnings.push('بخشی از هزینه درخواست‌های میرا هنوز نهایی نشده است.');
    }
    return result;
  }

  private async reconcile(siteId: string, key: string): Promise<void> {
    const pending = await this.db.query(
      `SELECT "requestId" FROM ai_usage WHERE "siteId" = $1 AND provider = 'avalai' AND status = 'success' AND "costUsd" IS NULL AND "requestId" IS NOT NULL AND "createdAt" < now() - interval '30 seconds' ORDER BY "createdAt" DESC LIMIT 100`,
      [siteId],
    );
    const ids = pending.map((row: { requestId: string }) => row.requestId);
    if (!ids.length) return;
    const result = (await this.readJson('/user/v1/transactions/lookup', key, {
      transaction_ids: ids,
    })) as { transactions?: { id?: unknown; cost?: { unit?: unknown } }[] };
    if (!Array.isArray(result?.transactions)) throw new Error('پاسخ هزینه معتبر نیست');
    for (const transaction of result.transactions.slice(0, 100)) {
      const cost = billingNumber(transaction.cost?.unit);
      if (typeof transaction.id !== 'string' || !ids.includes(transaction.id) || cost === null)
        continue;
      await this.db.query(
        `UPDATE ai_usage SET "costUsd" = $1 WHERE "siteId" = $2 AND "requestId" = $3 AND provider = 'avalai' AND "costUsd" IS NULL`,
        [cost, siteId, transaction.id],
      );
    }
  }

  private async readJson(path: string, apiKey?: string, body?: unknown): Promise<unknown> {
    const endpoint = this.config.get<string>('AVALAI_BASE_URL', ENDPOINTS[0]).replace(/\/$/, '');
    if (!ENDPOINTS.includes(endpoint)) throw new Error('آدرس آوالای معتبر نیست');
    const response = await fetch(`${new URL(endpoint).origin}${path}`, {
      method: body ? 'POST' : 'GET',
      headers: {
        ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
        ...(body ? { 'Content-Type': 'application/json' } : {}),
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
      signal: AbortSignal.timeout(10_000),
      redirect: 'error',
    });
    if (!response.ok) throw new Error('دریافت اطلاعات آوالای ناموفق بود');
    const reader = response.body?.getReader();
    if (!reader) throw new Error('پاسخ آوالای خالی بود');
    const chunks: Uint8Array[] = [];
    let total = 0;
    try {
      while (true) {
        const item = await reader.read();
        if (item.done) break;
        total += item.value.length;
        if (total > 4_000_000) throw new Error('حجم پاسخ آوالای بیش از حد بود');
        chunks.push(item.value);
      }
    } finally {
      await reader.cancel();
    }
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
  }
}
