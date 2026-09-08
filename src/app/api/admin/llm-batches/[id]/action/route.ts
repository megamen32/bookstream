import { NextRequest, NextResponse } from 'next/server'
import { getAdminSessionReader } from '@/lib/admin-auth'
import { db } from '@/lib/db'

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const reader = await getAdminSessionReader(request)
  if (!reader) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await params
  const { action } = await request.json() as { action?: 'pause'|'resume'|'cancel'|'retry-failed' }
  const batch = await db.llmBatch.findUnique({ where: { id }, select: { id: true, readerId: true, status: true } })
  if (!batch || (!reader.isMainAdmin && batch.readerId !== reader.id)) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  if (action === 'pause') await db.llmBatch.update({ where: { id }, data: { status: 'paused' } })
  else if (action === 'resume') await db.llmBatch.update({ where: { id }, data: { status: 'running', completedAt: null, pauseReason: null } })
  else if (action === 'cancel') {
    await db.$transaction([
      db.llmBatch.update({ where: { id }, data: { status: 'cancelled', completedAt: new Date() } }),
      db.llmJob.updateMany({ where: { batchId: id, status: 'queued' }, data: { status: 'cancelled', completedAt: new Date() } }),
    ])
  } else if (action === 'retry-failed') {
    await db.$transaction([
      db.llmBatch.update({ where: { id }, data: { status: 'running', completedAt: null, pauseReason: null } }),
      db.llmJob.updateMany({ where: { batchId: id, status: { in: ['failed','cancelled'] } }, data: { status: 'queued', attempts: 0, availableAt: new Date(), completedAt: null, startedAt: null, lastError: null, inputTokens: null, noCacheInputTokens: null, cacheReadTokens: null, cacheWriteTokens: null, outputTokens: null, totalTokens: null, actualCostUsd: null } }),
    ])
  } else return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
  return NextResponse.json({ success: true })
}
