import { Worker } from 'bullmq';
import { AI_QUEUE_NAMES, WEBHOOK_QUEUE_NAME } from '@mira/shared-types';
import { config } from './config';
import { pool } from './db';
import { processEmbedDocument } from './jobs/embed-document';
import { processBotReply } from './jobs/bot-reply';
import { processSuggestReply } from './jobs/suggest-reply';
import { processSummarizeConversation } from './jobs/summarize-conversation';
import { processDispatchWebhook } from './jobs/dispatch-webhook';
import { closeSocketPublisher } from './redis-bridge';
import { createTaskLimiter } from './task-limit';
import { startTelemetry } from './telemetry';

const run = createTaskLimiter(config.limits.workerConcurrency);

const connection = {
  host: config.redis.host,
  port: config.redis.port,
  password: config.redis.password,
  maxRetriesPerRequest: null,
};

const workers = [
  new Worker(AI_QUEUE_NAMES.EmbedDocument, (job) => run(() => processEmbedDocument(job.data)), {
    connection,
    prefix: config.queuePrefix,
  }),
  new Worker(AI_QUEUE_NAMES.BotReply, (job) => run(() => processBotReply(job.data)), {
    connection,
    prefix: config.queuePrefix,
  }),
  new Worker(AI_QUEUE_NAMES.SuggestReply, (job) => run(() => processSuggestReply(job.data)), {
    connection,
    prefix: config.queuePrefix,
  }),
  new Worker(
    AI_QUEUE_NAMES.SummarizeConversation,
    (job) => run(() => processSummarizeConversation(job.data)),
    {
      connection,
      prefix: config.queuePrefix,
    },
  ),
  new Worker(WEBHOOK_QUEUE_NAME, (job) => run(() => processDispatchWebhook(job.data)), {
    connection,
    prefix: config.queuePrefix,
  }),
];

for (const worker of workers) {
  worker.on('completed', (job) =>
    console.log(`[worker] ${job.queueName} تکمیل شد — job ${job.id}`),
  );
  worker.on('failed', (job) =>
    console.error(`[worker] ${job?.queueName} شکست خورد — job ${job?.id}`),
  );
}

const stopTelemetry = startTelemetry();
console.log('میرا Worker — پردازشگرهای AI (فاز ۴) در حال گوش‌دادن به صف‌ها هستند.');

async function shutdown(): Promise<void> {
  stopTelemetry();
  console.log('[worker] در حال خاموش شدن...');
  await Promise.all(workers.map((worker) => worker.close()));
  await pool.end();
  await closeSocketPublisher();
  process.exit(0);
}

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
// در اجرای پنل میزبانی، مرگ ناگهانی والد هم نباید worker یتیم باقی بگذارد.
process.on('disconnect', shutdown);
