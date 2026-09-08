import { NextRequest, NextResponse } from 'next/server'
import { getAdminSessionReader } from '@/lib/admin-auth'
import { db } from '@/lib/db'

export async function GET(request: NextRequest) {
  const reader = await getAdminSessionReader(request)
  if (!reader) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const status = request.nextUrl.searchParams.get('status')
  const where = {
    ...(reader.isMainAdmin ? {} : { readerId: reader.id }),
    ...(status && status !== 'all' ? { status } : {}),
  }
  const [jobs, counts] = await Promise.all([
    db.llmJob.findMany({ where, orderBy: { createdAt: 'desc' }, take: 200 }),
    db.llmJob.groupBy({
      by: ['status'],
      where: reader.isMainAdmin ? {} : { readerId: reader.id },
      _count: { _all: true },
    }),
  ])
  return NextResponse.json({
    jobs: jobs.map((job) => ({ ...job, payloadJson: undefined, resultText: undefined })),
    counts: Object.fromEntries(counts.map((item) => [item.status, item._count._all])),
  })
}
