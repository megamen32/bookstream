import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import {
  mapAnnotationComment,
  mapAnnotationQuote,
  sortCommentsByTop,
  sortQuotesByTop,
  type UnifiedAnnotationItem,
} from '@/lib/annotations'
import { buildParagraphInputsFromHtml, ensureVariantParagraphs } from '@/lib/chapter-variants'
import { type BibliographyItem } from '@/lib/books/annotations'
import type {
  OfflineBookRecord,
  OfflineBookQuoteRecord,
  OfflineProgressRecord,
  VariantPresetRecord,
} from '@/lib/offline-types'

interface RouteParams {
  bookId: string
}

function mapReaderAnnotation(annotation: {
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
  isSynthetic: boolean
  selectedText: string | null
  paragraphId: string | null
  endParagraphId: string | null
  startOffset: number
  endOffset: number
  chapter: {
    title: string
    position: number
  }
}): UnifiedAnnotationItem {
  return {
    id: annotation.id,
    kind: annotation.kind === 'comment' ? 'comment' : annotation.kind === 'quote' ? 'quote' : 'reaction',
    kindLabel: annotation.kind === 'comment' ? 'Комментарий' : annotation.kind === 'quote' ? 'Цитата' : 'Реакция',
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
    isSynthetic: annotation.isSynthetic,
    selectedText: annotation.selectedText,
    paragraphId: annotation.paragraphId,
    endParagraphId: annotation.endParagraphId,
    startOffset: annotation.startOffset,
    endOffset: annotation.endOffset,
    syncStatus: 'synced',
    offlineOperationId: null,
    syncError: null,
  }
}

function mapServerProgress(progress: {
  readerId: string
  bookId: string
  chapterId: string
  variantType: string
  scrollPercent: number
  fontSize: number
  lineHeight: number
  readingMode: string
  updatedAt: Date
} | null): OfflineProgressRecord | null {
  if (!progress) {
    return null
  }

  return {
    readerId: progress.readerId,
    bookId: progress.bookId,
    chapterId: progress.chapterId,
    variantType: progress.variantType,
    scrollPercent: progress.scrollPercent,
    fontSize: progress.fontSize,
    lineHeight: progress.lineHeight,
    readingMode: progress.readingMode === 'book' ? 'book' : 'feed',
    updatedAt: progress.updatedAt.toISOString(),
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<RouteParams> },
) {
  try {
    const { bookId } = await params
    const { searchParams } = new URL(request.url)
    const readerId = searchParams.get('readerId')

    const book = await db.book.findFirst({
      where: {
        id: bookId,
        isPublic: true,
      },
      include: {
        author: {
          select: {
            slug: true,
            name: true,
          },
        },
        chapters: {
          orderBy: { position: 'asc' },
          include: {
            variants: {
              orderBy: { createdAt: 'asc' },
            },
          },
        },
      },
    })

    if (!book) {
      return NextResponse.json({ error: 'Book not found' }, { status: 404 })
    }

    const presets = await db.variantPreset.findMany({
      orderBy: { position: 'asc' },
    })
    const variantPresets = Object.fromEntries(
      presets.map((preset) => [preset.slug, {
        id: preset.id,
        label: preset.label,
        emoji: preset.emoji,
        description: preset.description,
        targetSizePercent: preset.targetSizePercent,
        position: preset.position,
      } satisfies VariantPresetRecord]),
    )
    const bibliographyItems = await db.bibliographyItem.findMany({
      where: { bookId },
      orderBy: { number: 'asc' },
    })
    const bibliographyItemsByNumber = buildBibliographyItemsByNumber(bibliographyItems)

    const chapterRecords = await Promise.all(book.chapters.map(async (chapter, index) => {
      const variants = await Promise.all(chapter.variants.map(async (variant) => {
        const variantWithParagraphs = await db.chapterVariant.findUnique({
          where: { id: variant.id },
          include: {
            paragraphs: {
              orderBy: { position: 'asc' },
            },
          },
        })

        if (!variantWithParagraphs) {
          return null
        }

        const paragraphs = await ensureVariantParagraphs(
          db,
          variantWithParagraphs.id,
          variantWithParagraphs.contentHtml,
        )
        const parsedParagraphs = buildParagraphInputsFromHtml(variantWithParagraphs.contentHtml)

        return {
          id: variantWithParagraphs.id,
          variantType: variantWithParagraphs.variantType,
          paragraphs: paragraphs.map((paragraph, paragraphIndex) => ({
            ...paragraph,
            html: parsedParagraphs[paragraphIndex]?.html ?? paragraph.text,
            textAlign: parsedParagraphs[paragraphIndex]?.textAlign ?? null,
            indentPx: parsedParagraphs[paragraphIndex]?.indentPx ?? 0,
          })),
        }
      }))

      const [commentRows, quoteRows] = await Promise.all([
        db.annotation.findMany({
          where: {
            chapterId: chapter.id,
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
        }),
        db.annotation.findMany({
          where: {
            chapterId: chapter.id,
            kind: 'quote',
            status: 'active',
            selectedText: {
              not: null,
            },
            paragraphId: {
              not: null,
            },
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
          take: 50,
        }),
      ])

      const commentsPreview = sortCommentsByTop(
        commentRows.map((comment) => ({
          ...mapAnnotationComment(comment, readerId),
          syncStatus: 'synced' as const,
          offlineOperationId: null,
          syncError: null,
        })),
      )
      const leadComment = commentsPreview[0] || null
      const freshComments = commentsPreview
        .filter((comment) => comment.id !== leadComment?.id)
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
        .slice(0, 3)
      const quotesPreview = sortQuotesByTop(
        quoteRows
          .map((quote) => mapAnnotationQuote(quote, readerId))
          .filter((quote): quote is NonNullable<typeof quote> => Boolean(quote)),
      )
      const topQuote = quotesPreview[0] || null

      return {
        id: chapter.id,
        title: chapter.title,
        level: chapter.level,
        position: chapter.position,
        prevChapterId: book.chapters[index - 1]?.id || null,
        nextChapterId: book.chapters[index + 1]?.id || null,
        variants: variants.filter((variant): variant is NonNullable<typeof variant> => Boolean(variant)),
        bibliographyItemsByNumber,
        preview: {
          leadComment,
          freshComments,
          quotesPreview: quotesPreview.slice(0, 2).map((quote) => ({
            ...quote,
            reactionsCount: quote.upvoteCount,
            commentsCount: commentsPreview.filter((comment) => comment.paragraphId === quote.paragraphId).length,
          })),
          stats: {
            commentsCount: commentsPreview.length,
            reactionsCount: 0,
            quotesCount: quotesPreview.length,
            bookmarksCount: null,
            topQuote: topQuote ? {
              ...topQuote,
              reactionsCount: topQuote.upvoteCount,
              commentsCount: commentsPreview.filter((comment) => comment.paragraphId === topQuote.paragraphId).length,
            } : null,
          },
        },
        commentsPreview,
        commentCount: commentsPreview.length,
      }
    }))

    const chapterList = chapterRecords.map((chapter) => ({
      id: chapter.id,
      title: chapter.title,
      position: chapter.position,
      level: chapter.level,
      variants: chapter.variants.map((variant) => ({
        id: variant.id,
        variantType: variant.variantType,
      })),
    }))

    const [readerAnnotations, serverProgress] = await Promise.all([
      readerId
        ? db.annotation.findMany({
            where: {
              bookId,
              readerId,
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
        : Promise.resolve([]),
      readerId
        ? db.readingProgress.findUnique({
            where: {
              readerId_bookId: {
                readerId,
                bookId,
              },
            },
          })
        : Promise.resolve(null),
    ])

    const bookQuotes = sortQuotesByTop(
      chapterRecords
        .flatMap((chapter) => chapter.preview.quotesPreview)
        .filter((quote, index, entries) => entries.findIndex((entry) => entry.id === quote.id) === index)
        .map((quote): OfflineBookQuoteRecord => ({
          id: quote.id,
          text: quote.text,
          variantType: quote.variantType,
          variantLabel: variantPresets[quote.variantType]?.label || (quote.variantType === 'original' ? 'Оригинал' : quote.variantType),
          chapterId: quote.chapterId,
          paragraphId: quote.paragraphId || '',
          paragraphEndId: quote.paragraphEndId,
          startOffset: quote.startOffset,
          endOffset: quote.endOffset,
          chapterTitle: quote.chapterTitle,
          chapterPosition: quote.chapterPosition,
          username: quote.username,
          readerId: quote.readerId,
          createdAt: quote.createdAt,
          upvoteCount: quote.upvoteCount,
          reacted: quote.reacted,
          commentsCount: quote.commentsCount,
          reactionsCount: quote.reactionsCount,
          syncStatus: 'synced',
        })),
    )

    const payload: Omit<OfflineBookRecord, 'key' | 'estimatedSizeBytes'> = {
      book: {
        id: book.id,
        slug: book.slug,
        title: book.title,
        description: book.description,
        coverUrl: book.coverUrl,
        readingModeDefault: book.readingModeDefault === 'book' ? 'book' : 'feed',
        author: {
          slug: book.author.slug,
          name: book.author.name,
        },
      },
      bibliographyItemsByNumber,
      chapters: chapterRecords,
      chapterList,
      variantPresets,
      bookQuotes,
      readerAnnotations: readerAnnotations.map(mapReaderAnnotation),
      serverProgress: mapServerProgress(serverProgress),
      downloadedAt: new Date().toISOString(),
    }

    return NextResponse.json(payload)
  } catch (error) {
    console.error('Error building offline package:', error)
    return NextResponse.json({ error: 'Failed to build offline package' }, { status: 500 })
  }
}

function buildBibliographyItemsByNumber(items: Array<{
  number: number
  rawText: string
  normalizedText: string | null
}>): Record<string, BibliographyItem> {
  return Object.fromEntries(items.map((item) => [
    String(item.number),
    {
      number: item.number,
      rawText: item.rawText,
      normalizedText: item.normalizedText,
    } satisfies BibliographyItem,
  ]))
}
