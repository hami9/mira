import { AiSummarizeConversationJobData } from '@mira/shared-types';
import { pool } from '../db';
import { chatCompletion } from '../ai/chat';

const SENDER_LABELS: Record<string, string> = { visitor: 'مشتری', agent: 'اپراتور', bot: 'ربات' };

const SYSTEM_PROMPT =
  'این گفتگوی پشتیبانی رو در ۲ تا ۳ جمله‌ی کوتاه به فارسی خلاصه کن: موضوع درخواست مشتری چی بود ' +
  'و در نهایت چطور حل شد. فقط متن خلاصه رو بنویس.';

// نه‌بلادرنگ عمداً: مکالمه از قبل resolve شده، پس اپراتور همین الان منتظر این نتیجه نیست —
// دفعه‌ی بعد که این مکالمه رو باز کنه خلاصه از دیتابیس آماده است
export async function processSummarizeConversation(
  data: AiSummarizeConversationJobData,
): Promise<void> {
  const transcript = await getTranscript(data.conversationId);
  if (!transcript) return;

  // تاریخچه به‌عنوان متن داخل یک user turn تنها فرستاده می‌شه (نه چند نوبت متناوب) چون آخرین
  // پیام گفتگوی resolve‌شده معمولاً از طرف اپراتور/رباته و بعضی providerها (Gemini) درخواستی
  // که با نوبت مدل تموم بشه رو رد می‌کنن
  const summary = await chatCompletion([
    { role: 'system', content: SYSTEM_PROMPT },
    { role: 'user', content: `تاریخچه‌ی گفتگو:\n\n${transcript}\n\nخلاصه؟` },
  ]);
  if (!summary) return;

  await pool.query(`UPDATE conversations SET summary = $1 WHERE id = $2`, [
    summary,
    data.conversationId,
  ]);
}

async function getTranscript(conversationId: string): Promise<string> {
  const result = await pool.query<{ senderType: string; content: string }>(
    `SELECT "senderType", content FROM messages WHERE "conversationId" = $1 ORDER BY "createdAt" ASC`,
    [conversationId],
  );
  return result.rows
    .map((row) => `${SENDER_LABELS[row.senderType] ?? row.senderType}: ${row.content}`)
    .join('\n');
}
