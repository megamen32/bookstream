import { NextRequest, NextResponse } from 'next/server'
import { getAdminSessionReader } from '@/lib/admin-auth'
import { db } from '@/lib/db'

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const reader = await getAdminSessionReader(request)
  if (!reader) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await params
  const job = await db.llmJob.findUnique({ where: { id }, select: { id: true, readerId: true, status: true } })
  if (!job || (!reader.isMainAdmin && job.readerId !== reader.id)) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (job.status !== 'queued') return NextResponse.json({ error: 'Only queued jobs can be cancelled' }, { status: 409 })
  await db.llmJob.update({ where: { id }, data: { status: 'cancelled', completedAt: new Date() } })
  return NextResponse.json({ success: true })
}
