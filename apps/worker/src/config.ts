import * as dotenv from 'dotenv';
import { join } from 'path';

dotenv.config({ path: join(__dirname, '../../../.env') });

function env(key: string, fallback = ''): string {
  return process.env[key] ?? fallback;
}

export const config = {
  databaseUrl: env('DATABASE_URL'),
  redis: {
    host: env('REDIS_HOST', 'localhost'),
    port: parseInt(env('REDIS_PORT', '6379'), 10),
    password: env('REDIS_PASSWORD') || undefined,
  },
  queuePrefix: env('QUEUE_PREFIX', 'mira'),
  ai: {
    chatProvider: env('AI_PROVIDER', 'openai') as 'openai' | 'anthropic',
    openaiApiKey: env('OPENAI_API_KEY'),
    openaiBaseUrl: env('OPENAI_BASE_URL', 'https://api.openai.com/v1'),
    openaiModel: env('OPENAI_MODEL', 'gpt-4o-mini'),
    openaiEmbeddingModel: env('OPENAI_EMBEDDING_MODEL', 'text-embedding-3-small'),
    anthropicApiKey: env('ANTHROPIC_API_KEY'),
    anthropicModel: env('ANTHROPIC_MODEL', 'claude-sonnet-5'),
    maxTokensPerConversation: parseInt(env('AI_MAX_TOKENS_PER_CONVERSATION', '20000'), 10),
  },
};
