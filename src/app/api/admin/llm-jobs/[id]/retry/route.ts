import { NextRequest, NextResponse } from 'next/server'
import { getAdminSessionReader } from '@/lib/admin-auth'
import { db } from '@/lib/db'

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const reader = await getAdminSessionReader(request)
  if (!reader) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await params
  const job = await db.llmJob.findUnique({ where: { id }, select: { id: true, readerId: true, status: true } })
  if (!job || (!reader.isMainAdmin && job.readerId !== reader.id)) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (job.status === 'running') return NextResponse.json({ error: 'Running job cannot be retried' }, { status: 409 })
  const updated = await db.llmJob.update({
    where: { id },
    data: {
      status: 'queued', attempts: 0, availableAt: new Date(), startedAt: null, completedAt: null,
      lastError: null, resultText: null, inputTokens: null, noCacheInputTokens: null, cacheReadTokens: null, cacheWriteTokens: null, outputTokens: null, totalTokens: null, actualCostUsd: null,
    },
  })
  return NextResponse.json({ success: true, id: updated.id })
}
