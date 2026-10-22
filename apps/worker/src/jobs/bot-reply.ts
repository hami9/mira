import {
  AiBotReplyJobData,
  AiPolicy,
  AiMessageMetadata,
  AiStatusPayload,
  AiSource,
  BusinessHours,
  DEFAULT_AI_POLICY,
  MessageSenderType,
  SocketEvent,
  containsHumanRequestKeywords,
  isWithinBusinessHours,
} from '@mira/shared-types';
import type { PoolClient } from 'pg';
import { pool } from '../db';
import { chatCompletion } from '../ai/chat';
import { embedTexts } from '../ai/embeddings';
import { publishSocketEvent } from '../redis-bridge';
import {
  blockedInput,
  parseGroundedAnswer,
  plainText,
  redactSensitive,
  SAFETY_PROMPT,
} from '../ai/guardrails';
import { getSiteContext, SiteContext } from '../ai/site-context';

interface SiteAiSettings {
  aiEnabled: boolean;
  aiSystemPrompt: string | null;
  aiConfidenceThreshold: number;
  aiHandoffMessage: string | null;
  aiTemperature: number;
  aiMaxTokens: number;
  aiMaxRepliesPerConversation: number;
  aiReplyOnlyOutsideBusinessHours: boolean;
  businessHours: BusinessHours | null;
  aiPolicy: AiPolicy;
  wordpressSiteUrl: string | null;
  wordpressApiKey: string | null;
}

const DEFAULT_HANDOFF =
  'برای پاسخ دقیق‌تر، گفتگو را به پشتیبان انسانی سپردم. همکارانم در اولین فرصت پاسخ می‌دهند.';

export async function processBotReply(data: AiBotReplyJobData): Promise<void> {
  // قفل مکالمه بین چند worker و جلوگیری از پاسخ تکراری با clientMessageId.
  const client = await pool.connect();
  const lockKey = `${data.siteId}:${data.conversationId}`;
  let locked = false;
  let started = false;
  let handoff = DEFAULT_HANDOFF;
  try {
    await client.query('SELECT pg_advisory_lock(hashtextextended($1, 0))', [lockKey]);
    locked = true;
    const site = (
      await client.query<SiteAiSettings>(
        `SELECT "aiEnabled", "aiSystemPrompt", "aiConfidenceThreshold", "aiHandoffMessage",
        "aiTemperature", "aiMaxTokens", "aiMaxRepliesPerConversation", "aiPolicy",
        "aiReplyOnlyOutsideBusinessHours", "businessHours", "wordpressSiteUrl", "wordpressApiKey"
       FROM sites WHERE id = $1`,
        [data.siteId],
      )
    ).rows[0];
    if (!site || !site.aiEnabled || !(await eligible(client, data))) return;
    if (site.aiReplyOnlyOutsideBusinessHours && isWithinBusinessHours(site.businessHours)) return;
    handoff = plainText(site.aiHandoffMessage || DEFAULT_HANDOFF);
    const policy = { ...DEFAULT_AI_POLICY, ...site.aiPolicy };
    const visitor = (
      await client.query<{ content: string }>(
        `SELECT content FROM messages WHERE id = $1 AND "siteId" = $2 AND "conversationId" = $3 AND "senderType" = 'visitor'`,
        [data.visitorMessageId, data.siteId, data.conversationId],
      )
    ).rows[0];
    if (!visitor) return;
    started = true;
    const count = (
      await client.query<{ count: string }>(
        `SELECT count(*) FROM messages WHERE "siteId" = $1 AND "conversationId" = $2 AND "senderType" = 'bot'`,
        [data.siteId, data.conversationId],
      )
    ).rows[0];
    if (
      containsHumanRequestKeywords(visitor.content) ||
      blockedInput(visitor.content, policy) ||
      Number(count.count) >= site.aiMaxRepliesPerConversation
    ) {
      await postReply(client, data, handoff, { products: [], sources: [], handoff: true });
      return;
    }
    await status(data, 'retrieving');
    const question = redactSensitive(visitor.content);
    const sources: (AiSource & { content: string })[] = [];
    const hasKnowledge =
      policy.useKnowledgeBase &&
      (
        await client.query(
          `SELECT 1 FROM knowledge_base_documents WHERE "siteId" = $1 AND status = 'ready' LIMIT 1`,
          [data.siteId],
        )
      ).rowCount;
    if (hasKnowledge) {
      const [embedding] = await embedTexts([question], {
        siteId: data.siteId,
        conversationId: data.conversationId,
        kind: 'retrieval',
      });
      if (!embedding || embedding.length !== 768 || !embedding.every(Number.isFinite))
        throw new Error('بردار نامعتبر');
      const chunks = await client.query<{ id: string; title: string; content: string }>(
        `SELECT c.id, d.title, c.content FROM knowledge_base_chunks c
         JOIN knowledge_base_documents d ON d.id = c."documentId" AND d."siteId" = c."siteId"
         WHERE c."siteId" = $1 AND d.status = 'ready' AND 1 - (c.embedding <=> $2::vector) >= $3
         ORDER BY c.embedding <=> $2::vector LIMIT 5`,
        [data.siteId, `[${embedding.join(',')}]`, policy.minSimilarity],
      );
      sources.push(
        ...chunks.rows.map((c) => ({
          ...c,
          id: `kb:${c.id}`,
          content: plainText(c.content, 3000),
        })),
      );
    }
    if (policy.serverContext.trim())
      sources.push({
        id: 'server:approved',
        title: 'اطلاعات تأییدشده فروشگاه',
        content: policy.serverContext,
      });
    let website: SiteContext = { products: [], documents: [] };
    if (policy.useWebsite || policy.useProducts) {
      if (!site.wordpressSiteUrl || !site.wordpressApiKey)
        throw new Error('منبع سایت تنظیم نشده است');
      website = await getSiteContext(site.wordpressSiteUrl, site.wordpressApiKey, question, policy);
      sources.push(...website.documents);
    }
    if (!sources.length && !website.products.length) {
      await postReply(client, data, handoff, { products: [], sources: [], handoff: true });
      return;
    }
    const history = (
      await client.query<{ senderType: string; content: string }>(
        `SELECT "senderType", content FROM messages WHERE "siteId" = $1 AND "conversationId" = $2
       ORDER BY "createdAt" DESC, id DESC LIMIT 10`,
        [data.siteId, data.conversationId],
      )
    ).rows
      .reverse()
      .map((m) => ({ role: m.senderType, content: redactSensitive(m.content).slice(0, 2000) }));
    await status(data, 'thinking');
    const raw = await chatCompletion(
      [
        {
          role: 'system',
          content: `${site.aiSystemPrompt || ''}\n\n${SAFETY_PROMPT}\nحداکثر ${policy.maxProducts} محصول انتخاب کن.`,
        },
        // منابع هرگز به دستور سطح سیستم تبدیل نمی‌شوند.
        {
          role: 'user',
          content: JSON.stringify({
            sources: sources.map((s) => ({ ...s, content: redactSensitive(s.content) })),
            products: website.products,
            history,
            question,
          }),
        },
      ],
      site.aiMaxTokens,
      site.aiTemperature,
      policy.model,
      { siteId: data.siteId, conversationId: data.conversationId, kind: 'reply' },
    );
    const result = parseGroundedAnswer(raw, website.products, sources, policy);
    if (!result || result.confidence === 0 || result.confidence < site.aiConfidenceThreshold) {
      await postReply(client, data, handoff, { products: [], sources: [], handoff: true });
      return;
    }
    await postReply(client, data, result.answer, {
      products: result.products,
      sources: policy.showSources
        ? result.sources.map(({ id, title, url }) => ({ id, title, ...(url ? { url } : {}) }))
        : [],
    });
  } catch {
    // خطای SDK ممکن است حاوی درخواست یا کلید باشد؛ به مشتری و لاگ منتقل نمی‌شود.
    if (started)
      await postReply(client, data, handoff, { products: [], sources: [], handoff: true });
    else throw new Error('آماده‌سازی پاسخ دستیار ناموفق بود');
  } finally {
    try {
      if (started) await status(data, 'idle');
    } finally {
      let destroy = false;
      try {
        if (locked)
          await client.query('SELECT pg_advisory_unlock(hashtextextended($1, 0))', [lockKey]);
      } catch {
        destroy = true;
      } finally {
        client.release(destroy);
      }
    }
  }
}

async function eligible(
  client: PoolClient,
  data: AiBotReplyJobData,
  lock = false,
): Promise<boolean> {
  const conversation = (
    await client.query(
      `SELECT id FROM conversations WHERE id = $1 AND "siteId" = $2
     AND "assignedAgentId" IS NULL AND "aiPaused" = false AND status = 'open' ${lock ? 'FOR UPDATE' : ''}`,
      [data.conversationId, data.siteId],
    )
  ).rows[0];
  if (!conversation) return false;
  const latest = (
    await client.query<{ id: string }>(
      `SELECT id FROM messages WHERE "siteId" = $1 AND "conversationId" = $2
     AND "senderType" IN ('visitor', 'agent') ORDER BY "createdAt" DESC, id DESC LIMIT 1`,
      [data.siteId, data.conversationId],
    )
  ).rows[0];
  if (latest?.id !== data.visitorMessageId) return false;
  const sent = await client.query(
    `SELECT id FROM messages WHERE "siteId" = $1 AND "conversationId" = $2 AND "clientMessageId" = $3`,
    [data.siteId, data.conversationId, `ai-${data.visitorMessageId}`],
  );
  return sent.rowCount === 0;
}

async function status(data: AiBotReplyJobData, stage: AiStatusPayload['stage']): Promise<void> {
  await publishSocketEvent(`conversation:${data.conversationId}`, SocketEvent.AiStatus, {
    conversationId: data.conversationId,
    messageId: data.visitorMessageId,
    stage,
  });
}

async function postReply(
  client: PoolClient,
  data: AiBotReplyJobData,
  content: string,
  metadata: AiMessageMetadata,
): Promise<void> {
  await client.query('BEGIN');
  let row: { id: string; createdAt: Date } | undefined;
  try {
    if (!(await eligible(client, data, true))) {
      await client.query('ROLLBACK');
      return;
    }
    const enabled = (
      await client.query(`SELECT "aiEnabled" FROM sites WHERE id = $1`, [data.siteId])
    ).rows[0]?.aiEnabled;
    if (!enabled) {
      await client.query('ROLLBACK');
      return;
    }
    row = (
      await client.query<{ id: string; createdAt: Date }>(
        `INSERT INTO messages ("siteId", "conversationId", "senderType", content, "clientMessageId", "aiMetadata")
       VALUES ($1, $2, 'bot', $3, $4, $5) ON CONFLICT DO NOTHING RETURNING id, "createdAt"`,
        [
          data.siteId,
          data.conversationId,
          plainText(content),
          `ai-${data.visitorMessageId}`,
          metadata,
        ],
      )
    ).rows[0];
    if (metadata.handoff)
      await client.query(
        `UPDATE conversations SET "aiPaused" = true WHERE id = $1 AND "siteId" = $2`,
        [data.conversationId, data.siteId],
      );
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  }
  if (!row) return;
  const payload = {
    id: row.id,
    conversationId: data.conversationId,
    senderType: MessageSenderType.BOT,
    senderId: null,
    content: plainText(content),
    createdAt: row.createdAt.toISOString(),
    aiMetadata: metadata,
  };
  await publishSocketEvent(`conversation:${data.conversationId}`, SocketEvent.MessageNew, payload);
  await publishSocketEvent(`site:${data.siteId}`, SocketEvent.ConversationUpdated, {
    conversationId: data.conversationId,
    lastMessage: payload,
  });
}
