import type { PoolClient } from 'pg';
import { pool } from '../db';

export interface LifecycleJob {
  siteId: string;
  conversationId: string;
  conversationVersion?: number;
  visitorVersion?: number;
}

export interface LifecycleSnapshot {
  visitorId: string;
  conversationVersion: number;
  visitorVersion: number;
}

// نسخه‌ها بیرون از تراکنش خوانده می‌شوند؛ هیچ قفل ردیفی حین فراخوانی مدل نگه نمی‌ماند.
export async function captureLifecycle(
  data: LifecycleJob,
  client: PoolClient | typeof pool = pool,
): Promise<LifecycleSnapshot | null> {
  const row = (
    await client.query<LifecycleSnapshot>(
      `SELECT c."visitorId", c."lifecycleVersion" AS "conversationVersion",
              v."moderationVersion" AS "visitorVersion"
       FROM conversations c JOIN visitors v ON v.id=c."visitorId" AND v."siteId"=c."siteId"
       WHERE c.id=$1 AND c."siteId"=$2 AND c."deletedAt" IS NULL
         AND (v."blockedAt" IS NULL OR (v."blockedUntil" IS NOT NULL AND v."blockedUntil"<=now()))
         AND (v."mutedUntil" IS NULL OR v."mutedUntil"<=now())`,
      [data.conversationId, data.siteId],
    )
  ).rows[0];
  // کارهای قدیمی فقط پیش از اولین تغییر مدیریتی معتبرند؛ نسخه غایب صفر است.
  if (
    !row ||
    (data.conversationVersion ?? 0) !== row.conversationVersion ||
    (data.visitorVersion ?? 0) !== row.visitorVersion
  )
    return null;
  return row;
}

// همه مسیرهای نوشتن، ابتدا بازدیدکننده و سپس مکالمه را قفل می‌کنند.
// تغییر و بازگردانی وضعیت هم نسخه را عوض می‌کند تا کار قدیمی دوباره معتبر نشود.
export async function lockLifecycle(
  client: PoolClient,
  data: LifecycleJob,
  snapshot: LifecycleSnapshot,
): Promise<boolean> {
  const visitor = await client.query(
    `SELECT id FROM visitors WHERE id=$1 AND "siteId"=$2 AND "moderationVersion"=$3
       AND ("blockedAt" IS NULL OR ("blockedUntil" IS NOT NULL AND "blockedUntil"<=now()))
       AND ("mutedUntil" IS NULL OR "mutedUntil"<=now()) FOR UPDATE`,
    [snapshot.visitorId, data.siteId, snapshot.visitorVersion],
  );
  if (!visitor.rowCount) return false;
  const conversation = await client.query(
    `SELECT id FROM conversations WHERE id=$1 AND "siteId"=$2 AND "visitorId"=$3
       AND "deletedAt" IS NULL AND "lifecycleVersion"=$4 FOR UPDATE`,
    [data.conversationId, data.siteId, snapshot.visitorId, snapshot.conversationVersion],
  );
  return Boolean(conversation.rowCount);
}
