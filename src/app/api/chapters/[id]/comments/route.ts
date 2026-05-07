import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import {
  buildAnnotationSelection,
  mapAnnotationComment,
  sortCommentsByTop,
} from '@/lib/annotations'
import { limitSyntheticItems } from '@/lib/synthetic-visibility'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params
    const { searchParams } = new URL(request.url)
    const readerId = searchParams.get('readerId')

    const chapter = await db.chapter.findUnique({
      where: { id },
      select: {
        book: {
          select: {
            syntheticCommentsPerChapter: true,
          },
        },
      },
    })

    if (!chapter) {
      return NextResponse.json({ error: 'Chapter not found' }, { status: 404 })
    }

    const annotations = await db.annotation.findMany({
      where: {
        chapterId: id,
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

    const visibleAnnotations = limitSyntheticItems(
      annotations,
      chapter.book.syntheticCommentsPerChapter,
    )

    const comments = sortCommentsByTop(
      visibleAnnotations.map((annotation) => mapAnnotationComment(annotation, readerId)),
    )

    return NextResponse.json({ comments })
  } catch (error) {
    console.error('Error fetching comments:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
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

    const fifteenSecondsAgo = new Date(Date.now() - 15_000)
    const recentComment = await db.annotation.findFirst({
      where: {
        readerId,
        chapterId: id,
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

    const selection = buildAnnotationSelection(quotes?.[0] ?? {})
    const comment = await db.annotation.create({
      data: {
        bookId,
        chapterId: id,
        chapterVariantId: typeof quotes?.[0]?.chapterVariantId === 'string' ? quotes[0].chapterVariantId : null,
        variantType:
          typeof quotes?.[0]?.variantType === 'string' && quotes[0].variantType.length > 0
            ? quotes[0].variantType
            : 'original',
        readerId,
        username,
        kind: 'comment',
        status: 'active',
        body: commentBody,
        selectedText: selection.selectedText || null,
        paragraphId: selection.paragraphId || null,
        endParagraphId: selection.endParagraphId || null,
        startOffset: selection.startOffset,
        endOffset: selection.endOffset,
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

    return NextResponse.json(
      {
        comment: mapAnnotationComment(comment, readerId),
      },
      { status: 201 },
    )
  } catch (error) {
    console.error('Error creating comment:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
