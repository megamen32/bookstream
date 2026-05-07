import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { mapAnnotationComment, mapAnnotationQuote, sortItemsByCreatedAt } from '@/lib/annotations'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const readerId = searchParams.get('readerId')
    const bookId = searchParams.get('bookId')

    if (!readerId || !bookId) {
      return NextResponse.json(
        { error: 'readerId and bookId are required' },
        { status: 400 },
      )
    }

    const annotations = await db.annotation.findMany({
      where: {
        readerId,
        bookId,
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
      take: 200,
    })

    const comments = sortItemsByCreatedAt(
      annotations
        .filter((annotation) => annotation.kind === 'comment')
        .map((annotation) => mapAnnotationComment(annotation, readerId)),
    )

    const quotes = sortItemsByCreatedAt(
      annotations
        .filter((annotation) => annotation.kind === 'quote')
        .map((annotation) => mapAnnotationQuote(annotation, readerId))
        .filter((annotation): annotation is NonNullable<typeof annotation> => Boolean(annotation)),
    )

    const reactions = sortItemsByCreatedAt(
      annotations
        .filter((annotation) => annotation.kind === 'reaction')
        .map((annotation) => ({
          id: annotation.id,
          createdAt: annotation.createdAt.toISOString(),
          chapterId: annotation.chapter.id,
          chapterTitle: annotation.chapter.title,
          chapterPosition: annotation.chapter.position,
          paragraphId: annotation.paragraphId,
          endParagraphId: annotation.endParagraphId,
          startOffset: annotation.startOffset,
          endOffset: annotation.endOffset,
          selectedText: annotation.selectedText,
          emoji: annotation.emoji || '',
          variantType: annotation.variantType,
        })),
    )

    return NextResponse.json({
      quotes,
      comments,
      reactions,
    })
  } catch (error) {
    console.error('Error fetching reader activity:', error)
    return NextResponse.json(
      { error: 'Failed to fetch reader activity' },
      { status: 500 },
    )
  }
}
