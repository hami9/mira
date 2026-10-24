import type { AiUsageContext } from '@mira/shared-types';
import { pool } from '../db';

interface UsageRecord {
  model: string;
  provider: string;
  status: 'success' | 'failed';
  inputTokens?: number;
  outputTokens?: number;
  totalTokens?: number;
  requestId?: string | null;
}

function tokens(value: number | undefined): number | null {
  return value !== undefined && Number.isSafeInteger(value) && value >= 0 && value <= 2147483647
    ? value
    : null;
}

export async function recordAiUsage(
  context: AiUsageContext | undefined,
  usage: UsageRecord,
): Promise<void> {
  if (!context) return;
  try {
    await pool.query(
      `INSERT INTO ai_usage ("siteId", "conversationId", "visitorId", "agentId", kind, model, provider, status, "inputTokens", "outputTokens", "totalTokens", "requestId")
      SELECT s.id, c.id, c."visitorId", a.id, $4, $5, $6, $7, $8, $9, $10, $11 FROM sites s
      LEFT JOIN conversations c ON c.id = $2 AND c."siteId" = s.id
      LEFT JOIN agents a ON a.id = $3 AND a."siteId" = s.id
      WHERE s.id = $1 AND ($2::uuid IS NULL OR c.id IS NOT NULL) AND ($3::uuid IS NULL OR a.id IS NOT NULL)
      ON CONFLICT DO NOTHING`,
      [
        context.siteId,
        context.conversationId ?? null,
        context.agentId ?? null,
        context.kind,
        usage.model.slice(0, 150),
        usage.provider,
        usage.status,
        tokens(usage.inputTokens),
        tokens(usage.outputTokens),
        tokens(usage.totalTokens),
        usage.requestId?.slice(0, 150) ?? null,
      ],
    );
  } catch {
    console.error('ثبت مصرف هوش مصنوعی ناموفق بود');
  }
}
