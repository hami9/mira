import { AiSuggestReplyJobData, AiSuggestionPayload, SocketEvent } from '@mira/shared-types';
import { pool } from '../db';
import { chatCompletion } from '../ai/chat';
import { publishSocketEvent } from '../redis-bridge';
import { plainText } from '../ai/guardrails';
import { captureLifecycle, lockLifecycle } from './lifecycle';

const HISTORY_LIMIT = 15;

const SENDER_LABELS: Record<string, string> = { visitor: 'مشتری', agent: 'اپراتور', bot: 'ربات' };

const SYSTEM_PROMPT =
  'تو به یک اپراتور پشتیبانی کمک می‌کنی تا پاسخ بعدی رو به مشتری بنویسه. با توجه به تاریخچه‌ی ' +
  'گفتگو، یک پاسخ کوتاه، مودبانه و حرفه‌ای به زبان همون گفتگو پیشنهاد بده. فقط متن پاسخ رو بنویس، بدون توضیح اضافه.';

export async function processSuggestReply(data: AiSuggestReplyJobData): Promise<void> {
  const lifecycle = await captureLifecycle(data);
  if (!lifecycle) return;
  const expected = {
    ...data,
    conversationVersion: lifecycle.conversationVersion,
    visitorVersion: lifecycle.visitorVersion,
  };
  const transcript = await getTranscript(data.conversationId, data.siteId);
  if (!transcript) return;
  const site = (
    await pool.query<{ name: string }>('SELECT name FROM sites WHERE id = $1', [data.siteId])
  ).rows[0];
  if (!site) return;
  if (!(await captureLifecycle(expected))) return;

  // تاریخچه رو به‌عنوان متن داخل یک user turn تنها می‌فرستیم (نه چندین نوبت user/assistant متناوب)
  // چون بعضی providerها (از جمله Gemini) درخواستی که آخرین پیامش نوبت مدل باشه رو رد می‌کنن —
  // اینجا آخرین پیام گفتگو معمولاً می‌تونه از طرف اپراتور/ربات باشه، پس این محدودیت واقعی بود.
  const suggestion = await chatCompletion(
    [
      {
        role: 'system',
        content: `${SYSTEM_PROMPT}\nنام فروشگاه همین گفتگو: ${JSON.stringify(plainText(site.name, 255))}. هویت فروشگاه را با نام دیگری جایگزین نکن.`,
      },
      { role: 'user', content: `تاریخچه‌ی گفتگو:\n\n${transcript}\n\nپاسخ پیشنهادی؟` },
    ],
    1024,
    undefined,
    undefined,
    {
      siteId: data.siteId,
      conversationId: data.conversationId,
      agentId: data.agentId,
      kind: 'suggestion',
    },
  );
  if (!suggestion) return;

  const payload: AiSuggestionPayload = { conversationId: data.conversationId, suggestion };
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    if (!(await lockLifecycle(client, expected, lifecycle))) {
      await client.query('ROLLBACK');
      return;
    }
    await publishSocketEvent(
      `conversation:${data.conversationId}`,
      SocketEvent.AiReplySuggested,
      payload,
    );
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

async function getTranscript(conversationId: string, siteId: string): Promise<string> {
  const result = await pool.query<{ senderType: string; content: string }>(
    `SELECT "senderType", content FROM messages WHERE "conversationId" = $1 AND "siteId" = $3 ORDER BY "createdAt" DESC LIMIT $2`,
    [conversationId, HISTORY_LIMIT, siteId],
  );
  return result.rows
    .reverse()
    .map((row) => `${SENDER_LABELS[row.senderType] ?? row.senderType}: ${row.content}`)
    .join('\n');
}
