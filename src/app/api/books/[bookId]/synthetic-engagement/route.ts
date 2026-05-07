import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { isAdminRequest } from '@/lib/admin-auth'
import {
  buildSyntheticChapterPlan,
  buildSyntheticComments,
  buildSyntheticQuotes,
  buildSyntheticReactions,
  buildLlmSyntheticCommentPayload,
} from '@/lib/synthetic-engagement'

interface RouteParams {
  bookId: string
}

interface PreparedChapterEngagement {
  chapterId: string
  chapterTitle: string
  comments: Array<ReturnType<typeof buildSyntheticComments>[number]>
  quotes: Array<ReturnType<typeof buildSyntheticQuotes>[number]>
  reactions: Array<ReturnType<typeof buildSyntheticReactions>[number]>
}

/**
 * Fills each chapter of a book with synthetic starter engagement up to configured minimums.
 *
 * @param request Incoming admin request.
 * @param params Route params with book id.
 * @returns Per-book generation summary.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<RouteParams> },
) {
  try {
    if (!isAdminRequest(request)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { bookId } = await params
    const book = await db.book.findUnique({
      where: { id: bookId },
      select: {
        id: true,
        title: true,
        syntheticCommentsPerChapter: true,
        syntheticQuotesPerChapter: true,
        syntheticReactionsPerChapter: true,
        syntheticCommentsUseLlm: true,
        chapters: {
          orderBy: { position: 'asc' },
          select: {
            id: true,
            title: true,
            position: true,
            variants: {
              orderBy: { variantType: 'asc' },
              select: {
                id: true,
                variantType: true,
                paragraphs: {
                  orderBy: { position: 'asc' },
                  select: {
                    id: true,
                    text: true,
                    position: true,
                  },
                },
              },
            },
          },
        },
      },
    })

    if (!book) {
      return NextResponse.json({ error: 'Книга не найдена' }, { status: 404 })
    }

    const plan = buildSyntheticChapterPlan(book, book.chapters)
    const chapterIds = book.chapters.map((chapter) => chapter.id)

    const [existingSyntheticAnnotations, existingSyntheticReactions] = await Promise.all([
      db.annotation.groupBy({
        by: ['chapterId', 'kind'],
        where: {
          bookId,
          chapterId: { in: chapterIds },
          status: 'active',
          isSynthetic: true,
        },
        _count: {
          _all: true,
        },
      }),
      db.annotation.findMany({
        where: {
          bookId,
          chapterId: { in: chapterIds },
          status: 'active',
          kind: 'reaction',
          isSynthetic: true,
        },
        select: {
          chapterId: true,
          paragraphId: true,
          emoji: true,
          readerId: true,
        },
      }),
    ])

    const syntheticCountByKey = new Map<string, number>()
    for (const item of existingSyntheticAnnotations) {
      syntheticCountByKey.set(
        `${item.chapterId}:${item.kind}`,
        item._count._all,
      )
    }

    const syntheticReactionKeySet = new Set(
      existingSyntheticReactions.map((reaction) => (
        `${reaction.chapterId}:${reaction.paragraphId ?? ''}:${reaction.emoji ?? ''}:${reaction.readerId}`
      )),
    )

    const preparedChapters: PreparedChapterEngagement[] = []
    for (const chapter of book.chapters) {
      const chapterPlan = plan.find((item) => item.chapterId === chapter.id)
      if (!chapterPlan) {
        continue
      }

      const missingComments = Math.max(
        0,
        chapterPlan.commentCount - (syntheticCountByKey.get(`${chapter.id}:comment`) ?? 0),
      )
      const missingQuotes = Math.max(
        0,
        chapterPlan.quoteCount - (syntheticCountByKey.get(`${chapter.id}:quote`) ?? 0),
      )
      const missingReactions = Math.max(
        0,
        chapterPlan.reactionCount - (syntheticCountByKey.get(`${chapter.id}:reaction`) ?? 0),
      )

      const llmPayload = book.syntheticCommentsUseLlm && (missingComments > 0 || missingReactions > 0)
        ? await buildLlmSyntheticCommentPayload({
            bookTitle: book.title,
            chapter,
            commentCount: missingComments,
            reactionCount: missingReactions,
          })
        : null

      const comments = buildSyntheticComments(book.title, chapter, missingComments).map((comment, index) => ({
        ...comment,
        body: llmPayload?.comments[index] ?? comment.body,
      }))
      const quotes = buildSyntheticQuotes(chapter, missingQuotes)
      const reactions = buildSyntheticReactions(chapter, missingReactions)
        .map((reaction, index) => ({
          ...reaction,
          emoji: llmPayload?.reactions[index] ?? reaction.emoji,
        }))
        .filter((reaction) => {
          const reactionKey = `${chapter.id}:${reaction.paragraphId}:${reaction.emoji}:${reaction.readerId}`
          if (syntheticReactionKeySet.has(reactionKey)) {
            return false
          }

          syntheticReactionKeySet.add(reactionKey)
          return true
        })

      preparedChapters.push({
        chapterId: chapter.id,
        chapterTitle: chapter.title,
        comments,
        quotes,
        reactions,
      })
    }

    const createdTotals = {
      comments: 0,
      quotes: 0,
      reactions: 0,
    }

    const chapterResults: Array<{
      chapterId: string
      chapterTitle: string
      createdComments: number
      createdQuotes: number
      createdReactions: number
    }> = []

    await db.$transaction(async (tx) => {
      for (const chapter of preparedChapters) {
        for (const comment of chapter.comments) {
          await tx.annotation.create({
            data: {
              bookId: book.id,
              chapterId: chapter.chapterId,
              chapterVariantId: comment.chapterVariantId,
              variantType: comment.variantType,
              readerId: comment.readerId,
              username: comment.username,
              kind: 'comment',
              status: 'active',
              isSynthetic: true,
              body: comment.body,
              selectedText: comment.selectedText,
              paragraphId: comment.paragraphId,
              endParagraphId: comment.endParagraphId,
              startOffset: comment.startOffset,
              endOffset: comment.endOffset,
            },
          })
        }

        for (const quote of chapter.quotes) {
          await tx.annotation.create({
            data: {
              bookId: book.id,
              chapterId: chapter.chapterId,
              chapterVariantId: quote.chapterVariantId,
              variantType: quote.variantType,
              readerId: quote.readerId,
              username: quote.username,
              kind: 'quote',
              status: 'active',
              isSynthetic: true,
              body: null,
              selectedText: quote.selectedText,
              paragraphId: quote.paragraphId,
              endParagraphId: quote.endParagraphId,
              startOffset: quote.startOffset,
              endOffset: quote.endOffset,
            },
          })
        }

        for (const reaction of chapter.reactions) {
          await tx.annotation.create({
            data: {
              bookId: book.id,
              chapterId: chapter.chapterId,
              chapterVariantId: reaction.chapterVariantId,
              variantType: reaction.variantType,
              readerId: reaction.readerId,
              username: reaction.username,
              kind: 'reaction',
              status: 'active',
              isSynthetic: true,
              body: null,
              emoji: reaction.emoji,
              selectedText: reaction.selectedText,
              paragraphId: reaction.paragraphId,
              endParagraphId: reaction.endParagraphId,
              startOffset: reaction.startOffset,
              endOffset: reaction.endOffset,
            },
          })
        }

        createdTotals.comments += chapter.comments.length
        createdTotals.quotes += chapter.quotes.length
        createdTotals.reactions += chapter.reactions.length
        chapterResults.push({
          chapterId: chapter.chapterId,
          chapterTitle: chapter.chapterTitle,
          createdComments: chapter.comments.length,
          createdQuotes: chapter.quotes.length,
          createdReactions: chapter.reactions.length,
        })
      }
    })

    return NextResponse.json({
      generated: createdTotals,
      chapters: chapterResults,
      minimums: {
        comments: book.syntheticCommentsPerChapter,
        quotes: book.syntheticQuotesPerChapter,
        reactions: book.syntheticReactionsPerChapter,
      },
      llmCommentsEnabled: book.syntheticCommentsUseLlm,
    })
  } catch (error) {
    console.error('Error generating synthetic engagement:', error)
    return NextResponse.json(
      { error: 'Не удалось сгенерировать синтетическую активность' },
      { status: 500 },
    )
  }
}
