import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

interface RouteParams {
  quoteId: string
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<RouteParams> },
) {
  try {
    const { quoteId } = await params
    const body = await request.json()
    const readerId = typeof body.readerId === 'string' ? body.readerId : ''

    if (!readerId) {
      return NextResponse.json({ error: 'readerId is required' }, { status: 400 })
    }

    const annotation = await db.annotation.findUnique({
      where: { id: quoteId },
      select: {
        id: true,
        kind: true,
      },
    })

    if (annotation?.kind === 'quote') {
      const existing = await db.annotationVote.findUnique({
        where: {
          annotationId_readerId: {
            annotationId: quoteId,
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
            annotationId: quoteId,
            readerId,
          },
        })
      }

      const upvoteCount = await db.annotationVote.count({
        where: {
          annotationId: quoteId,
        },
      })

      return NextResponse.json({
        action: existing ? 'removed' : 'added',
        upvoteCount,
        reacted: !existing,
      })
    }

    const existingLegacy = await db.quoteUpvote.findUnique({
      where: {
        commentQuoteId_readerId: {
          commentQuoteId: quoteId,
          readerId,
        },
      },
    })

    if (existingLegacy) {
      await db.quoteUpvote.delete({
        where: { id: existingLegacy.id },
      })
    } else {
      await db.quoteUpvote.create({
        data: {
          commentQuoteId: quoteId,
          readerId,
        },
      })
    }

    const upvoteCount = await db.quoteUpvote.count({
      where: {
        commentQuoteId: quoteId,
      },
    })

    return NextResponse.json({
      action: existingLegacy ? 'removed' : 'added',
      upvoteCount,
      reacted: !existingLegacy,
    })
  } catch (error) {
    console.error('Error toggling quote upvote:', error)
    return NextResponse.json({ error: 'Failed to toggle quote upvote' }, { status: 500 })
  }
}
