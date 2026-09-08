import type OpenAI from 'openai'
import { runByokModel, type ByokConfig } from '@bezrabotnyi/byok'

interface ChatCompletionParams {
  messages: OpenAI.Chat.ChatCompletionMessageParam[]
  temperature?: number
  maxTokens?: number
}

export interface LlmConfig {
  apiKey: string
  baseUrl: string
  model: string
  apiFormat?: ByokConfig['apiFormat']
}

export interface ReaderLlmConfigShape {
  isMainAdmin?: boolean
  llmApiKey?: string | null
  llmBaseUrl?: string | null
  llmModel?: string | null
  llmApiFormat?: string | null
}

export type LlmConfigSource = 'custom' | 'main-admin-default' | 'none'

export interface ReaderLlmSummary {
  hasCustomConfig: boolean
  hasEffectiveConfig: boolean
  baseUrl: string | null
  model: string | null
  source: LlmConfigSource
}

function inferApiFormat(baseUrl: string): ByokConfig['apiFormat'] {
  const normalized = baseUrl.toLowerCase().replace(/\/+$/, '')
  if (normalized.endsWith('/anthropic') || normalized.includes('/anthropic/')) return 'anthropic'
  if (normalized.endsWith('/responses')) return 'responses'
  return 'chat-completions'
}

export function getEnvironmentLlmConfig(): LlmConfig | null {
  const apiKey = process.env.LLM_API_KEY?.trim()
  const baseUrl = process.env.LLM_BASE_URL?.trim()
  const model = process.env.LLM_MODEL?.trim()
  const apiFormat = process.env.LLM_API_FORMAT?.trim() as ByokConfig['apiFormat'] | undefined

  if (!apiKey || !baseUrl || !model) return null

  return {
    apiKey,
    baseUrl: baseUrl.replace(/\/+$/, ''),
    model,
    apiFormat: apiFormat || inferApiFormat(baseUrl),
  }
}

export function resolveReaderLlmConfig(reader: ReaderLlmConfigShape): {
  config: LlmConfig
  source: Exclude<LlmConfigSource, 'none'>
} | null {
  const customApiKey = reader.llmApiKey?.trim()
  const customBaseUrl = reader.llmBaseUrl?.trim()
  const customModel = reader.llmModel?.trim()

  if (customApiKey && customBaseUrl && customModel) {
    return {
      config: {
        apiKey: customApiKey,
        baseUrl: customBaseUrl.replace(/\/+$/, ''),
        model: customModel,
        apiFormat: (reader.llmApiFormat as ByokConfig['apiFormat'] | null) || inferApiFormat(customBaseUrl),
      },
      source: 'custom',
    }
  }

  if (reader.isMainAdmin) {
    const fallback = getEnvironmentLlmConfig()
    if (fallback) return { config: fallback, source: 'main-admin-default' }
  }

  return null
}

export function summarizeReaderLlmConfig(reader: ReaderLlmConfigShape): ReaderLlmSummary {
  const resolved = resolveReaderLlmConfig(reader)
  return {
    hasCustomConfig: Boolean(reader.llmApiKey?.trim() && reader.llmBaseUrl?.trim() && reader.llmModel?.trim()),
    hasEffectiveConfig: Boolean(resolved),
    baseUrl: resolved?.config.baseUrl || null,
    model: resolved?.config.model || null,
    source: resolved?.source || 'none',
  }
}

export async function createChatCompletion(params: ChatCompletionParams, config?: LlmConfig): Promise<string> {
  const effectiveConfig = config || getEnvironmentLlmConfig()
  if (!effectiveConfig) throw new Error('LLM configuration is missing')

  const messages = params.messages.map((message) => ({
    role: message.role,
    content: typeof message.content === 'string' ? message.content : JSON.stringify(message.content),
  })) as Array<{ role: 'system' | 'user' | 'assistant'; content: string }>

  return runByokModel({
    apiKey: effectiveConfig.apiKey,
    baseUrl: effectiveConfig.baseUrl,
    modelId: effectiveConfig.model,
    apiFormat: effectiveConfig.apiFormat || inferApiFormat(effectiveConfig.baseUrl),
    reasoningEffort: 'default',
    maxOutputTokens: params.maxTokens ?? 4000,
  }, { messages })
}
