import OpenAI from 'openai';
import { config } from '../config';

// Anthropic فاقد API عمومی embedding است، پس بدون توجه به AI_PROVIDER همیشه از کلاینت سازگار
// با OpenAI استفاده می‌کنیم (که برای Gemini از طریق OPENAI_BASE_URL هم کار می‌کنه)
const client = new OpenAI({ apiKey: config.ai.openaiApiKey, baseURL: config.ai.openaiBaseUrl });

// باید دقیقاً با ستون vector(768) در مایگریشن Phase4AiSchema برابر باشه.
// gemini-embedding-001 پیش‌فرض ۳۰۷۲ بعدی برمی‌گردونه؛ با این پارامتر به ۷۶۸ برش می‌خوره.
const EMBEDDING_DIMENSIONS = 768;

export async function embedTexts(texts: string[]): Promise<number[][]> {
  const response = await client.embeddings.create({
    model: config.ai.openaiEmbeddingModel,
    input: texts,
    dimensions: EMBEDDING_DIMENSIONS,
  });
  return response.data.map((item) => item.embedding);
}
