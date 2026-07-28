import {
  AiBotReplyJobData,
  MessageSenderType,
  SocketEvent,
  containsHumanRequestKeywords,
} from '@mira/shared-types';
import { pool } from '../db';
import { chatCompletion, ChatMessage } from '../ai/chat';
import { embedTexts } from '../ai/embeddings';
import { publishSocketEvent } from '../redis-bridge';
import { parseModelOutput } from '../ai/parse-model-output';

const HISTORY_LIMIT = 10;
const RETRIEVAL_LIMIT = 5;
const DEFAULT_HANDOFF_MESSAGE =
  'ممنون از پیامتون 🙏 برای پاسخ دقیق‌تر شما رو به یکی از همکارانم وصل می‌کنم، لحظاتی صبر کنید.';

const DEFAULT_SYSTEM_PROMPT =
  'تو دستیار پاسخ‌گوی اول یک فروشگاه اینترنتی هستی. فقط از «زمینه» ارائه‌شده برای پاسخ استفاده کن. ' +
  'اگر زمینه برای پاسخ دقیق کافی نبود، صادق باش و اطمینان پایین اعلام کن — هیچ‌وقت حدس نزن.';

interface RetrievedChunk {
  content: string;
  title: string;
}

export async function processBotReply(data: AiBotReplyJobData): Promise<void> {
  const site = await getSite(data.siteId);
  if (!site || !site.aiEnabled) return;

  const handoffMessage = site.aiHandoffMessage?.trim() || DEFAULT_HANDOFF_MESSAGE;

  const conversation = await getConversation(data.conversationId);
  // اگه بین enqueue و پردازش یک اپراتور مکالمه رو claim کرده باشه، ربات دیگه دخالت نمی‌کنه
  if (!conversation || conversation.assignedAgentId) return;

  // سقف پاسخ ربات در هر مکالمه (کنترل هزینه) — بعد از رسیدن به سقف، مکالمه دست انسان می‌مونه
  const botReplyCount = await countBotReplies(data.conversationId);
  if (botReplyCount >= site.aiMaxRepliesPerConversation) return;

  const visitorMessage = await getMessage(data.visitorMessageId);
  if (!visitorMessage) return;

  if (containsHumanRequestKeywords(visitorMessage.content)) {
    await postBotMessage(data.siteId, data.conversationId, handoffMessage);
    return;
  }

  const chunks = await retrieveRelevantChunks(data.siteId, visitorMessage.content);
  if (chunks.length === 0) {
    // پایگاه دانشی برای این سایت وجود نداره — ربات چیزی رو از خودش نمی‌سازه، سکوت می‌کنه تا انسان پاسخ بده
    return;
  }

  const history = await getRecentHistory(data.conversationId);
  const context = chunks
    .map((chunk, index) => `[منبع ${index + 1}: ${chunk.title}]\n${chunk.content}`)
    .join('\n\n');

  const messages: ChatMessage[] = [
    {
      role: 'system',
      content:
        `${site.aiSystemPrompt || DEFAULT_SYSTEM_PROMPT}\n\n` +
        `زمینه:\n${context}\n\n` +
        'دقیقاً به این فرمت پاسخ بده (بدون هیچ متن اضافه):\n' +
        'CONFIDENCE: <عددی بین ۰ تا ۱>\n' +
        'ANSWER: <پاسخ نهایی به زبان پیام کاربر>',
    },
    // history از پایگاه‌داده خونده می‌شه و از قبل شامل همین پیام محرک (آخرین پیام ذخیره‌شده) است
    ...history,
  ];

  const raw = await chatCompletion(messages, site.aiMaxTokens, site.aiTemperature);
  const { confidence, answer } = parseModelOutput(raw);

  if (confidence === null || answer === '' || confidence < site.aiConfidenceThreshold) {
    await postBotMessage(data.siteId, data.conversationId, handoffMessage);
    return;
  }

  const usedTitles = [...new Set(chunks.map((c) => c.title))];
  const citation = usedTitles.length > 0 ? `\n\n📎 منبع: ${usedTitles.join('، ')}` : '';
  await postBotMessage(data.siteId, data.conversationId, `${answer}${citation}`);
}

async function retrieveRelevantChunks(siteId: string, question: string): Promise<RetrievedChunk[]> {
  const [embedding] = await embedTexts([question]);
  const vectorLiteral = `[${embedding.join(',')}]`;
  const result = await pool.query<RetrievedChunk>(
    `SELECT c.content, d.title
     FROM knowledge_base_chunks c
     JOIN knowledge_base_documents d ON d.id = c."documentId"
     WHERE c."siteId" = $1
     ORDER BY c.embedding <=> $2::vector
     LIMIT $3`,
    [siteId, vectorLiteral, RETRIEVAL_LIMIT],
  );
  return result.rows;
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

interface SiteAiSettings {
  aiEnabled: boolean;
  aiSystemPrompt: string | null;
  aiConfidenceThreshold: number;
  aiHandoffMessage: string | null;
  aiTemperature: number;
  aiMaxTokens: number;
  aiMaxRepliesPerConversation: number;
}

async function getSite(siteId: string): Promise<SiteAiSettings | null> {
  const result = await pool.query<SiteAiSettings>(
    `SELECT "aiEnabled", "aiSystemPrompt", "aiConfidenceThreshold", "aiHandoffMessage",
            "aiTemperature", "aiMaxTokens", "aiMaxRepliesPerConversation"
     FROM sites WHERE id = $1`,
    [siteId],
  );
  return result.rows[0] ?? null;
}

async function countBotReplies(conversationId: string): Promise<number> {
  const result = await pool.query<{ count: string }>(
    `SELECT COUNT(*) AS count FROM messages WHERE "conversationId" = $1 AND "senderType" = 'bot'`,
    [conversationId],
  );
  return parseInt(result.rows[0]?.count ?? '0', 10);
}

async function getConversation(
  conversationId: string,
): Promise<{ assignedAgentId: string | null } | null> {
  const result = await pool.query(`SELECT "assignedAgentId" FROM conversations WHERE id = $1`, [
    conversationId,
  ]);
  return result.rows[0] ?? null;
}

async function getMessage(messageId: string): Promise<{ content: string } | null> {
  const result = await pool.query(`SELECT content FROM messages WHERE id = $1`, [messageId]);
  return result.rows[0] ?? null;
}

async function postBotMessage(
  siteId: string,
  conversationId: string,
  content: string,
): Promise<void> {
  const result = await pool.query(
    `INSERT INTO messages ("siteId", "conversationId", "senderType", content)
     VALUES ($1, $2, 'bot', $3)
     RETURNING id, "createdAt"`,
    [siteId, conversationId, content],
  );
  const row = result.rows[0];
  const payload = {
    id: row.id,
    conversationId,
    senderType: MessageSenderType.BOT,
    senderId: null,
    content,
    createdAt: row.createdAt.toISOString(),
  };
  await publishSocketEvent(`conversation:${conversationId}`, SocketEvent.MessageNew, payload);
  await publishSocketEvent(`site:${siteId}`, SocketEvent.ConversationUpdated, {
    conversationId,
    lastMessage: payload,
  });
}
