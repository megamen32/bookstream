import OpenAI from 'openai'

interface ChatCompletionParams {
  messages: OpenAI.Chat.ChatCompletionMessageParam[]
  temperature?: number
  maxTokens?: number
}

export interface LlmConfig {
  apiKey: string
  baseUrl: string
  model: string
}

export interface ReaderLlmConfigShape {
  isMainAdmin?: boolean
  llmApiKey?: string | null
  llmBaseUrl?: string | null
  llmModel?: string | null
}

export type LlmConfigSource = 'custom' | 'main-admin-default' | 'none'

export interface ReaderLlmSummary {
  hasCustomConfig: boolean
  hasEffectiveConfig: boolean
  baseUrl: string | null
  model: string | null
  source: LlmConfigSource
}

/**
 * Reads the default environment LLM configuration when it is fully defined.
 *
 * @returns Validated API key, base URL, and model name, or `null` when env config is incomplete.
 */
export function getEnvironmentLlmConfig(): LlmConfig | null {
  const apiKey = process.env.LLM_API_KEY?.trim()
  const baseUrl = process.env.LLM_BASE_URL?.trim()
  const model = process.env.LLM_MODEL?.trim()

  if (!apiKey || !baseUrl || !model) {
    return null
  }

  return {
    apiKey,
    baseUrl: baseUrl.replace(/\/+$/, ''),
    model,
  }
}

/**
 * Resolves effective LLM settings for a reader.
 *
 * Custom values always win. The environment fallback is available only to the main admin.
 *
 * @param reader Reader row or partial reader settings.
 * @returns Effective config plus its source, or `null` when nothing usable exists.
 */
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
      },
      source: 'custom',
    }
  }

  if (reader.isMainAdmin) {
    const fallback = getEnvironmentLlmConfig()
    if (fallback) {
      return {
        config: fallback,
        source: 'main-admin-default',
      }
    }
  }

  return null
}

/**
 * Builds a UI-friendly summary of a reader's LLM availability without exposing the API key.
 *
 * @param reader Reader row or partial reader settings.
 * @returns Summary for settings screens and generation preflight checks.
 */
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

/**
 * Builds an OpenAI-compatible SDK client for the given config.
 *
 * @param config Effective provider configuration.
 * @returns Configured SDK client and selected model name.
 */
function getLlmClient(config: LlmConfig): { client: OpenAI; model: string } {
  return {
    client: new OpenAI({
      apiKey: config.apiKey,
      baseURL: config.baseUrl,
    }),
    model: config.model,
  }
}

/**
 * Sends a chat completion request to an OpenAI-compatible provider.
 *
 * When `config` is omitted, the function falls back to the default environment config.
 *
 * @param params Chat messages and completion tuning values.
 * @param config Effective provider configuration.
 * @returns Assistant text content.
 * @throws Error when the SDK request fails or the provider returns an empty payload.
 */
export async function createChatCompletion(params: ChatCompletionParams, config?: LlmConfig): Promise<string> {
  const effectiveConfig = config || getEnvironmentLlmConfig()
  if (!effectiveConfig) {
    throw new Error('LLM configuration is missing')
  }

  const { client, model } = getLlmClient(effectiveConfig)

  const completion = await client.chat.completions.create({
    model,
    messages: params.messages,
    temperature: params.temperature ?? 0.3,
    max_tokens: params.maxTokens ?? 4000,
  })

  const content = completion.choices[0]?.message?.content?.trim()
  if (!content) {
    throw new Error('LLM provider returned an empty completion')
  }

  return content
}
