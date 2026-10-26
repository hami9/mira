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
  isSimpleGreeting,
} from '../ai/guardrails';
import { getSiteContext, SiteContext } from '../ai/site-context';

interface SiteAiSettings {
  name: string;
  aiBotName: string;
  aiEnabled: boolean;
  aiSystemPrompt: string | null;
  aiConfidenceThreshold: number;
  aiHandoffMessage: string | null;
  aiGreetingMessage: string | null;
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
        `SELECT name, "aiBotName", "aiEnabled", "aiSystemPrompt", "aiConfidenceThreshold", "aiHandoffMessage", "aiGreetingMessage",
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
    if (isSimpleGreeting(visitor.content)) {
      const greeting = plainText(
        site.aiGreetingMessage ||
          `سلام! من ${site.aiBotName}، دستیار ${site.name} هستم. چطور می‌توانم راهنمایی‌تان کنم؟`,
      );
      await postReply(client, data, greeting, { products: [], sources: [] });
      return;
    }
    await status(data, 'retrieving');
    const question = redactSensitive(visitor.content);
    const sources: (AiSource & { content: string })[] = [];
    const knowledge = new Map<string, { id: string; revision: number }>();
    const hasKnowledge =
      policy.useKnowledgeBase &&
      (
        await client.query(
          `SELECT 1 FROM knowledge_base_documents WHERE "siteId" = $1 AND status = 'ready' AND enabled=true LIMIT 1`,
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
      const chunks = await client.query<{
        id: string;
        title: string;
        content: string;
        documentId: string;
        revision: number;
      }>(
        `SELECT c.id, d.title, c.content, d.id AS "documentId", d.revision FROM knowledge_base_chunks c
         JOIN knowledge_base_documents d ON d.id = c."documentId" AND d."siteId" = c."siteId"
         WHERE c."siteId" = $1 AND d.status = 'ready' AND d.enabled=true AND 1 - (c.embedding <=> $2::vector) >= $3
         ORDER BY c.embedding <=> $2::vector LIMIT 5`,
        [
          data.siteId,
          `[${embedding.join(',')}]`,
          policy.guardrailsEnabled === false ? -1 : policy.minSimilarity,
        ],
      );
      for (const chunk of chunks.rows)
        knowledge.set(`kb:${chunk.id}`, { id: chunk.documentId, revision: chunk.revision });
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
          content: `${site.aiSystemPrompt || ''}\n\nهویت همین گفتگو: ${JSON.stringify({ storeName: plainText(site.name).slice(0, 255), assistantName: plainText(site.aiBotName).slice(0, 100) })}\nفقط نماینده همین فروشگاه هستی؛ نام یا اطلاعات فروشگاه دیگری را جایگزین هویت این گفتگو نکن.\n${SAFETY_PROMPT}\nحداکثر ${policy.maxProducts} محصول انتخاب کن.`,
        },
        // منابع هرگز به دستور سطح سیستم تبدیل نمی‌شوند.
        {
          role: 'user',
          content: JSON.stringify({
            storeName: plainText(site.name).slice(0, 255),
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
    if (
      !result ||
      (policy.guardrailsEnabled !== false &&
        (result.confidence === 0 || result.confidence < site.aiConfidenceThreshold))
    ) {
      await postReply(client, data, handoff, { products: [], sources: [], handoff: true });
      return;
    }
    const posted = await postReply(
      client,
      data,
      result.answer,
      {
        products: result.products,
        sources: policy.showSources
          ? result.sources.map(({ id, title, url }) => ({ id, title, ...(url ? { url } : {}) }))
          : [],
      },
      [
        ...new Map(
          result.sources
            .map((source) => knowledge.get(source.id))
            .filter((value): value is { id: string; revision: number } => Boolean(value))
            .map((value) => [value.id, value]),
        ).values(),
      ],
    );
    if (!posted)
      await postReply(client, data, handoff, { products: [], sources: [], handoff: true });
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
  usedKnowledge: { id: string; revision: number }[] = [],
): Promise<boolean> {
  await client.query('BEGIN');
  let row: { id: string; createdAt: Date } | undefined;
  try {
    if (!(await eligible(client, data, true))) {
      await client.query('ROLLBACK');
      return false;
    }
    const enabled = (
      await client.query(`SELECT "aiEnabled" FROM sites WHERE id = $1`, [data.siteId])
    ).rows[0]?.aiEnabled;
    if (!enabled) {
      await client.query('ROLLBACK');
      return false;
    }
    if (usedKnowledge.length) {
      const fresh = await client.query(
        `SELECT d.id FROM knowledge_base_documents d JOIN jsonb_to_recordset($2::jsonb) AS expected(id uuid,revision integer) ON expected.id=d.id AND expected.revision=d.revision WHERE d."siteId"=$1 AND d.enabled=true AND d.status='ready' FOR SHARE OF d`,
        [data.siteId, JSON.stringify(usedKnowledge)],
      );
      if (fresh.rowCount !== usedKnowledge.length) {
        await client.query('ROLLBACK');
        return false;
      }
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
    if (row && usedKnowledge.length)
      await client.query(
        `UPDATE knowledge_base_documents SET "usageCount"="usageCount"+1,"lastUsedAt"=now() WHERE "siteId"=$1 AND id=ANY($2::uuid[])`,
        [data.siteId, usedKnowledge.map((value) => value.id)],
      );
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
  if (!row) return false;
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
  return true;
}
