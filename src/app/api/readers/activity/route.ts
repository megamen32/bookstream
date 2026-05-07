import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

interface ActivityQuote {
  id: string
  createdAt: string
  chapterId: string
  chapterTitle: string
  chapterPosition: number
  commentId: string
  commentBody: string
  variantType: string
  paragraphId: string
  endParagraphId: string | null
  selectedText: string
}

interface ActivityComment {
  id: string
  createdAt: string
  chapterId: string
  chapterTitle: string
  chapterPosition: number
  body: string
  quoteCount: number
  quoteText: string | null
  quoteParagraphId: string | null
  quoteEndParagraphId: string | null
  quoteVariantType: string | null
}

interface ActivityReaction {
  id: string
  createdAt: string
  chapterId: string
  chapterTitle: string
  chapterPosition: number
  paragraphId: string
  endParagraphId: string | null
  selectedText: string | null
  emoji: string
  variantType: string
}

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

    const [comments, reactions, quotes] = await Promise.all([
      db.comment.findMany({
        where: {
          readerId,
          bookId,
        },
        select: {
          id: true,
          body: true,
          createdAt: true,
          chapter: {
            select: {
              id: true,
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
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        take: 100,
      }),
      db.reaction.findMany({
        where: {
          readerId,
          chapterVariant: {
            chapter: {
              bookId,
            },
          },
        },
        select: {
          id: true,
          createdAt: true,
          emoji: true,
          paragraphId: true,
          endParagraphId: true,
          selectedText: true,
          chapterVariant: {
            select: {
              variantType: true,
              chapter: {
                select: {
                  id: true,
                  title: true,
                  position: true,
                },
              },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        take: 150,
      }),
      db.commentQuote.findMany({
        where: {
          comment: {
            readerId,
            bookId,
          },
        },
        select: {
          id: true,
          createdAt: true,
          paragraphId: true,
          endParagraphId: true,
          selectedText: true,
          variantType: true,
          comment: {
            select: {
              id: true,
              body: true,
              chapter: {
                select: {
                  id: true,
                  title: true,
                  position: true,
                },
              },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        take: 150,
      }),
    ])

    const payloadQuotes: ActivityQuote[] = quotes.map((quote) => ({
      id: quote.id,
      createdAt: quote.createdAt.toISOString(),
      chapterId: quote.comment.chapter.id,
      chapterTitle: quote.comment.chapter.title,
      chapterPosition: quote.comment.chapter.position,
      commentId: quote.comment.id,
      commentBody: quote.comment.body,
      variantType: quote.variantType,
      paragraphId: quote.paragraphId,
      endParagraphId: quote.endParagraphId,
      selectedText: quote.selectedText,
    }))

    const payloadComments: ActivityComment[] = comments.map((comment) => {
      const firstQuote = comment.quotes[0]
      return {
        id: comment.id,
        createdAt: comment.createdAt.toISOString(),
        chapterId: comment.chapter.id,
        chapterTitle: comment.chapter.title,
        chapterPosition: comment.chapter.position,
        body: comment.body,
        quoteCount: comment.quotes.length,
        quoteText: firstQuote?.selectedText ?? null,
        quoteParagraphId: firstQuote?.paragraphId ?? null,
        quoteEndParagraphId: firstQuote?.endParagraphId ?? null,
        quoteVariantType: firstQuote?.variantType ?? null,
      }
    })

    const payloadReactions: ActivityReaction[] = reactions.map((reaction) => ({
      id: reaction.id,
      createdAt: reaction.createdAt.toISOString(),
      chapterId: reaction.chapterVariant.chapter.id,
      chapterTitle: reaction.chapterVariant.chapter.title,
      chapterPosition: reaction.chapterVariant.chapter.position,
      paragraphId: reaction.paragraphId,
      endParagraphId: reaction.endParagraphId,
      selectedText: reaction.selectedText,
      emoji: reaction.emoji,
      variantType: reaction.chapterVariant.variantType,
    }))

    return NextResponse.json({
      quotes: payloadQuotes,
      comments: payloadComments,
      reactions: payloadReactions,
    })
  } catch (error) {
    console.error('Error fetching reader activity:', error)
    return NextResponse.json(
      { error: 'Failed to fetch reader activity' },
      { status: 500 },
    )
  }
}
