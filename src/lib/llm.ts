import OpenAI from 'openai'

interface ChatCompletionParams {
  messages: OpenAI.Chat.ChatCompletionMessageParam[]
  temperature?: number
  maxTokens?: number
}

interface LlmConfig {
  apiKey: string
  baseUrl: string
  model: string
}

/**
 * Reads required LLM configuration from environment variables.
 *
 * @returns Validated API key, base URL, and model name.
 * @throws Error when any required variable is missing.
 */
function getLlmConfig(): LlmConfig {
  const apiKey = process.env.LLM_API_KEY
  const baseUrl = process.env.LLM_BASE_URL
  const model = process.env.LLM_MODEL

  if (!apiKey) {
    throw new Error('Missing required environment variable: LLM_API_KEY')
  }

  if (!baseUrl) {
    throw new Error('Missing required environment variable: LLM_BASE_URL')
  }

  if (!model) {
    throw new Error('Missing required environment variable: LLM_MODEL')
  }

  return {
    apiKey,
    baseUrl: baseUrl.replace(/\/+$/, ''),
    model,
  }
}

/**
 * Builds an OpenAI-compatible SDK client using provider configuration from env.
 *
 * @returns Configured SDK client and selected model name.
 * @throws Error when any required variable is missing.
 */
function getLlmClient(): { client: OpenAI; model: string } {
  const { apiKey, baseUrl, model } = getLlmConfig()

  return {
    client: new OpenAI({
      apiKey,
      baseURL: baseUrl,
    }),
    model,
  }
}

/**
 * Sends a chat completion request to the configured OpenAI-compatible provider.
 *
 * @param params Chat messages and completion tuning values.
 * @returns Assistant text content.
 * @throws Error when the SDK request fails or the provider returns an empty payload.
 */
export async function createChatCompletion(params: ChatCompletionParams): Promise<string> {
  const { client, model } = getLlmClient()

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
