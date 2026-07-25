import { AiSuggestReplyJobData, AiSuggestionPayload, SocketEvent } from '@mira/shared-types';
import { pool } from '../db';
import { chatCompletion } from '../ai/chat';
import { publishSocketEvent } from '../redis-bridge';

const HISTORY_LIMIT = 15;

const SENDER_LABELS: Record<string, string> = { visitor: 'مشتری', agent: 'اپراتور', bot: 'ربات' };

const SYSTEM_PROMPT =
  'تو به یک اپراتور پشتیبانی کمک می‌کنی تا پاسخ بعدی رو به مشتری بنویسه. با توجه به تاریخچه‌ی ' +
  'گفتگو، یک پاسخ کوتاه، مودبانه و حرفه‌ای به زبان همون گفتگو پیشنهاد بده. فقط متن پاسخ رو بنویس، بدون توضیح اضافه.';

export async function processSuggestReply(data: AiSuggestReplyJobData): Promise<void> {
  const transcript = await getTranscript(data.conversationId);
  if (!transcript) return;

  // تاریخچه رو به‌عنوان متن داخل یک user turn تنها می‌فرستیم (نه چندین نوبت user/assistant متناوب)
  // چون بعضی providerها (از جمله Gemini) درخواستی که آخرین پیامش نوبت مدل باشه رو رد می‌کنن —
  // اینجا آخرین پیام گفتگو معمولاً می‌تونه از طرف اپراتور/ربات باشه، پس این محدودیت واقعی بود.
  const suggestion = await chatCompletion([
    { role: 'system', content: SYSTEM_PROMPT },
    { role: 'user', content: `تاریخچه‌ی گفتگو:\n\n${transcript}\n\nپاسخ پیشنهادی؟` },
  ]);
  if (!suggestion) return;

  const payload: AiSuggestionPayload = { conversationId: data.conversationId, suggestion };
  await publishSocketEvent(`conversation:${data.conversationId}`, SocketEvent.AiReplySuggested, payload);
}

async function getTranscript(conversationId: string): Promise<string> {
  const result = await pool.query<{ senderType: string; content: string }>(
    `SELECT "senderType", content FROM messages WHERE "conversationId" = $1 ORDER BY "createdAt" DESC LIMIT $2`,
    [conversationId, HISTORY_LIMIT],
  );
  return result.rows
    .reverse()
    .map((row) => `${SENDER_LABELS[row.senderType] ?? row.senderType}: ${row.content}`)
    .join('\n');
}
