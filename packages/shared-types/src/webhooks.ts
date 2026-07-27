// API عمومی + وب‌هوک برای رویدادها (فاز ۶) — فقط همون دو رویدادی که نقشه‌راه مشخص کرده
export type WebhookEventType = 'message.created' | 'conversation.resolved';

export const WEBHOOK_QUEUE_NAME = 'webhook-dispatch';

// این job فقط siteId/event/payload رو حمل می‌کنه؛ worker خودش لیست webhookهای فعال همون
// سایت/رویداد رو تازه از دیتابیس می‌خونه (نه از روی داده‌ی زمان enqueue) تا اگه ادمین بین
// enqueue و پردازش، URL یا فعال/غیرفعال بودن رو عوض کرد، همیشه آخرین تنظیمات اعمال بشه.
export interface WebhookDispatchJobData {
  siteId: string;
  event: WebhookEventType;
  payload: Record<string, unknown>;
}

export interface WebhookDto {
  id: string;
  url: string;
  events: WebhookEventType[];
  enabled: boolean;
  // برخلاف کلید API (که برای احراز هویت ورودی به سیستم ماست)، سکرت وب‌هوک برای امضای
  // درخواست‌های خروجی ماست — ادمین باید همیشه بتونه ببینتش تا سرویس گیرنده رو باهاش تنظیم کنه
  secret: string;
  createdAt: string;
}

export interface CreateWebhookDto {
  url: string;
  events: WebhookEventType[];
}

export interface UpdateWebhookDto {
  url?: string;
  events?: WebhookEventType[];
  enabled?: boolean;
}

export interface PublicApiKeyStatusDto {
  hasKey: boolean;
  keyPrefix: string | null;
  createdAt: string | null;
}

// کلید واقعی فقط همین یک‌بار (لحظه‌ی ساخت) برگردونده می‌شه — بعدش فقط hash نگه داشته می‌شه
export interface GeneratedApiKeyDto {
  apiKey: string;
  keyPrefix: string;
}
