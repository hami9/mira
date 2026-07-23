import { AiSuggestReplyJobData, AiSuggestionPayload, SocketEvent } from '@mira/shared-types';
import { pool } from '../db';
import { chatCompletion, ChatMessage } from '../ai/chat';
import { publishSocketEvent } from '../redis-bridge';

const HISTORY_LIMIT = 15;

const SYSTEM_PROMPT =
  'تو به یک اپراتور پشتیبانی کمک می‌کنی تا پاسخ بعدی رو به مشتری بنویسه. با توجه به کل گفتگو، ' +
  'یک پاسخ کوتاه، مودبانه و حرفه‌ای به زبان همون گفتگو پیشنهاد بده. فقط متن پاسخ رو بنویس، بدون توضیح اضافه.';

export async function processSuggestReply(data: AiSuggestReplyJobData): Promise<void> {
  const history = await getRecentHistory(data.conversationId);
  if (history.length === 0) return;

  const suggestion = await chatCompletion([{ role: 'system', content: SYSTEM_PROMPT }, ...history]);
  if (!suggestion) return;

  const payload: AiSuggestionPayload = { conversationId: data.conversationId, suggestion };
  await publishSocketEvent(`conversation:${data.conversationId}`, SocketEvent.AiReplySuggested, payload);
}

async function getRecentHistory(conversationId: string): Promise<ChatMessage[]> {
  const result = await pool.query<{ senderType: string; content: string }>(
    `SELECT "senderType", content FROM messages WHERE "conversationId" = $1 ORDER BY "createdAt" DESC LIMIT $2`,
    [conversationId, HISTORY_LIMIT],
  );
  return result.rows.reverse().map((row) => ({
    role: row.senderType === 'agent' || row.senderType === 'bot' ? 'assistant' : 'user',
    content: row.content,
  }));
}
