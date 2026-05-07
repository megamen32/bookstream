import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { buildAnnotationSelection } from '@/lib/annotations'

interface CommentQuoteItem {
  id: string
  variantType: string
  selectedText: string
  paragraphId: string
  endParagraphId?: string | null
}

interface CommentItem {
  id: string
  readerId: string
  username: string
  body: string
  createdAt: string
  quotes: CommentQuoteItem[]
}

function mapCommentAnnotation(annotation: {
  id: string
  createdAt: Date
  readerId: string
  username: string
  body: string | null
  variantType: string
  selectedText: string | null
  paragraphId: string | null
  endParagraphId: string | null
}): CommentItem {
  return {
    id: annotation.id,
    readerId: annotation.readerId,
    username: annotation.username,
    body: annotation.body || '',
    createdAt: annotation.createdAt.toISOString(),
    quotes: annotation.paragraphId && annotation.selectedText
      ? [{
          id: `${annotation.id}:quote`,
          variantType: annotation.variantType,
          selectedText: annotation.selectedText,
          paragraphId: annotation.paragraphId,
          endParagraphId: annotation.endParagraphId,
        }]
      : [],
  }
}

// GET /api/comments — Get comments for a chapter
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const chapterId = searchParams.get('chapterId')
    const readerId = searchParams.get('readerId')

    if (!chapterId) {
      return NextResponse.json(
        { error: 'chapterId is required' },
        { status: 400 },
      )
    }

    const [annotations, legacyComments] = await Promise.all([
      db.annotation.findMany({
        where: {
          chapterId,
          kind: 'comment',
        },
        orderBy: { createdAt: 'desc' },
      }),
      db.comment.findMany({
        where: {
          chapterId,
          ...(readerId
            ? {
                OR: [
                  { status: { not: 'shadowbanned' } },
                  { readerId },
                ],
              }
            : { status: { not: 'shadowbanned' } }),
        },
        orderBy: { createdAt: 'desc' },
        include: {
          quotes: true,
        },
      }),
    ])

    const comments: CommentItem[] = [
      ...annotations.map(mapCommentAnnotation),
      ...legacyComments.map((comment) => ({
        id: comment.id,
        readerId: comment.readerId,
        username: comment.username,
        body: comment.body,
        createdAt: comment.createdAt.toISOString(),
        quotes: comment.quotes.map((quote) => ({
          id: quote.id,
          variantType: quote.variantType,
          selectedText: quote.selectedText,
          paragraphId: quote.paragraphId,
          endParagraphId: quote.endParagraphId,
        })),
      })),
    ].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())

    return NextResponse.json({ comments })
  } catch (error) {
    console.error('Error fetching comments:', error)
    return NextResponse.json(
      { error: 'Failed to fetch comments' },
      { status: 500 },
    )
  }
}

// POST /api/comments — Create comment
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
        kind: 'comment',
        createdAt: { gte: fifteenSecondsAgo },
      },
    })

    if (recentComment) {
      return NextResponse.json(
        { error: 'Please wait before posting another comment (15s cooldown)' },
        { status: 429 },
      )
    }

    const annotationSelection = quote
      ? buildAnnotationSelection({
          paragraphId: quote.paragraphId,
          endParagraphId: quote.endParagraphId || quote.paragraphId,
          startOffset: quote.startOffset || 0,
          endOffset: quote.endOffset || 0,
          selectedText: quote.selectedText,
        })
      : null

    const created = await db.annotation.create({
      data: {
        bookId,
        chapterId,
        chapterVariantId: typeof quote?.chapterVariantId === 'string' ? quote.chapterVariantId : null,
        variantType: typeof quote?.variantType === 'string' && quote.variantType.length > 0 ? quote.variantType : 'original',
        readerId,
        username,
        kind: 'comment',
        status: 'active',
        body: commentBody,
        emoji: null,
        selectedText: annotationSelection?.selectedText || null,
        paragraphId: annotationSelection?.paragraphId || null,
        endParagraphId: annotationSelection?.endParagraphId || null,
        startOffset: annotationSelection?.startOffset || 0,
        endOffset: annotationSelection?.endOffset || 0,
      },
    })

    return NextResponse.json(
      {
        id: created.id,
        readerId: created.readerId,
        username: created.username,
        body: created.body || '',
        createdAt: created.createdAt.toISOString(),
        quotes: created.paragraphId && created.selectedText
          ? [{
              id: `${created.id}:quote`,
              variantType: created.variantType,
              selectedText: created.selectedText,
              paragraphId: created.paragraphId,
              endParagraphId: created.endParagraphId,
            }]
          : [],
      },
      { status: 201 },
    )
  } catch (error) {
    console.error('Error creating comment:', error)
    return NextResponse.json(
      { error: 'Failed to create comment' },
      { status: 500 },
    )
  }
}
