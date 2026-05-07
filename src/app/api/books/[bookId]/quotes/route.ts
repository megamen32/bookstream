import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

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
    const readerId = searchParams.get('readerId') ?? ''

    const [annotations, legacyQuotes, presets] = await Promise.all([
      db.annotation.findMany({
        where: {
          bookId,
          kind: 'quote',
          status: 'active',
          selectedText: {
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
      db.commentQuote.findMany({
        where: {
          comment: {
            bookId,
            status: 'active',
          },
        },
        select: {
          id: true,
          selectedText: true,
          variantType: true,
          paragraphId: true,
          endParagraphId: true,
          createdAt: true,
          comment: {
            select: {
              username: true,
              readerId: true,
              chapter: {
                select: {
                  id: true,
                  title: true,
                  position: true,
                },
              },
            },
          },
          upvotes: {
            select: {
              readerId: true,
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

    const presetLabels = Object.fromEntries(
      presets.map((preset) => [preset.slug, preset.label]),
    ) as Record<string, string>

    const annotationQuotes: QuotePayload[] = annotations
      .filter((quote) => (quote.selectedText || '').trim().length > 0)
      .map((quote) => ({
        id: quote.id,
        text: quote.selectedText || '',
        variantType: quote.variantType,
        variantLabel: formatVariantLabel(quote.variantType, presetLabels),
        chapterId: quote.chapter.id,
        paragraphId: quote.paragraphId || '',
        paragraphEndId: quote.endParagraphId,
        chapterTitle: quote.chapter.title,
        chapterPosition: quote.chapter.position,
        username: quote.username,
        createdAt: quote.createdAt.toISOString(),
        upvoteCount: quote.votes.length,
        reacted: readerId
          ? quote.votes.some((upvote) => upvote.readerId === readerId)
          : false,
      }))

    const legacyQuotePayload: QuotePayload[] = legacyQuotes
      .filter((quote) => quote.selectedText.trim().length > 0)
      .map((quote) => ({
        id: quote.id,
        text: quote.selectedText,
        variantType: quote.variantType,
        variantLabel: formatVariantLabel(quote.variantType, presetLabels),
        chapterId: quote.comment.chapter.id,
        paragraphId: quote.paragraphId,
        paragraphEndId: quote.endParagraphId,
        chapterTitle: quote.comment.chapter.title,
        chapterPosition: quote.comment.chapter.position,
        username: quote.comment.username,
        createdAt: quote.createdAt.toISOString(),
        upvoteCount: quote.upvotes.length,
        reacted: readerId
          ? quote.upvotes.some((upvote) => upvote.readerId === readerId)
          : false,
      }))

    const payload: QuotePayload[] = [...annotationQuotes, ...legacyQuotePayload]
      .sort((a, b) => {
        if (b.upvoteCount !== a.upvoteCount) return b.upvoteCount - a.upvoteCount
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      })

    return NextResponse.json({ quotes: payload })
  } catch (error) {
    console.error('Error fetching book quotes:', error)
    return NextResponse.json({ error: 'Failed to fetch book quotes' }, { status: 500 })
  }
}
