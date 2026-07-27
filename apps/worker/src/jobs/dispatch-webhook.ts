import { createHmac } from 'node:crypto';
import { WebhookDispatchJobData } from '@mira/shared-types';
import { pool } from '../db';

const REQUEST_TIMEOUT_MS = 8_000;

interface WebhookRow {
  id: string;
  url: string;
  secret: string;
}

// worker خودش لیست webhookهای فعالِ همون سایت/رویداد رو تازه می‌خونه (نه از روی داده‌ی زمان enqueue)
// تا اگه ادمین بین enqueue و پردازش، URL یا فعال/غیرفعال بودن رو عوض کرد، همیشه آخرین تنظیمات اعمال بشه.
export async function processDispatchWebhook(data: WebhookDispatchJobData): Promise<void> {
  const result = await pool.query<WebhookRow>(
    `SELECT id, url, secret FROM webhooks WHERE "siteId" = $1 AND enabled = true AND $2 = ANY(events)`,
    [data.siteId, data.event],
  );
  if (result.rows.length === 0) return;

  const body = JSON.stringify({ event: data.event, siteId: data.siteId, data: data.payload, timestamp: new Date().toISOString() });

  // هر webhook مستقل از بقیه امتحان می‌شه — خطای یکی نباید بقیه رو متوقف کنه یا کل job رو retry کنه
  await Promise.all(result.rows.map((webhook) => deliver(webhook, body)));
}

async function deliver(webhook: WebhookRow, body: string): Promise<void> {
  const signature = createHmac('sha256', webhook.secret).update(body).digest('hex');
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch(webhook.url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Mira-Signature': `sha256=${signature}` },
      body,
      signal: controller.signal,
    });
    if (!response.ok) {
      console.error(`[worker] وب‌هوک ${webhook.id} با کد ${response.status} رد شد`);
    }
  } catch (error) {
    console.error(`[worker] ارسال وب‌هوک ${webhook.id} شکست خورد:`, (error as Error).message);
  } finally {
    clearTimeout(timeout);
  }
}
