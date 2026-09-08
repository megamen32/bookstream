import { buildByokPresetsFromModelsDev, calculateUsageCostUsd, estimateCostUsd, fallbackByokPresets, MODELS_DEV_URL, type ByokPreset } from '@bezrabotnyi/byok/catalog'
import { runByokModelDetailed, type ByokConfig } from '@bezrabotnyi/byok'
import { ledger } from '@/lib/byok-ledger'
import { db } from '@/lib/db'
import { resolveReaderLlmConfig, type LlmConfig } from '@/lib/llm'
import { saveChapterVariantRevision } from '@/lib/chapter-revisions'
import { canPayerStartJob, type PayerRef } from '@/lib/llm-billing'

export type PromptJobPayload = {
  systemPrompt: string
  userPrompt: string
}

export type ChapterVariantJobPayload = PromptJobPayload & {
  chapterId: string
  variantType: string
  systemPrompt: string
  userPrompt: string
}

function normalizeBaseUrl(value: string) {
  return value.replace(/\/+$/, '').toLowerCase()
}

function configApiFormat(config: LlmConfig): ByokConfig['apiFormat'] {
  if (config.apiFormat) return config.apiFormat
  const url = config.baseUrl.toLowerCase()
  if (url.includes('/anthropic')) return 'anthropic'
  if (url.endsWith('/responses')) return 'responses'
  return 'chat-completions'
}

let catalogCache: { presets: ByokPreset[]; expiresAt: number } | null = null

async function loadCatalog(): Promise<ByokPreset[]> {
  if (catalogCache && catalogCache.expiresAt > Date.now()) return catalogCache.presets
  try {
    const response = await fetch(MODELS_DEV_URL, {
      headers: { 'user-agent': 'Bookstream-LLM-Queue/1.0' },
      signal: AbortSignal.timeout(5000),
    })
    if (!response.ok) throw new Error(`models.dev ${response.status}`)
    const presets = buildByokPresetsFromModelsDev(await response.json())
    catalogCache = { presets, expiresAt: Date.now() + 60 * 60 * 1000 }
    return presets
  } catch {
    catalogCache = { presets: fallbackByokPresets, expiresAt: Date.now() + 5 * 60 * 1000 }
    return fallbackByokPresets
  }
}

async function priceForConfig(config: LlmConfig) {
  const presets = await loadCatalog()
  let host = ''
  try { host = new URL(config.baseUrl).hostname } catch {}
  const preset = presets.find((item) => item.modelId === config.model && (() => {
    try { return new URL(item.baseUrl).hostname === host } catch { return false }
  })()) || presets.find((item) => item.modelId === config.model)
  return {
    inputPricePerMillionUsd: preset?.inputPricePerMillionUsd ?? null,
    cacheReadPricePerMillionUsd: preset?.cacheReadPricePerMillionUsd ?? null,
    cacheWritePricePerMillionUsd: preset?.cacheWritePricePerMillionUsd ?? null,
    outputPricePerMillionUsd: preset?.outputPricePerMillionUsd ?? null,
  }
}

function estimateInputTokens(systemPrompt: string, userPrompt: string) {
  // Deliberately marked as an estimate. Actual provider usage replaces it after execution.
  return Math.max(1, Math.ceil((systemPrompt.length + userPrompt.length) / 4))
}

async function buildJobPricing(config: LlmConfig, systemPrompt: string, userPrompt: string, maxOutputTokens: number) {
  const prices = await priceForConfig(config)
  const estimatedInputTokens = estimateInputTokens(systemPrompt, userPrompt)
  const estimatedOutputTokens = maxOutputTokens
  return {
    ...prices,
    estimatedInputTokens,
    estimatedOutputTokens,
    estimatedCostUsd: estimateCostUsd(estimatedInputTokens, estimatedOutputTokens, prices),
  }
}

export async function enqueuePromptJob(input: {
  readerId: string
  systemPrompt: string
  userPrompt: string
  maxOutputTokens?: number
  priority?: number
  batchId?: string
  authorId?: string
  bookId?: string
  payerType?: 'reader' | 'author'
  payerId?: string
}) {
  const reader = await db.reader.findUnique({
    where: { id: input.readerId },
    select: { id: true, isMainAdmin: true, llmApiKey: true, llmBaseUrl: true, llmModel: true, llmApiFormat: true },
  })
  if (!reader) throw new Error('Reader not found')
  const resolved = resolveReaderLlmConfig(reader)
  if (!resolved) throw new Error('LLM configuration is missing')
  const config = resolved.config
  const maxOutputTokens = input.maxOutputTokens ?? 4000
  const pricing = await buildJobPricing(config, input.systemPrompt, input.userPrompt, maxOutputTokens)
  return db.llmJob.create({
    data: {
      readerId: input.readerId,
      batchId: input.batchId,
      authorId: input.authorId,
      bookId: input.bookId,
      payerType: input.payerType || 'reader',
      payerId: input.payerId || input.readerId,
      kind: 'prompt',
      status: 'queued',
      priority: input.priority ?? 0,
      payloadJson: JSON.stringify({ systemPrompt: input.systemPrompt, userPrompt: input.userPrompt } satisfies PromptJobPayload),
      model: config.model,
      baseUrl: normalizeBaseUrl(config.baseUrl),
      apiFormat: configApiFormat(config),
      maxOutputTokens,
      ...pricing,
    },
  })
}

export async function enqueueChapterVariantJob(input: {
  readerId: string
  chapterId: string
  variantType: string
  systemPrompt: string
  userPrompt: string
  maxOutputTokens?: number
  priority?: number
  batchId?: string
  authorId?: string
  bookId?: string
  payerType?: 'reader' | 'author'
  payerId?: string
}) {
  const reader = await db.reader.findUnique({
    where: { id: input.readerId },
    select: {
      id: true,
      isMainAdmin: true,
      llmApiKey: true,
      llmBaseUrl: true,
      llmModel: true,
      llmApiFormat: true,
    },
  })
  if (!reader) throw new Error('Reader not found')
  const resolved = resolveReaderLlmConfig(reader)
  if (!resolved) throw new Error('LLM configuration is missing')
  const config = resolved.config
  const maxOutputTokens = input.maxOutputTokens ?? 4000
  const pricing = await buildJobPricing(config, input.systemPrompt, input.userPrompt, maxOutputTokens)
  const chapterMeta = (!input.authorId || !input.bookId)
    ? await db.chapter.findUnique({
        where: { id: input.chapterId },
        select: { bookId: true, book: { select: { authorId: true } } },
      })
    : null
  const authorId = input.authorId || chapterMeta?.book.authorId || null
  const bookId = input.bookId || chapterMeta?.bookId || null
  const payload: ChapterVariantJobPayload = {
    chapterId: input.chapterId,
    variantType: input.variantType,
    systemPrompt: input.systemPrompt,
    userPrompt: input.userPrompt,
  }

  return db.llmJob.create({
    data: {
      readerId: input.readerId,
      batchId: input.batchId,
      authorId,
      bookId,
      payerType: input.payerType || 'reader',
      payerId: input.payerId || input.readerId,
      kind: 'chapter-variant',
      status: 'queued',
      priority: input.priority ?? 0,
      payloadJson: JSON.stringify(payload),
      model: config.model,
      baseUrl: normalizeBaseUrl(config.baseUrl),
      apiFormat: configApiFormat(config),
      maxOutputTokens,
      ...pricing,
    },
  })
}

function escapeHtml(value: string) {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;')
}

async function saveVariant(payload: ChapterVariantJobPayload, text: string) {
  const paragraphs = text.split(/\n+/).map((item) => item.trim()).filter(Boolean)
  if (!paragraphs.length) throw new Error('Provider returned no usable paragraphs')
  const contentHtml = paragraphs.map((paragraph) => `<p>${escapeHtml(paragraph)}</p>`).join('\n')
  await db.$transaction((tx) => saveChapterVariantRevision(tx, {
    chapterId: payload.chapterId,
    variantType: payload.variantType,
    contentHtml,
    editedByAuthor: false,
    source: 'ai',
  }))
}

async function loadJobConfig(readerId: string | null): Promise<LlmConfig> {
  if (!readerId) throw new Error('Job has no reader owner')
  const reader = await db.reader.findUnique({
    where: { id: readerId },
    select: { isMainAdmin: true, llmApiKey: true, llmBaseUrl: true, llmModel: true, llmApiFormat: true },
  })
  const resolved = reader ? resolveReaderLlmConfig(reader) : null
  if (!resolved) throw new Error('LLM configuration is no longer available')
  return resolved.config
}

function providerKey(baseUrl: string, model: string) {
  return `${normalizeBaseUrl(baseUrl)}::${model}`
}

async function providerAvailable(baseUrl: string, model: string) {
  const state = await db.llmProviderState.findUnique({ where: { providerKey: providerKey(baseUrl, model) } })
  return !state?.rateLimitedUntil || state.rateLimitedUntil <= new Date()
}

async function registerProviderRateLimit(baseUrl: string, model: string, message: string) {
  const cooldownMs = Number(process.env.LLM_RATE_LIMIT_COOLDOWN_MS || 60_000)
  const until = new Date(Date.now() + Math.max(5_000, cooldownMs))
  await db.llmProviderState.upsert({
    where: { providerKey: providerKey(baseUrl, model) },
    create: { providerKey: providerKey(baseUrl, model), baseUrl: normalizeBaseUrl(baseUrl), model, rateLimitedUntil: until, lastError: message },
    update: { rateLimitedUntil: until, lastError: message },
  })
  return until
}

export async function claimNextLlmJob() {
  const candidates = await db.llmJob.findMany({
    where: {
      status: 'queued',
      availableAt: { lte: new Date() },
      OR: [
        { batchId: null },
        { batch: { is: { status: 'running' } } },
      ],
    },
    orderBy: [{ priority: 'desc' }, { createdAt: 'asc' }],
    take: 50,
  })
  for (const candidate of candidates) {
    if (!(await providerAvailable(candidate.baseUrl, candidate.model))) continue
    const payer: PayerRef = {
      payerType: candidate.payerType === 'author' ? 'author' : 'reader',
      payerId: candidate.payerId || candidate.readerId || '',
    }
    if (!payer.payerId) continue
    const allowed = await canPayerStartJob(payer, candidate.estimatedCostUsd)
    if (!allowed.ok) {
      if (candidate.batchId && !allowed.temporary) {
        await db.llmBatch.update({
          where: { id: candidate.batchId },
          data: { status: 'paused-budget', pauseReason: allowed.reason },
        }).catch(() => undefined)
      } else if (!candidate.batchId && !allowed.temporary) {
        await db.llmJob.update({ where: { id: candidate.id }, data: { status: 'blocked-budget', completedAt: new Date(), lastError: allowed.reason } })
      }
      continue
    }
    const claimed = await db.llmJob.updateMany({
      where: { id: candidate.id, status: 'queued' },
      data: { status: 'running', startedAt: new Date(), attempts: { increment: 1 }, lastError: null },
    })
    if (claimed.count === 1) return db.llmJob.findUnique({ where: { id: candidate.id } })
  }
  return null
}

export async function refreshLlmBatch(batchId: string | null) {
  if (!batchId) return
  const batch = await db.llmBatch.findUnique({ where: { id: batchId }, select: { status: true } })
  if (!batch || ['cancelled', 'paused'].includes(batch.status)) return
  const active = await db.llmJob.count({ where: { batchId, status: { in: ['queued', 'running'] } } })
  if (active === 0) {
    await db.llmBatch.update({ where: { id: batchId }, data: { status: 'completed', completedAt: new Date() } })
  }
}

export async function executeLlmJob(job: NonNullable<Awaited<ReturnType<typeof claimNextLlmJob>>>) {
  try {
    if (!['chapter-variant', 'prompt'].includes(job.kind)) throw new Error(`Unsupported job kind: ${job.kind}`)
    const payload = JSON.parse(job.payloadJson) as PromptJobPayload | ChapterVariantJobPayload
    const config = await loadJobConfig(job.readerId)
    const result = await runByokModelDetailed({
      apiKey: config.apiKey,
      baseUrl: config.baseUrl,
      modelId: config.model,
      apiFormat: configApiFormat(config),
      reasoningEffort: 'default',
      maxOutputTokens: job.maxOutputTokens,
    }, {
      messages: [
        { role: 'system', content: payload.systemPrompt },
        { role: 'user', content: payload.userPrompt },
      ],
    }, {
      timeoutMs: Number(process.env.LLM_JOB_REQUEST_TIMEOUT_MS || 120_000),
    })

    if (job.kind === 'chapter-variant') await saveVariant(payload as ChapterVariantJobPayload, result.text)
    const actualCostUsd = calculateUsageCostUsd(result.usage, {
      inputPricePerMillionUsd: job.inputPricePerMillionUsd,
      cacheReadPricePerMillionUsd: job.cacheReadPricePerMillionUsd,
      cacheWritePricePerMillionUsd: job.cacheWritePricePerMillionUsd,
      outputPricePerMillionUsd: job.outputPricePerMillionUsd,
    })
    const think = result.text.match(/<think>([\s\S]*?)<\/think>/)
    await ledger.record({
      userId: job.readerId ?? undefined, taskId: job.batchId ?? undefined, sessionId: job.id,
      model: job.model, providerHost: job.baseUrl ? new URL(job.baseUrl.startsWith('http') ? job.baseUrl : `https://${job.baseUrl}`).hostname : '',
      usage: result.usage,
      pricing: {
        inputPricePerMillionUsd: job.inputPricePerMillionUsd,
        cacheReadPricePerMillionUsd: job.cacheReadPricePerMillionUsd,
        cacheWritePricePerMillionUsd: job.cacheWritePricePerMillionUsd,
        outputPricePerMillionUsd: job.outputPricePerMillionUsd,
      },
      durationMs: 0, ok: true,
      system: payload.systemPrompt, prompt: payload.userPrompt,
      reasoning: think ? think[1].trim() : undefined,
      completion: think ? result.text.replace(/<think>[\s\S]*?<\/think>/, '').trim() : result.text,
    })

    await db.llmJob.update({
      where: { id: job.id },
      data: {
        status: 'succeeded',
        resultText: result.text,
        inputTokens: result.usage.inputTokens,
        noCacheInputTokens: result.usage.noCacheInputTokens,
        cacheReadTokens: result.usage.cacheReadTokens,
        cacheWriteTokens: result.usage.cacheWriteTokens,
        outputTokens: result.usage.outputTokens,
        totalTokens: result.usage.totalTokens,
        actualCostUsd,
        completedAt: new Date(),
        lastError: null,
      },
    })
    await refreshLlmBatch(job.batchId)
  } catch (error) {
    const message = (error instanceof Error ? error.message : String(error)).slice(0, 4000)
    const isRateLimit = /\b429\b|rate.?limit|too many requests|throttl/i.test(message)
    const rateLimitedUntil = isRateLimit ? await registerProviderRateLimit(job.baseUrl, job.model, message) : null
    const canRetry = job.attempts < job.maxAttempts
    const delaySeconds = isRateLimit ? Math.max(60, Math.ceil(((rateLimitedUntil?.getTime() || Date.now()) - Date.now()) / 1000)) : Math.min(300, 10 * 2 ** Math.max(0, job.attempts - 1))
    await db.llmJob.update({
      where: { id: job.id },
      data: canRetry ? {
        status: 'queued',
        availableAt: new Date(Date.now() + delaySeconds * 1000),
        lastError: message,
      } : {
        status: 'failed',
        completedAt: new Date(),
        lastError: message,
      },
    })
    await refreshLlmBatch(job.batchId)
  }
}

export async function recoverStaleLlmJobs() {
  const staleBefore = new Date(Date.now() - 15 * 60 * 1000)
  return db.llmJob.updateMany({
    where: { status: 'running', startedAt: { lt: staleBefore } },
    data: { status: 'queued', availableAt: new Date(), lastError: 'Recovered after worker interruption' },
  })
}
