import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { mapAnnotationQuote, sortQuotesByTop } from '@/lib/annotations'
import { limitSyntheticItems } from '@/lib/synthetic-visibility'

interface RouteParams {
  bookId: string
}

interface QuotePayload {
  id: string
  text: string
  variantType: string
  variantLabel: string
  chapterId: string
  paragraphId: string
  paragraphEndId: string | null
  chapterTitle: string
  chapterPosition: number
  username: string
  createdAt: string
  upvoteCount: number
  reacted: boolean
}

function formatVariantLabel(
  variantType: string,
  presetLabels: Record<string, string>,
): string {
  if (presetLabels[variantType]) return presetLabels[variantType]
  if (variantType === 'original') return 'Оригинал'
  return variantType.charAt(0).toUpperCase() + variantType.slice(1)
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<RouteParams> },
) {
  try {
    const { bookId } = await params
    const { searchParams } = new URL(request.url)
    const readerId = searchParams.get('readerId')

    const [book, annotations, presets] = await Promise.all([
      db.book.findUnique({
        where: { id: bookId },
        select: {
          syntheticQuotesPerChapter: true,
        },
      }),
      db.annotation.findMany({
        where: {
          bookId,
          kind: 'quote',
          status: 'active',
          selectedText: {
            not: null,
          },
          paragraphId: {
            not: null,
          },
        },
        select: {
          id: true,
          selectedText: true,
          variantType: true,
          paragraphId: true,
          endParagraphId: true,
          createdAt: true,
          readerId: true,
          username: true,
          isSynthetic: true,
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
      }),
      db.variantPreset.findMany({
        select: {
          slug: true,
          label: true,
        },
      }),
    ])

    if (!book) {
      return NextResponse.json({ error: 'Книга не найдена' }, { status: 404 })
    }

    const annotationsByChapter = new Map<string, typeof annotations>()
    for (const annotation of annotations) {
      const chapterAnnotations = annotationsByChapter.get(annotation.chapter.id) ?? []
      chapterAnnotations.push(annotation)
      annotationsByChapter.set(annotation.chapter.id, chapterAnnotations)
    }

    const visibleAnnotations = Array.from(annotationsByChapter.values()).flatMap((chapterAnnotations) => (
      limitSyntheticItems(chapterAnnotations, book.syntheticQuotesPerChapter)
    ))

    const presetLabels = Object.fromEntries(
      presets.map((preset) => [preset.slug, preset.label]),
    ) as Record<string, string>

    const payload = sortQuotesByTop(
      visibleAnnotations
        .map((quote) => mapAnnotationQuote(quote, readerId))
        .filter((quote): quote is NonNullable<typeof quote> => Boolean(quote))
        .map((quote): QuotePayload => ({
          ...quote,
          variantLabel: formatVariantLabel(quote.variantType, presetLabels),
        })),
    )

    return NextResponse.json({ quotes: payload })
  } catch (error) {
    console.error('Error fetching book quotes:', error)
    return NextResponse.json({ error: 'Failed to fetch book quotes' }, { status: 500 })
  }
}
