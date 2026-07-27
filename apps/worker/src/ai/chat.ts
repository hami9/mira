import OpenAI from 'openai';
import Anthropic from '@anthropic-ai/sdk';
import { config } from '../config';

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

const openaiClient = new OpenAI({
  apiKey: config.ai.openaiApiKey,
  baseURL: config.ai.openaiBaseUrl,
});
const anthropicClient = new Anthropic({ apiKey: config.ai.anthropicApiKey });

// یک تابع واحد که بر اساس AI_PROVIDER بین OpenAI-compatible (شامل Gemini از طریق baseURL) و
// Anthropic سوییچ می‌کنه — بقیه‌ی کد worker هیچ‌وقت مستقیم با SDK یک پرووایدر خاص کار نمی‌کنه
export async function chatCompletion(
  messages: ChatMessage[],
  maxTokens = 1024,
  temperature?: number,
): Promise<string> {
  if (config.ai.chatProvider === 'anthropic') {
    return anthropicChat(messages, maxTokens, temperature);
  }
  return openaiChat(messages, maxTokens, temperature);
}

async function openaiChat(
  messages: ChatMessage[],
  maxTokens: number,
  temperature?: number,
): Promise<string> {
  const response = await openaiClient.chat.completions.create({
    model: config.ai.openaiModel,
    messages,
    max_tokens: maxTokens,
    ...(temperature !== undefined ? { temperature } : {}),
  });
  return response.choices[0]?.message?.content?.trim() ?? '';
}

async function anthropicChat(
  messages: ChatMessage[],
  maxTokens: number,
  temperature?: number,
): Promise<string> {
  const systemPrompt = messages
    .filter((m) => m.role === 'system')
    .map((m) => m.content)
    .join('\n\n');
  const conversation = messages
    .filter((m): m is ChatMessage & { role: 'user' | 'assistant' } => m.role !== 'system')
    .map((m) => ({ role: m.role, content: m.content }));

  const response = await anthropicClient.messages.create({
    model: config.ai.anthropicModel,
    max_tokens: maxTokens,
    system: systemPrompt || undefined,
    messages: conversation,
    ...(temperature !== undefined ? { temperature } : {}),
  });
  const block = response.content[0];
  return block?.type === 'text' ? block.text.trim() : '';
}
