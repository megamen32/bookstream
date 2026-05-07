import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import {
  annotationBadgeLabel,
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

function mapLegacyReactionRow(reaction: {
  id: string
  createdAt: Date
  paragraphId: string
  endParagraphId: string | null
  startOffset: number
  endOffset: number
  selectedText: string | null
  emoji: string
  readerId: string
  chapterVariant: {
    id: string
    variantType: string
    chapter: {
      id: string
      title: string
      position: number
      bookId: string
    }
  }
}): AnnotationResponseItem {
  return {
    id: `legacy-reaction:${reaction.id}`,
    kind: 'reaction',
    kindLabel: annotationBadgeLabel('reaction'),
    createdAt: reaction.createdAt.toISOString(),
    bookId: reaction.chapterVariant.chapter.bookId,
    chapterId: reaction.chapterVariant.chapter.id,
    chapterTitle: reaction.chapterVariant.chapter.title,
    chapterPosition: reaction.chapterVariant.chapter.position,
    chapterVariantId: reaction.chapterVariant.id,
    variantType: reaction.chapterVariant.variantType,
    readerId: reaction.readerId,
    username: '',
    body: null,
    emoji: reaction.emoji,
    selectedText: reaction.selectedText,
    paragraphId: reaction.paragraphId,
    endParagraphId: reaction.endParagraphId,
    startOffset: reaction.startOffset,
    endOffset: reaction.endOffset,
  }
}

function mapLegacyQuoteRow(quote: {
  id: string
  createdAt: Date
  paragraphId: string
  endParagraphId: string | null
  selectedText: string
  variantType: string
  startOffset: number
  endOffset: number
  comment: {
    id: string
    body: string
    readerId: string
    username: string
    chapter: {
      id: string
      title: string
      position: number
      bookId: string
    }
  }
}): AnnotationResponseItem {
  return {
    id: `legacy-quote:${quote.id}`,
    kind: 'quote',
    kindLabel: annotationBadgeLabel('quote'),
    createdAt: quote.createdAt.toISOString(),
    bookId: quote.comment.chapter.bookId,
    chapterId: quote.comment.chapter.id,
    chapterTitle: quote.comment.chapter.title,
    chapterPosition: quote.comment.chapter.position,
    chapterVariantId: null,
    variantType: quote.variantType,
    readerId: quote.comment.readerId,
    username: quote.comment.username,
    body: quote.comment.body,
    emoji: null,
    selectedText: quote.selectedText,
    paragraphId: quote.paragraphId,
    endParagraphId: quote.endParagraphId,
    startOffset: quote.startOffset,
    endOffset: quote.endOffset,
  }
}

function mapLegacyCommentRow(comment: {
  id: string
  createdAt: Date
  bookId: string
  chapterId: string
  readerId: string
  username: string
  body: string
  chapter: {
    title: string
    position: number
  }
  quotes: Array<{
    id: string
    paragraphId: string
    endParagraphId: string | null
    selectedText: string
    variantType: string
    startOffset: number
    endOffset: number
  }>
}): AnnotationResponseItem {
  const firstQuote = comment.quotes[0]
  const selectedText = firstQuote?.selectedText ?? null
  const paragraphId = firstQuote?.paragraphId ?? null
  const endParagraphId = firstQuote?.endParagraphId ?? null
  const startOffset = firstQuote?.startOffset ?? 0
  const endOffset = firstQuote?.endOffset ?? 0

  return {
    id: `legacy-comment:${comment.id}`,
    kind: 'comment',
    kindLabel: annotationKindLabel('comment'),
    createdAt: comment.createdAt.toISOString(),
    bookId: comment.bookId,
    chapterId: comment.chapterId,
    chapterTitle: comment.chapter.title,
    chapterPosition: comment.chapter.position,
    chapterVariantId: null,
    variantType: firstQuote?.variantType ?? 'original',
    readerId: comment.readerId,
    username: comment.username,
    body: comment.body,
    emoji: null,
    selectedText,
    paragraphId,
    endParagraphId,
    startOffset,
    endOffset,
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

  const legacyKinds = kind ? [kind] : ['reaction', 'quote', 'comment']
  const legacyItems: AnnotationResponseItem[] = []

  if (legacyKinds.includes('reaction')) {
    const reactions = await db.reaction.findMany({
      where: {
        ...(readerId ? { readerId } : {}),
        ...(chapterId
          ? {
              chapterVariant: {
                chapterId,
              },
            }
          : bookId
            ? {
                chapterVariant: {
                  chapter: {
                    bookId,
                  },
                },
              }
            : {}),
      },
      select: {
        id: true,
        createdAt: true,
        paragraphId: true,
        endParagraphId: true,
        startOffset: true,
        endOffset: true,
        selectedText: true,
        emoji: true,
        readerId: true,
        chapterVariant: {
          select: {
            id: true,
            variantType: true,
            chapter: {
              select: {
                id: true,
                title: true,
                position: true,
                bookId: true,
              },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 300,
    })
    legacyItems.push(...reactions.map(mapLegacyReactionRow))
  }

  if (legacyKinds.includes('quote')) {
    const quotes = await db.commentQuote.findMany({
      where: {
        comment: {
          ...(readerId ? { readerId } : {}),
          ...(chapterId ? { chapterId } : {}),
          ...(bookId ? { bookId } : {}),
        },
      },
        select: {
          id: true,
          createdAt: true,
          paragraphId: true,
          endParagraphId: true,
          selectedText: true,
          startOffset: true,
          endOffset: true,
          variantType: true,
          comment: {
          select: {
            id: true,
            body: true,
            readerId: true,
            username: true,
            chapter: {
              select: {
                id: true,
                title: true,
                position: true,
                bookId: true,
              },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 300,
    })
    legacyItems.push(...quotes.map(mapLegacyQuoteRow))
  }

  if (legacyKinds.includes('comment')) {
    const comments = await db.comment.findMany({
      where: {
        ...(readerId ? { readerId } : {}),
        ...(chapterId ? { chapterId } : {}),
        ...(bookId ? { bookId } : {}),
      },
      select: {
        id: true,
        createdAt: true,
        bookId: true,
        chapterId: true,
        readerId: true,
        username: true,
        body: true,
        chapter: {
          select: {
            title: true,
            position: true,
          },
        },
          quotes: {
            select: {
              id: true,
              paragraphId: true,
              endParagraphId: true,
              selectedText: true,
              variantType: true,
              startOffset: true,
              endOffset: true,
            },
          },
        },
      orderBy: { createdAt: 'desc' },
      take: 300,
    })
    legacyItems.push(...comments.map(mapLegacyCommentRow))
  }

  const combined = [...annotationRows.map(mapAnnotationRow), ...legacyItems]
  const seen = new Set<string>()

  return combined
    .filter((item) => {
      const key = [
        item.kind,
        item.bookId,
        item.chapterId,
        item.readerId,
        item.paragraphId || '',
        item.endParagraphId || '',
        item.startOffset,
        item.endOffset,
        item.emoji || '',
        item.selectedText || '',
        item.body || '',
      ].join('|')
      if (seen.has(key)) {
        return false
      }
      seen.add(key)
      return true
    })
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
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
    const variantType = typeof body.variantType === 'string' && body.variantType.length > 0 ? body.variantType : 'original'
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
