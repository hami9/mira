import { Worker } from 'bullmq';
import { AI_QUEUE_NAMES } from '@mira/shared-types';
import { config } from './config';
import { pool } from './db';
import { processEmbedDocument } from './jobs/embed-document';
import { processBotReply } from './jobs/bot-reply';
import { processSuggestReply } from './jobs/suggest-reply';
import { processSummarizeConversation } from './jobs/summarize-conversation';

const connection = {
  host: config.redis.host,
  port: config.redis.port,
  password: config.redis.password,
  maxRetriesPerRequest: null,
};

const workers = [
  new Worker(AI_QUEUE_NAMES.EmbedDocument, (job) => processEmbedDocument(job.data), {
    connection,
    prefix: config.queuePrefix,
  }),
  new Worker(AI_QUEUE_NAMES.BotReply, (job) => processBotReply(job.data), {
    connection,
    prefix: config.queuePrefix,
  }),
  new Worker(AI_QUEUE_NAMES.SuggestReply, (job) => processSuggestReply(job.data), {
    connection,
    prefix: config.queuePrefix,
  }),
  new Worker(AI_QUEUE_NAMES.SummarizeConversation, (job) => processSummarizeConversation(job.data), {
    connection,
    prefix: config.queuePrefix,
  }),
];

for (const worker of workers) {
  worker.on('completed', (job) => console.log(`[worker] ${job.queueName} تکمیل شد — job ${job.id}`));
  worker.on('failed', (job, err) =>
    console.error(`[worker] ${job?.queueName} شکست خورد — job ${job?.id}:`, err.message),
  );
}

console.log('میرا Worker — پردازشگرهای AI (فاز ۴) در حال گوش‌دادن به صف‌ها هستند.');

async function shutdown(): Promise<void> {
  console.log('[worker] در حال خاموش شدن...');
  await Promise.all(workers.map((worker) => worker.close()));
  await pool.end();
  process.exit(0);
}

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
