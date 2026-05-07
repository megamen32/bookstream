import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { buildAnnotationSelection } from '@/lib/annotations'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    const [annotations, legacyComments] = await Promise.all([
      db.annotation.findMany({
        where: {
          chapterId: id,
          kind: 'comment',
          status: 'active',
        },
        orderBy: { createdAt: 'desc' },
      }),
      db.comment.findMany({
        where: {
          chapterId: id,
          status: 'active',
        },
        include: {
          quotes: true,
        },
        orderBy: { createdAt: 'desc' },
        take: 50,
      }),
    ])

    const comments = [
      ...annotations.map((annotation) => ({
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
      })),
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
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()
    const { readerId, username, body: commentBody, bookId, quotes } = body

    if (!readerId || !username || !commentBody || !bookId) {
      return NextResponse.json(
        { error: 'readerId, username, body, and bookId are required' },
        { status: 400 },
      )
    }

    const comment = await db.annotation.create({
      data: {
        bookId,
        chapterId: id,
        chapterVariantId: typeof quotes?.[0]?.chapterVariantId === 'string' ? quotes[0].chapterVariantId : null,
        variantType: typeof quotes?.[0]?.variantType === 'string' && quotes[0].variantType.length > 0 ? quotes[0].variantType : 'original',
        readerId,
        username,
        kind: 'comment',
        status: 'active',
        body: commentBody,
        selectedText: typeof quotes?.[0]?.selectedText === 'string' ? quotes[0].selectedText : null,
        paragraphId: typeof quotes?.[0]?.paragraphId === 'string' ? quotes[0].paragraphId : null,
        endParagraphId: typeof quotes?.[0]?.endParagraphId === 'string' ? quotes[0].endParagraphId : null,
        startOffset: Number.isFinite(quotes?.[0]?.startOffset) ? Number(quotes[0].startOffset) : 0,
        endOffset: Number.isFinite(quotes?.[0]?.endOffset) ? Number(quotes[0].endOffset) : 0,
      },
    })

    return NextResponse.json({
      comment: {
        id: comment.id,
        readerId: comment.readerId,
        username: comment.username,
        body: comment.body || '',
        createdAt: comment.createdAt.toISOString(),
        quotes: comment.paragraphId && comment.selectedText
          ? [{
              id: `${comment.id}:quote`,
              variantType: comment.variantType,
              selectedText: comment.selectedText,
              paragraphId: comment.paragraphId,
              endParagraphId: comment.endParagraphId,
            }]
          : [],
      },
    }, { status: 201 })
  } catch (error) {
    console.error('Error creating comment:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
