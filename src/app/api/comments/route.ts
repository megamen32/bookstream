import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import {
  buildAnnotationSelection,
  mapAnnotationComment,
  sortCommentsByTop,
} from '@/lib/annotations'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const chapterId = searchParams.get('chapterId')
    const readerId = searchParams.get('readerId')

    if (!chapterId) {
      return NextResponse.json({ error: 'chapterId is required' }, { status: 400 })
    }

    const comments = await db.annotation.findMany({
      where: {
        chapterId,
        kind: 'comment',
        status: 'active',
      },
      include: {
        votes: {
          select: {
            readerId: true,
          },
        },
        chapter: {
          select: {
            id: true,
            title: true,
            position: true,
          },
        },
      },
      take: 100,
    })

    return NextResponse.json({
      comments: sortCommentsByTop(comments.map((comment) => mapAnnotationComment(comment, readerId))),
    })
  } catch (error) {
    console.error('Error fetching comments:', error)
    return NextResponse.json({ error: 'Failed to fetch comments' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { bookId, chapterId, readerId, username, body: commentBody, quote } = body

    if (!bookId || !chapterId || !readerId || !username || !commentBody) {
      return NextResponse.json(
        { error: 'bookId, chapterId, readerId, username, and body are required' },
        { status: 400 },
      )
    }

    const fifteenSecondsAgo = new Date(Date.now() - 15_000)
    const recentComment = await db.annotation.findFirst({
      where: {
        readerId,
        chapterId,
        kind: 'comment',
        createdAt: { gte: fifteenSecondsAgo },
      },
      select: { id: true },
    })

    if (recentComment) {
      return NextResponse.json(
        { error: 'Please wait before posting another comment (15s cooldown)' },
        { status: 429 },
      )
    }

    const selection = quote ? buildAnnotationSelection(quote) : null

    const created = await db.annotation.create({
      data: {
        bookId,
        chapterId,
        chapterVariantId: typeof quote?.chapterVariantId === 'string' ? quote.chapterVariantId : null,
        variantType:
          typeof quote?.variantType === 'string' && quote.variantType.length > 0
            ? quote.variantType
            : 'original',
        readerId,
        username,
        kind: 'comment',
        status: 'active',
        body: commentBody,
        emoji: null,
        selectedText: selection?.selectedText || null,
        paragraphId: selection?.paragraphId || null,
        endParagraphId: selection?.endParagraphId || null,
        startOffset: selection?.startOffset || 0,
        endOffset: selection?.endOffset || 0,
      },
      include: {
        votes: {
          select: {
            readerId: true,
          },
        },
        chapter: {
          select: {
            id: true,
            title: true,
            position: true,
          },
        },
      },
    })

    return NextResponse.json({ comment: mapAnnotationComment(created, readerId) }, { status: 201 })
  } catch (error) {
    console.error('Error creating comment:', error)
    return NextResponse.json({ error: 'Failed to create comment' }, { status: 500 })
  }
}
