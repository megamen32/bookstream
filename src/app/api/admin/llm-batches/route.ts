import { NextRequest, NextResponse } from 'next/server'
import { getAdminSessionReader } from '@/lib/admin-auth'
import { db } from '@/lib/db'

export async function GET(request: NextRequest) {
  const reader = await getAdminSessionReader(request)
  if (!reader) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const batches = await db.llmBatch.findMany({
    where: reader.isMainAdmin ? {} : { readerId: reader.id },
    orderBy: { createdAt: 'desc' },
    take: 100,
    include: {
      author: { select: { name: true, slug: true } },
      book: { select: { title: true, slug: true } },
      jobs: { select: { status: true, inputTokens: true, outputTokens: true, totalTokens: true, actualCostUsd: true, estimatedCostUsd: true, startedAt: true, completedAt: true } },
    },
  })
  const payerReaderIds = [...new Set(batches.filter((b) => b.payerType === 'reader' && b.payerId).map((b) => b.payerId!))]
  const payerAuthorIds = [...new Set(batches.filter((b) => b.payerType === 'author' && b.payerId).map((b) => b.payerId!))]
  const [payerReaders, payerAuthors] = await Promise.all([
    db.reader.findMany({ where: { id: { in: payerReaderIds } }, select: { id: true, currentUsername: true } }),
    db.author.findMany({ where: { id: { in: payerAuthorIds } }, select: { id: true, name: true } }),
  ])
  const payerReaderNames = new Map(payerReaders.map((x) => [x.id, x.currentUsername]))
  const payerAuthorNames = new Map(payerAuthors.map((x) => [x.id, x.name]))
  return NextResponse.json({ batches: batches.map((batch) => {
    const counts: Record<string, number> = {}
    let actualCostUsd = 0, estimatedCostUsd = 0, totalTokens = 0, durationMs = 0, durationSamples = 0
    for (const job of batch.jobs) {
      counts[job.status] = (counts[job.status] || 0) + 1
      actualCostUsd += job.actualCostUsd || 0
      estimatedCostUsd += job.estimatedCostUsd || 0
      totalTokens += job.totalTokens || 0
      if (job.startedAt && job.completedAt) { durationMs += job.completedAt.getTime() - job.startedAt.getTime(); durationSamples += 1 }
    }
    const avgJobSeconds = durationSamples ? durationMs / durationSamples / 1000 : null
    const remainingJobs = Math.max(0, batch.totalJobs - ((counts.succeeded||0)+(counts.failed||0)+(counts.cancelled||0)))
    const etaSeconds = avgJobSeconds == null ? null : Math.ceil(avgJobSeconds * remainingJobs / Math.max(1, counts.running || 1))
    const payerLabel = batch.payerType === 'author' ? payerAuthorNames.get(batch.payerId || '') : payerReaderNames.get(batch.payerId || '')
    return { ...batch, payerLabel: payerLabel || '—', avgJobSeconds, etaSeconds, jobs: undefined, counts, actualCostUsd, estimatedCostUsd, totalTokens, completedJobs: (counts.succeeded||0)+(counts.failed||0)+(counts.cancelled||0) }
  }) })
}
