import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { summarizeReaderLlmConfig } from '@/lib/llm'

interface ReaderMutationBody {
  id?: string
  currentUsername?: string
}

interface ReaderResponse {
  id: string
  currentUsername: string
  loginName: string | null
  hasPassword: boolean
  isMainAdmin: boolean
  llmBaseUrl: string | null
  llmModel: string | null
  hasCustomLlmConfig: boolean
  hasEffectiveLlmConfig: boolean
  llmConfigSource: 'custom' | 'main-admin-default' | 'none'
}

// POST /api/readers — Create or update reader
export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as ReaderMutationBody
    const id = body.id?.trim()
    const currentUsername = body.currentUsername?.trim()

    if (!id || !currentUsername) {
      return NextResponse.json(
        { error: 'id and currentUsername are required' },
        { status: 400 }
      )
    }

    const conflictingReader = await db.reader.findFirst({
      where: {
        loginName: currentUsername,
        NOT: { id },
      },
      select: { id: true },
    })

    if (conflictingReader) {
      return NextResponse.json(
        { error: 'Это имя уже занято другим пользователем для входа в админку' },
        { status: 409 }
      )
    }

    const reader = await db.reader.upsert({
      where: { id },
      update: {
        currentUsername,
        loginName: currentUsername,
      },
      create: {
        id,
        currentUsername,
        loginName: currentUsername,
      },
      select: {
        id: true,
        currentUsername: true,
        loginName: true,
        passwordHash: true,
        isMainAdmin: true,
        llmApiKey: true,
        llmBaseUrl: true,
        llmModel: true,
      },
    })

    const llmSummary = summarizeReaderLlmConfig(reader)

    const payload: ReaderResponse = {
      id: reader.id,
      currentUsername: reader.currentUsername,
      loginName: reader.loginName,
      hasPassword: Boolean(reader.passwordHash),
      isMainAdmin: reader.isMainAdmin,
      llmBaseUrl: llmSummary.baseUrl,
      llmModel: llmSummary.model,
      hasCustomLlmConfig: llmSummary.hasCustomConfig,
      hasEffectiveLlmConfig: llmSummary.hasEffectiveConfig,
      llmConfigSource: llmSummary.source,
    }

    return NextResponse.json(payload, { status: 201 })
  } catch (error) {
    console.error('Error creating/updating reader:', error)
    return NextResponse.json(
      { error: 'Failed to create or update reader' },
      { status: 500 }
    )
  }
}

// GET /api/readers — Get reader by id
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')?.trim()

    if (!id) {
      return NextResponse.json(
        { error: 'id query parameter is required' },
        { status: 400 }
      )
    }

    const reader = await db.reader.findUnique({
      where: { id },
      select: {
        id: true,
        currentUsername: true,
        loginName: true,
        passwordHash: true,
        isMainAdmin: true,
        llmApiKey: true,
        llmBaseUrl: true,
        llmModel: true,
      },
    })

    if (!reader) {
      return NextResponse.json(null)
    }

    const llmSummary = summarizeReaderLlmConfig(reader)
    const payload: ReaderResponse = {
      id: reader.id,
      currentUsername: reader.currentUsername,
      loginName: reader.loginName,
      hasPassword: Boolean(reader.passwordHash),
      isMainAdmin: reader.isMainAdmin,
      llmBaseUrl: llmSummary.baseUrl,
      llmModel: llmSummary.model,
      hasCustomLlmConfig: llmSummary.hasCustomConfig,
      hasEffectiveLlmConfig: llmSummary.hasEffectiveConfig,
      llmConfigSource: llmSummary.source,
    }

    return NextResponse.json(payload)
  } catch (error) {
    console.error('Error fetching reader:', error)
    return NextResponse.json(
      { error: 'Failed to fetch reader' },
      { status: 500 }
    )
  }
}
