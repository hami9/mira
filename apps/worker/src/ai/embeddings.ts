import OpenAI from 'openai';
import { config } from '../config';
import type { AiUsageContext } from '@mira/shared-types';
import { recordAiUsage } from './usage';
import { openaiProvider } from './chat';

// Anthropic فاقد API عمومی embedding است، پس بدون توجه به AI_PROVIDER همیشه از کلاینت سازگار
// با OpenAI استفاده می‌کنیم (که برای Gemini از طریق OPENAI_BASE_URL هم کار می‌کنه)
const client = new OpenAI({
  apiKey: config.ai.openaiApiKey,
  baseURL: config.ai.openaiBaseUrl,
  timeout: 15_000,
  maxRetries: 0,
});

// باید دقیقاً با ستون vector(768) در مایگریشن Phase4AiSchema برابر باشه.
// gemini-embedding-001 پیش‌فرض ۳۰۷۲ بعدی برمی‌گردونه؛ با این پارامتر به ۷۶۸ برش می‌خوره.
const EMBEDDING_DIMENSIONS = 768;

export async function embedTexts(texts: string[], context?: AiUsageContext): Promise<number[][]> {
  try {
    const { data: response, response: http } = await client.embeddings
      .create({
        model: config.ai.openaiEmbeddingModel,
        input: texts,
        dimensions: EMBEDDING_DIMENSIONS,
        encoding_format: 'float',
      })
      .withResponse();
    await recordAiUsage(context, {
      model: config.ai.openaiEmbeddingModel,
      provider: openaiProvider(),
      status: 'success',
      inputTokens: response.usage?.prompt_tokens,
      outputTokens: 0,
      totalTokens: response.usage?.total_tokens,
      requestId: http.headers.get('avalai-request-id'),
    });
    return response.data.map((item) => item.embedding);
  } catch (error) {
    await recordAiUsage(context, {
      model: config.ai.openaiEmbeddingModel,
      provider: openaiProvider(),
      status: 'failed',
    });
    throw error;
  }
}
