import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import {
  annotationKindFromString,
  annotationKindLabel,
  buildAnnotationSelection,
  type AnnotationKind,
} from '@/lib/annotations'

interface AnnotationResponseItem {
  id: string
  kind: AnnotationKind
  kindLabel: string
  createdAt: string
  bookId: string
  chapterId: string
  chapterTitle: string
  chapterPosition: number
  chapterVariantId: string | null
  variantType: string
  readerId: string
  username: string
  body: string | null
  emoji: string | null
  selectedText: string | null
  paragraphId: string | null
  endParagraphId: string | null
  startOffset: number
  endOffset: number
}

function mapAnnotationRow(annotation: {
  id: string
  kind: string
  createdAt: Date
  bookId: string
  chapterId: string
  chapterVariantId: string | null
  variantType: string
  readerId: string
  username: string
  body: string | null
  emoji: string | null
  selectedText: string | null
  paragraphId: string | null
  endParagraphId: string | null
  startOffset: number
  endOffset: number
  chapter: {
    title: string
    position: number
  }
}): AnnotationResponseItem {
  const kind = annotationKindFromString(annotation.kind)

  return {
    id: annotation.id,
    kind,
    kindLabel: annotationKindLabel(kind),
    createdAt: annotation.createdAt.toISOString(),
    bookId: annotation.bookId,
    chapterId: annotation.chapterId,
    chapterTitle: annotation.chapter.title,
    chapterPosition: annotation.chapter.position,
    chapterVariantId: annotation.chapterVariantId,
    variantType: annotation.variantType,
    readerId: annotation.readerId,
    username: annotation.username,
    body: annotation.body,
    emoji: annotation.emoji,
    selectedText: annotation.selectedText,
    paragraphId: annotation.paragraphId,
    endParagraphId: annotation.endParagraphId,
    startOffset: annotation.startOffset,
    endOffset: annotation.endOffset,
  }
}

async function loadAnnotations(params: {
  bookId?: string | null
  chapterId?: string | null
  readerId?: string | null
  kind?: AnnotationKind | null
}): Promise<AnnotationResponseItem[]> {
  const { bookId, chapterId, readerId, kind } = params

  const annotationRows = await db.annotation.findMany({
    where: {
      ...(bookId ? { bookId } : {}),
      ...(chapterId ? { chapterId } : {}),
      ...(readerId ? { readerId } : {}),
      ...(kind ? { kind } : {}),
      status: 'active',
    },
    include: {
      chapter: {
        select: {
          title: true,
          position: true,
        },
      },
    },
    orderBy: { createdAt: 'desc' },
    take: 300,
  })

  return annotationRows.map(mapAnnotationRow)
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const bookId = searchParams.get('bookId')
    const chapterId = searchParams.get('chapterId')
    const readerId = searchParams.get('readerId')
    const kindParam = searchParams.get('kind')

    const kind = kindParam ? annotationKindFromString(kindParam) : null

    if (!bookId && !chapterId && !readerId) {
      return NextResponse.json({ error: 'At least one filter is required' }, { status: 400 })
    }

    const annotations = await loadAnnotations({ bookId, chapterId, readerId, kind })
    return NextResponse.json({ annotations })
  } catch (error) {
    console.error('Error fetching annotations:', error)
    return NextResponse.json({ error: 'Failed to fetch annotations' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const kind = annotationKindFromString(typeof body.kind === 'string' ? body.kind : 'reaction')
    const readerId = typeof body.readerId === 'string' ? body.readerId : ''
    const username = typeof body.username === 'string' ? body.username.trim() : ''
    const emoji = typeof body.emoji === 'string' && body.emoji.length > 0 ? body.emoji : null
    const bodyText = typeof body.body === 'string' ? body.body.trim() : ''
    const variantType =
      typeof body.variantType === 'string' && body.variantType.length > 0 ? body.variantType : 'original'
    const selection = buildAnnotationSelection(body.selection ?? body)

    let bookId = typeof body.bookId === 'string' ? body.bookId : ''
    let chapterId = typeof body.chapterId === 'string' ? body.chapterId : ''
    let chapterVariantId = typeof body.chapterVariantId === 'string' ? body.chapterVariantId : null

    if ((!bookId || !chapterId) && chapterVariantId) {
      const chapterVariant = await db.chapterVariant.findUnique({
        where: { id: chapterVariantId },
        select: {
          id: true,
          variantType: true,
          chapter: {
            select: {
              id: true,
              bookId: true,
            },
          },
        },
      })

      if (chapterVariant) {
        bookId = bookId || chapterVariant.chapter.bookId
        chapterId = chapterId || chapterVariant.chapter.id
      }
    }

    if (!readerId || !username || !bookId || !chapterId) {
      return NextResponse.json(
        { error: 'readerId, username, bookId, and chapterId are required' },
        { status: 400 },
      )
    }

    if (kind !== 'comment' && !selection.paragraphId) {
      return NextResponse.json(
        { error: 'paragraphId is required for selected-text annotations' },
        { status: 400 },
      )
    }

    if (kind === 'comment') {
      const annotation = await db.annotation.create({
        data: {
          bookId,
          chapterId,
          chapterVariantId,
          variantType,
          readerId,
          username,
          kind,
          status: 'active',
          body: bodyText || null,
          emoji: null,
          selectedText: selection.selectedText || null,
          paragraphId: selection.paragraphId || null,
          endParagraphId: selection.endParagraphId || null,
          startOffset: selection.startOffset,
          endOffset: selection.endOffset,
        },
        include: {
          chapter: {
            select: {
              title: true,
              position: true,
            },
          },
        },
      })

      return NextResponse.json(
        {
          action: 'added',
          annotation: mapAnnotationRow(annotation),
        },
        { status: 201 },
      )
    }

    const existing = await db.annotation.findFirst({
      where: {
        kind,
        readerId,
        bookId,
        chapterId,
        chapterVariantId,
        paragraphId: selection.paragraphId,
        endParagraphId: selection.endParagraphId,
        startOffset: selection.startOffset,
        endOffset: selection.endOffset,
        ...(kind === 'reaction' ? { emoji: emoji || '' } : {}),
        ...(kind === 'quote' ? { selectedText: selection.selectedText } : {}),
      },
    })

    if (existing) {
      await db.annotation.delete({ where: { id: existing.id } })
      return NextResponse.json({
        action: 'removed',
        kind,
      })
    }

    if (kind === 'reaction' && !emoji) {
      return NextResponse.json({ error: 'emoji is required for reactions' }, { status: 400 })
    }

    if (kind === 'quote' && selection.selectedText.trim().length === 0) {
      return NextResponse.json({ error: 'selectedText is required for quotes' }, { status: 400 })
    }

    const annotation = await db.annotation.create({
      data: {
        bookId,
        chapterId,
        chapterVariantId,
        variantType,
        readerId,
        username,
        kind,
        status: 'active',
        body: null,
        emoji,
        selectedText: selection.selectedText || null,
        paragraphId: selection.paragraphId,
        endParagraphId: selection.endParagraphId,
        startOffset: selection.startOffset,
        endOffset: selection.endOffset,
      },
      include: {
        chapter: {
          select: {
            title: true,
            position: true,
          },
        },
      },
    })

    return NextResponse.json(
      {
        action: 'added',
        annotation: mapAnnotationRow(annotation),
      },
      { status: 201 },
    )
  } catch (error) {
    console.error('Error creating annotation:', error)
    return NextResponse.json({ error: 'Failed to create annotation' }, { status: 500 })
  }
}
