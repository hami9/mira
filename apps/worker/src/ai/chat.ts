import OpenAI from 'openai';
import Anthropic from '@anthropic-ai/sdk';
import { config } from '../config';
import type { AiUsageContext } from '@mira/shared-types';
import { recordAiUsage } from './usage';

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

const openaiClient = new OpenAI({
  apiKey: config.ai.openaiApiKey,
  baseURL: config.ai.openaiBaseUrl,
  timeout: 25_000,
  maxRetries: 0,
});
const anthropicClient = new Anthropic({
  apiKey: config.ai.anthropicApiKey,
  timeout: 25_000,
  maxRetries: 0,
});

// یک تابع واحد که بر اساس AI_PROVIDER بین OpenAI-compatible (شامل Gemini از طریق baseURL) و
// Anthropic سوییچ می‌کنه — بقیه‌ی کد worker هیچ‌وقت مستقیم با SDK یک پرووایدر خاص کار نمی‌کنه
export async function chatCompletion(
  messages: ChatMessage[],
  maxTokens = 1024,
  temperature?: number,
  model?: string,
  context?: AiUsageContext,
): Promise<string> {
  try {
    if (config.ai.chatProvider === 'anthropic') {
      return await anthropicChat(messages, maxTokens, temperature, model, context);
    }
    return await openaiChat(messages, maxTokens, temperature, model, context);
  } catch (error) {
    await recordAiUsage(context, {
      model:
        model ||
        (config.ai.chatProvider === 'anthropic' ? config.ai.anthropicModel : config.ai.openaiModel),
      provider: config.ai.chatProvider === 'anthropic' ? 'anthropic' : openaiProvider(),
      status: 'failed',
    });
    throw error;
  }
}

export function openaiProvider(): string {
  try {
    return ['api.avalai.ir', 'api.avalai.org', 'api.avalapis.ir'].includes(
      new URL(config.ai.openaiBaseUrl).hostname,
    )
      ? 'avalai'
      : 'openai';
  } catch {
    return 'openai';
  }
}

async function openaiChat(
  messages: ChatMessage[],
  maxTokens: number,
  temperature?: number,
  model?: string,
  context?: AiUsageContext,
): Promise<string> {
  const { data: response, response: http } = await openaiClient.chat.completions
    .create({
      model: model || config.ai.openaiModel,
      messages,
      max_tokens: maxTokens,
      ...(temperature !== undefined ? { temperature } : {}),
    })
    .withResponse();
  await recordAiUsage(context, {
    model: model || config.ai.openaiModel,
    provider: openaiProvider(),
    status: 'success',
    inputTokens: response.usage?.prompt_tokens,
    outputTokens: response.usage?.completion_tokens,
    totalTokens: response.usage?.total_tokens,
    requestId: http.headers.get('avalai-request-id'),
  });
  return response.choices[0]?.message?.content?.trim() ?? '';
}

async function anthropicChat(
  messages: ChatMessage[],
  maxTokens: number,
  temperature?: number,
  model?: string,
  context?: AiUsageContext,
): Promise<string> {
  const systemPrompt = messages
    .filter((m) => m.role === 'system')
    .map((m) => m.content)
    .join('\n\n');
  const conversation = messages
    .filter((m): m is ChatMessage & { role: 'user' | 'assistant' } => m.role !== 'system')
    .map((m) => ({ role: m.role, content: m.content }));

  const response = await anthropicClient.messages.create({
    model: model || config.ai.anthropicModel,
    max_tokens: maxTokens,
    system: systemPrompt || undefined,
    messages: conversation,
    ...(temperature !== undefined ? { temperature } : {}),
  });
  await recordAiUsage(context, {
    model: model || config.ai.anthropicModel,
    provider: 'anthropic',
    status: 'success',
    inputTokens: response.usage.input_tokens,
    outputTokens: response.usage.output_tokens,
    totalTokens: response.usage.input_tokens + response.usage.output_tokens,
  });
  const block = response.content[0];
  return block?.type === 'text' ? block.text.trim() : '';
}
