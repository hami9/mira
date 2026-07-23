import { AiSummarizeConversationJobData } from '@mira/shared-types';
import { pool } from '../db';
import { chatCompletion, ChatMessage } from '../ai/chat';

const SYSTEM_PROMPT =
  'این گفتگوی پشتیبانی رو در ۲ تا ۳ جمله‌ی کوتاه به فارسی خلاصه کن: موضوع درخواست مشتری چی بود ' +
  'و در نهایت چطور حل شد. فقط متن خلاصه رو بنویس.';

// نه‌بلادرنگ عمداً: مکالمه از قبل resolve شده، پس اپراتور همین الان منتظر این نتیجه نیست —
// دفعه‌ی بعد که این مکالمه رو باز کنه خلاصه از دیتابیس آماده است
export async function processSummarizeConversation(data: AiSummarizeConversationJobData): Promise<void> {
  const messages = await getFullHistory(data.conversationId);
  if (messages.length === 0) return;

  const summary = await chatCompletion([{ role: 'system', content: SYSTEM_PROMPT }, ...messages]);
  if (!summary) return;

  await pool.query(`UPDATE conversations SET summary = $1 WHERE id = $2`, [summary, data.conversationId]);
}

async function getFullHistory(conversationId: string): Promise<ChatMessage[]> {
  const result = await pool.query<{ senderType: string; content: string }>(
    `SELECT "senderType", content FROM messages WHERE "conversationId" = $1 ORDER BY "createdAt" ASC`,
    [conversationId],
  );
  return result.rows.map((row) => ({
    role: row.senderType === 'agent' || row.senderType === 'bot' ? 'assistant' : 'user',
    content: row.content,
  }));
}
