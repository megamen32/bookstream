import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { summarizeReaderLlmConfig } from '@/lib/llm'

interface ReaderLlmMutationBody {
  readerId?: string
  apiKey?: string
  baseUrl?: string
  model?: string
  apiFormat?: 'anthropic' | 'chat-completions' | 'responses'
}

/**
 * POST /api/readers/llm
 * Saves or clears reader-specific LLM settings.
 */
export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as ReaderLlmMutationBody
    const readerId = body.readerId?.trim()
    const apiKey = body.apiKey?.trim() || ''
    const baseUrl = body.baseUrl?.trim() || ''
    const model = body.model?.trim() || ''
    const apiFormat = body.apiFormat || 'chat-completions'

    if (!readerId) {
      return NextResponse.json({ error: 'readerId is required' }, { status: 400 })
    }

    const shouldClear = !apiKey && !baseUrl && !model
    if (!shouldClear && (!apiKey || !baseUrl || !model)) {
      return NextResponse.json(
        { error: 'Для LLM нужны сразу apiKey, baseUrl и model' },
        { status: 400 }
      )
    }

    const reader = await db.reader.update({
      where: { id: readerId },
      data: shouldClear
        ? {
            llmApiKey: null,
            llmBaseUrl: null,
            llmModel: null,
            llmApiFormat: null,
          }
        : {
            llmApiKey: apiKey,
            llmBaseUrl: baseUrl,
            llmModel: model,
            llmApiFormat: apiFormat,
          },
      select: {
        id: true,
        isMainAdmin: true,
        llmApiKey: true,
        llmBaseUrl: true,
        llmModel: true,
        llmApiFormat: true,
      },
    })

    const summary = summarizeReaderLlmConfig(reader)
    return NextResponse.json({
      success: true,
      hasCustomLlmConfig: summary.hasCustomConfig,
      hasEffectiveLlmConfig: summary.hasEffectiveConfig,
      llmBaseUrl: summary.baseUrl,
      llmModel: summary.model,
      llmApiFormat: reader.llmApiFormat,
      llmConfigSource: summary.source,
    })
  } catch (error) {
    console.error('Error saving reader LLM settings:', error)
    return NextResponse.json({ error: 'Не удалось сохранить LLM настройки' }, { status: 500 })
  }
}
