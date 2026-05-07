import { NextRequest, NextResponse } from 'next/server'
import { buildParagraphInputsFromHtml, ensureVariantParagraphs } from '@/lib/chapter-variants'
import { db } from '@/lib/db'

interface RouteParams {
  bookId: string
}

function canViewDrafts(request: NextRequest): boolean {
  const { searchParams } = new URL(request.url)
  if (searchParams.get('includeDrafts') === '1') {
    return true
  }

  const referer = request.headers.get('referer')
  if (!referer) {
    return false
  }

  try {
    return new URL(referer).pathname.startsWith('/admin')
  } catch {
    return false
  }
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
    const before = normalizeWindowParam(searchParams.get('before'), 1)
    const after = normalizeWindowParam(searchParams.get('after'), 1)
    const previewLimit = normalizeWindowParam(searchParams.get('previewLimit'), 3) || 3
    const includeDrafts = canViewDrafts(request)

    if (!anchorChapterId) {
      return NextResponse.json({ error: 'anchorChapterId is required' }, { status: 400 })
    }

    const book = await db.book.findFirst({
      where: {
        id: bookId,
        ...(includeDrafts ? {} : { isPublic: true }),
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

    const anchorIndex = book.chapters.findIndex((chapter) => chapter.id === anchorChapterId)
    if (anchorIndex < 0) {
      return NextResponse.json({ error: 'Chapter not found' }, { status: 404 })
    }

    const startIndex = Math.max(0, anchorIndex - before)
    const endIndex = Math.min(book.chapters.length - 1, anchorIndex + after)
    const windowChapters = book.chapters.slice(startIndex, endIndex + 1)

    const presets = await db.variantPreset.findMany({
      orderBy: { position: 'asc' },
    })
    const presetMap = Object.fromEntries(presets.map((preset) => [preset.slug, preset]))

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

        const [annotations, legacyComments] = await Promise.all([
          db.annotation.findMany({
            where: {
              chapterId: chapter.id,
              kind: 'comment',
              status: 'active',
            },
            orderBy: { createdAt: 'desc' },
            take: previewLimit,
          }),
          db.comment.findMany({
            where: {
              chapterId: chapter.id,
              status: 'active',
            },
            include: {
              quotes: true,
            },
            orderBy: { createdAt: 'desc' },
            take: previewLimit,
          }),
        ])

        const commentsPreview = [
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
        ]
          .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
          .slice(0, previewLimit)

        const [annotationCount, legacyCommentCount] = await Promise.all([
          db.annotation.count({
            where: {
              chapterId: chapter.id,
              kind: 'comment',
              status: 'active',
            },
          }),
          db.comment.count({
            where: {
              chapterId: chapter.id,
              status: 'active',
            },
          }),
        ])

        return {
          chapter: {
            id: chapter.id,
            title: chapter.title,
            level: chapter.level,
            position: chapter.position,
            variants: chapter.variants.map((variant) => ({
              id: variant.id,
              variantType: variant.variantType,
            })),
          },
          variant: {
            id: variantWithParagraphs.id,
            variantType: variantWithParagraphs.variantType,
            paragraphs: ensuredParagraphs.map((paragraph, paragraphIndex) => ({
              ...paragraph,
              html: parsedParagraphs[paragraphIndex]?.html ?? paragraph.text,
              textAlign: parsedParagraphs[paragraphIndex]?.textAlign ?? null,
              indentPx: parsedParagraphs[paragraphIndex]?.indentPx ?? 0,
            })),
          },
          commentsPreview,
          commentCount: annotationCount + legacyCommentCount,
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
      hasNext: endIndex < book.chapters.length - 1,
      prevChapterId: book.chapters[startIndex - 1]?.id || null,
      nextChapterId: book.chapters[endIndex + 1]?.id || null,
    })
  } catch (error) {
    console.error('Error fetching feed sections:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
