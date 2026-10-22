import { createServer } from 'node:http';
import { Buffer } from 'node:buffer';
import { setTimeout as delay } from 'node:timers/promises';

// ارائه‌دهنده‌ی قطعی برای آزمون مسیر واقعی صف و سوکت؛ بدون تماس با مدل خارجی.
const server = createServer(async (req, res) => {
  if (req.url === '/health') {
    res.writeHead(200).end('ok');
    return;
  }
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const body = JSON.parse(Buffer.concat(chunks).toString() || '{}');
  res.setHeader('Content-Type', 'application/json');
  if (req.url?.endsWith('/embeddings')) {
    const input = Array.isArray(body.input) ? body.input : [body.input];
    res.end(
      JSON.stringify({
        usage: { prompt_tokens: 20, total_tokens: 20 },
        data: input.map((_, index) => ({ index, embedding: [1, ...Array(767).fill(0)] })),
      }),
    );
    return;
  }
  if (!req.url?.endsWith('/chat/completions')) {
    res.writeHead(404).end('{}');
    return;
  }
  const content = JSON.parse(body.messages.at(-1).content);
  await delay(1200);
  res.end(
    JSON.stringify({
      usage: { prompt_tokens: 100, completion_tokens: 40, total_tokens: 140 },
      choices: [
        {
          message: {
            role: 'assistant',
            content: JSON.stringify({
              confidence: 0.95,
              answer: `${content.storeName ? `${content.storeName}: ` : ''}ارسال سفارش دو روز کاری زمان می‌برد.`,
              sourceIds: content.sources?.length ? [content.sources[0].id] : [],
              productIds: content.products?.slice(0, 1).map((p) => p.id) || [],
            }),
          },
        },
      ],
    }),
  );
});
server.listen(Number(process.env.AI_FIXTURE_PORT || 4201), '127.0.0.1');
