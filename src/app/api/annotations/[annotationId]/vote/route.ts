import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

interface RouteParams {
  annotationId: string
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<RouteParams> },
) {
  try {
    const { annotationId } = await params
    const body = await request.json()
    const readerId = typeof body.readerId === 'string' ? body.readerId : ''

    if (!readerId) {
      return NextResponse.json({ error: 'readerId is required' }, { status: 400 })
    }

    const annotation = await db.annotation.findUnique({
      where: { id: annotationId },
      select: {
        id: true,
        kind: true,
      },
    })

    if (!annotation || (annotation.kind !== 'quote' && annotation.kind !== 'comment')) {
      return NextResponse.json({ error: 'Annotation not found' }, { status: 404 })
    }

    const existing = await db.annotationVote.findUnique({
      where: {
        annotationId_readerId: {
          annotationId,
          readerId,
        },
      },
    })

    if (existing) {
      await db.annotationVote.delete({
        where: { id: existing.id },
      })
    } else {
      await db.annotationVote.create({
        data: {
          annotationId,
          readerId,
        },
      })
    }

    const upvoteCount = await db.annotationVote.count({
      where: {
        annotationId,
      },
    })

    return NextResponse.json({
      action: existing ? 'removed' : 'added',
      upvoteCount,
      reacted: !existing,
    })
  } catch (error) {
    console.error('Error toggling annotation vote:', error)
    return NextResponse.json({ error: 'Failed to toggle annotation vote' }, { status: 500 })
  }
}
