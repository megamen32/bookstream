import { NextRequest, NextResponse } from 'next/server'
import { buildParagraphInputsFromHtml, ensureVariantParagraphs } from '@/lib/chapter-variants'
import { mapAnnotationComment, mapAnnotationQuote, sortCommentsByTop, sortQuotesByTop } from '@/lib/annotations'
import { buildOwnedBookWhere } from '@/lib/admin-ownership'
import { getAdminSessionReader } from '@/lib/admin-auth'
import { db } from '@/lib/db'
import { type BibliographyItem } from '@/lib/books/annotations'
import { hasReadableHtmlContent } from '@/lib/book-content'

interface RouteParams {
  bookId: string
}

async function getDraftAccessReaderId(request: NextRequest): Promise<string | null> {
  const { searchParams } = new URL(request.url)
  if (searchParams.get('includeDrafts') !== '1') {
    return null
  }

  const adminReader = await getAdminSessionReader(request)
  return adminReader?.id || null
}

function normalizeWindowParam(value: string | null, fallback: number): number {
  const parsed = Number.parseInt(value || '', 10)
  if (!Number.isFinite(parsed)) return fallback
  return Math.max(0, Math.min(parsed, 5))
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<RouteParams> },
) {
  try {
    const { bookId } = await params
    const { searchParams } = new URL(request.url)
    const variantType = searchParams.get('variantType') || 'original'
    const anchorChapterId = searchParams.get('anchorChapterId') || ''
    const readerId = searchParams.get('readerId')
    const before = normalizeWindowParam(searchParams.get('before'), 1)
    const after = normalizeWindowParam(searchParams.get('after'), 1)
    const previewLimit = normalizeWindowParam(searchParams.get('previewLimit'), 3) || 3
    const draftReaderId = await getDraftAccessReaderId(request)

    if (!anchorChapterId) {
      return NextResponse.json({ error: 'anchorChapterId is required' }, { status: 400 })
    }

    const book = await db.book.findFirst({
      where: {
        id: bookId,
        ...(draftReaderId ? buildOwnedBookWhere(draftReaderId) : { isPublic: true }),
      },
      select: {
        id: true,
        chapters: {
          orderBy: { position: 'asc' },
          select: {
            id: true,
            title: true,
            level: true,
            position: true,
            variants: {
              select: {
                id: true,
                variantType: true,
                contentHtml: true,
              },
            },
          },
        },
      },
    })

    if (!book) {
      return NextResponse.json({ error: 'Book not found' }, { status: 404 })
    }

    const visibleChapters = book.chapters
      .map(({ variants: chapterVariants, ...bookChapter }) => ({
        ...bookChapter,
        variants: chapterVariants,
        hasReadableContent: hasReadableHtmlContent(
          chapterVariants.find((variant) => variant.variantType === 'original')?.contentHtml
            || chapterVariants[0]?.contentHtml
            || '',
        ),
      }))
      .filter((bookChapter) => bookChapter.hasReadableContent)

    const anchorIndex = visibleChapters.findIndex((chapter) => chapter.id === anchorChapterId)
    if (anchorIndex < 0) {
      return NextResponse.json({ error: 'Chapter not found' }, { status: 404 })
    }

    const startIndex = Math.max(0, anchorIndex - before)
    const endIndex = Math.min(visibleChapters.length - 1, anchorIndex + after)
    const windowChapters = visibleChapters.slice(startIndex, endIndex + 1)

    const presets = await db.variantPreset.findMany({
      orderBy: { position: 'asc' },
    })
    const presetMap = Object.fromEntries(presets.map((preset) => [preset.slug, preset]))
    const bibliographyItems = await db.bibliographyItem.findMany({
      where: { bookId },
      orderBy: { number: 'asc' },
    })
    const bibliographyItemsByNumber = buildBibliographyItemsByNumber(bibliographyItems)

    const sections = await Promise.all(
      windowChapters.map(async (chapter, localIndex) => {
        const selectedVariant = chapter.variants.find((variant) => variant.variantType === variantType)
          || chapter.variants.find((variant) => variant.variantType === 'original')

        if (!selectedVariant) {
          return null
        }

        const variantWithParagraphs = await db.chapterVariant.findUnique({
          where: { id: selectedVariant.id },
          include: {
            headRevision: {
              select: {
                id: true,
                revisionNumber: true,
              },
            },
            paragraphs: {
              orderBy: { position: 'asc' },
            },
          },
        })

        if (!variantWithParagraphs) {
          return null
        }

        const ensuredParagraphs = await ensureVariantParagraphs(
          db,
          variantWithParagraphs.id,
          variantWithParagraphs.contentHtml,
        )
        const parsedParagraphs = buildParagraphInputsFromHtml(variantWithParagraphs.contentHtml)

        const [annotations, commentCount, reactionsCount, quotesCount, quoteRows] = await Promise.all([
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
            take: Math.max(previewLimit * 3, previewLimit),
          }),
          db.annotation.count({
            where: {
              chapterId: chapter.id,
              kind: 'comment',
              status: 'active',
            },
          }),
          db.annotation.count({
            where: {
              chapterId: chapter.id,
              kind: 'reaction',
              status: 'active',
            },
          }),
          db.annotation.count({
            where: {
              chapterId: chapter.id,
              kind: 'quote',
              status: 'active',
            },
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
          annotations.map((annotation) => mapAnnotationComment(annotation, readerId)),
        ).slice(0, previewLimit)

        const sortedQuotes = sortQuotesByTop(
          quoteRows
            .map((quote) => mapAnnotationQuote(quote, readerId))
            .filter((quote): quote is NonNullable<typeof quote> => Boolean(quote)),
        )
        const topQuote = sortedQuotes[0] || null
        const quotesPreviewSource = sortedQuotes.slice(0, 2)

        const quoteCommentEntries = await Promise.all(
          quotesPreviewSource.map(async (quote): Promise<[string, number]> => [
            quote.id,
            await db.annotation.count({
              where: {
                chapterId: chapter.id,
                kind: 'comment',
                status: 'active',
                paragraphId: quote.paragraphId,
                endParagraphId: quote.paragraphEndId,
                startOffset: quote.startOffset,
                endOffset: quote.endOffset,
              },
            }),
          ]),
        )
        const quoteCommentCounts = new Map<string, number>(quoteCommentEntries)
        const leadComment = commentsPreview[0] || null
        const freshComments = annotations
          .map((annotation) => mapAnnotationComment(annotation, readerId))
          .filter((comment) => comment.id !== leadComment?.id)
          .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
          .slice(0, 3)

        return {
          chapter: {
            id: chapter.id,
            title: chapter.title,
            level: chapter.level,
            position: chapter.position,
            isReadable: chapter.hasReadableContent,
            variants: chapter.variants.map((variant) => ({
              id: variant.id,
              variantType: variant.variantType,
            })),
          },
          variant: {
            id: variantWithParagraphs.id,
            variantType: variantWithParagraphs.variantType,
            revisionId: variantWithParagraphs.headRevision?.id || null,
            revisionNumber: variantWithParagraphs.headRevision?.revisionNumber || null,
            paragraphs: ensuredParagraphs.map((paragraph, paragraphIndex) => ({
              ...paragraph,
              html: parsedParagraphs[paragraphIndex]?.html ?? paragraph.text,
              textAlign: parsedParagraphs[paragraphIndex]?.textAlign ?? null,
              indentPx: parsedParagraphs[paragraphIndex]?.indentPx ?? 0,
            })),
          },
          bibliographyItemsByNumber,
          preview: {
            leadComment,
            freshComments,
            quotesPreview: quotesPreviewSource.map((quote) => ({
              id: quote.id,
              text: quote.text,
              upvoteCount: quote.upvoteCount,
              reacted: quote.reacted,
              reactionsCount: quote.upvoteCount,
              commentsCount: quoteCommentCounts.get(quote.id) ?? 0,
              readerId: quote.readerId,
              username: quote.username,
              createdAt: quote.createdAt,
              chapterId: quote.chapterId,
              variantType: quote.variantType,
              paragraphId: quote.paragraphId,
              paragraphEndId: quote.paragraphEndId,
              startOffset: quote.startOffset,
              endOffset: quote.endOffset,
            })),
            stats: {
              commentsCount: commentCount,
              reactionsCount,
              quotesCount,
              bookmarksCount: null,
              topQuote: topQuote
                ? {
                    id: topQuote.id,
                    text: topQuote.text,
                    upvoteCount: topQuote.upvoteCount,
                    reacted: topQuote.reacted,
                    reactionsCount: topQuote.upvoteCount,
                    commentsCount: quoteCommentCounts.get(topQuote.id) ?? 0,
                    readerId: topQuote.readerId,
                    username: topQuote.username,
                    createdAt: topQuote.createdAt,
                    chapterId: topQuote.chapterId,
                    variantType: topQuote.variantType,
                    paragraphId: topQuote.paragraphId,
                    paragraphEndId: topQuote.paragraphEndId,
                    startOffset: topQuote.startOffset,
                    endOffset: topQuote.endOffset,
                  }
                : null,
            },
          },
          commentsPreview,
          commentCount,
          prevChapterId: windowChapters[localIndex - 1]?.id || book.chapters[startIndex + localIndex - 1]?.id || null,
          nextChapterId: windowChapters[localIndex + 1]?.id || book.chapters[startIndex + localIndex + 1]?.id || null,
        }
      }),
    )

    return NextResponse.json({
      sections: sections.filter(Boolean),
      variantPresets: presetMap,
      anchorChapterId,
      hasPrev: startIndex > 0,
      hasNext: endIndex < visibleChapters.length - 1,
      prevChapterId: visibleChapters[startIndex - 1]?.id || null,
      nextChapterId: visibleChapters[endIndex + 1]?.id || null,
    })
  } catch (error) {
    console.error('Error fetching feed sections:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
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
