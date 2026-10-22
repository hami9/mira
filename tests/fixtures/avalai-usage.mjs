import { config as loadEnv } from 'dotenv';
import { createRequire } from 'node:module';
import crypto from 'node:crypto';
import { setTimeout as delay } from 'node:timers/promises';
import { mkdir, writeFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
import { Queue, Worker } from 'bullmq';
import pg from 'pg';

loadEnv({ path: '.env.avalai.local' });
const allowed = [
  'https://api.avalai.ir/v1',
  'https://api.avalai.org/v1',
  'https://api.avalapis.ir/v1',
];
assert(process.env.AVALAI_API_KEY && allowed.includes(process.env.AVALAI_BASE_URL || allowed[0]));
assert(process.env.TEST_DATABASE_URL, 'Use a disposable migrated test database');
process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
process.env.OPENAI_API_KEY = process.env.AVALAI_API_KEY;
process.env.OPENAI_BASE_URL = process.env.AVALAI_BASE_URL || allowed[0];
process.env.OPENAI_MODEL = process.env.AVALAI_MODEL || 'deepseek-v4-flash';
process.env.QUEUE_PREFIX = `avalai-check-${crypto.randomUUID()}`;
const require = createRequire(import.meta.url);
const { DEFAULT_AI_POLICY, AI_QUEUE_NAMES } = require('@mira/shared-types');
const { processBotReply } = require('../../apps/worker/dist/jobs/bot-reply.js');
const { pool: workerPool } = require('../../apps/worker/dist/db.js');
const { closeSocketPublisher } = require('../../apps/worker/dist/redis-bridge.js');
const { BillingService } = require('../../apps/api/dist/modules/billing/billing.service.js');
const { UsageService } = require('../../apps/api/dist/modules/billing/usage.service.js');
const { ConfigService } = require('@nestjs/config');
const db = new pg.Pool({ connectionString: process.env.TEST_DATABASE_URL });
const connection = {
  host: process.env.REDIS_HOST || 'localhost',
  port: Number(process.env.REDIS_PORT || 6379),
};
const queue = new Queue(AI_QUEUE_NAMES.BotReply, { connection, prefix: process.env.QUEUE_PREFIX });
const worker = new Worker(AI_QUEUE_NAMES.BotReply, (job) => processBotReply(job.data), {
  connection,
  prefix: process.env.QUEUE_PREFIX,
});
let siteId;
try {
  siteId = (
    await db.query(
      `INSERT INTO sites (name, "widgetKey", "allowedDomains", "aiEnabled", "aiReplyOnlyOutsideBusinessHours", "aiMaxTokens", "aiPolicy") VALUES ('AvalAI fixture', $1, ARRAY['https://test.invalid'], true, false, 800, $2) RETURNING id`,
      [
        crypto.randomUUID(),
        {
          ...DEFAULT_AI_POLICY,
          useKnowledgeBase: false,
          serverContext: 'ارسال سفارش دو روز کاری زمان می‌برد.',
        },
      ],
    )
  ).rows[0].id;
  const visitorId = (
    await db.query(`INSERT INTO visitors ("siteId", "visitorRef") VALUES ($1, $2) RETURNING id`, [
      siteId,
      crypto.randomUUID(),
    ])
  ).rows[0].id;
  const conversationId = (
    await db.query(
      `INSERT INTO conversations ("siteId", "visitorId") VALUES ($1, $2) RETURNING id`,
      [siteId, visitorId],
    )
  ).rows[0].id;
  const visitorMessageId = (
    await db.query(
      `INSERT INTO messages ("siteId", "conversationId", "senderType", content) VALUES ($1, $2, 'visitor', 'ارسال سفارش چند روز زمان می‌برد؟') RETURNING id`,
      [siteId, conversationId],
    )
  ).rows[0].id;
  const adminId = (
    await db.query(
      `INSERT INTO agents ("siteId", "fullName", email, "passwordHash", role) VALUES ($1, 'Fixture', $2, 'fixture', 'admin') RETURNING id`,
      [siteId, `${crypto.randomUUID()}@test.invalid`],
    )
  ).rows[0].id;
  await queue.add('reply', { siteId, conversationId, visitorMessageId });
  let answer;
  for (let i = 0; i < 45; i++) {
    answer = (
      await db.query(
        `SELECT content, "aiMetadata" FROM messages WHERE "siteId" = $1 AND "conversationId" = $2 AND "senderType" = 'bot'`,
        [siteId, conversationId],
      )
    ).rows[0];
    if (answer) break;
    await delay(1000);
  }
  assert(answer && !answer.aiMetadata?.handoff, 'Expected a grounded provider answer');
  const [usage] = (await db.query(`SELECT * FROM ai_usage WHERE "siteId" = $1`, [siteId])).rows;
  assert(
    usage?.totalTokens > 0 && usage.requestId && usage.provider === 'avalai',
    'Expected provider usage and request ID',
  );
  await delay(31000);
  const source = { query: async (sql, values) => (await db.query(sql, values)).rows };
  const billing = new BillingService(
    new ConfigService({
      AVALAI_API_KEY: process.env.AVALAI_API_KEY,
      AVALAI_SITE_ID: siteId,
      AVALAI_BASE_URL: process.env.OPENAI_BASE_URL,
    }),
    source,
  );
  const overview = await billing.overview(siteId, adminId);
  const report = await new UsageService(source).report(siteId, adminId, 7);
  assert(overview.credit?.remainingIrt !== null && overview.credit, 'Expected live credit');
  assert(report.recordedCostUsd !== null, 'Expected reconciled transaction cost');
  assert.equal(report.averageTokensPerUser, usage.totalTokens);
  const result = {
    model: usage.model,
    requests: report.requests,
    users: report.users,
    inputTokens: usage.inputTokens,
    outputTokens: usage.outputTokens,
    totalTokens: report.totalTokens,
    averageTokensPerUser: report.averageTokensPerUser,
    actualCostUsd: report.recordedCostUsd,
    creditReceived: true,
    pricesReceived: overview.models.length > 0,
    warnings: overview.warnings,
  };
  await mkdir('test-results', { recursive: true });
  await writeFile('test-results/avalai-usage.json', JSON.stringify(result, null, 2));
  console.log(JSON.stringify(result));
} finally {
  await worker.close();
  await queue.obliterate({ force: true });
  await queue.close();
  if (siteId) {
    for (const table of ['messages', 'conversations', 'visitors', 'agents'])
      await db.query(`DELETE FROM ${table} WHERE "siteId" = $1`, [siteId]);
    await db.query('DELETE FROM sites WHERE id = $1', [siteId]);
  }
  await db.end();
  await workerPool.end();
  await closeSocketPublisher();
}
