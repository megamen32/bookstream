import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { buildAnnotationSelection } from '@/lib/annotations'

interface GroupedReaction {
  emoji: string
  count: number
  readerIds: string[]
}

function groupReactions(entries: Array<{ emoji: string; readerId: string }>): GroupedReaction[] {
  const grouped = entries.reduce((acc, reaction) => {
    if (!acc[reaction.emoji]) {
      acc[reaction.emoji] = {
        emoji: reaction.emoji,
        count: 0,
        readerIds: [],
      }
    }
    acc[reaction.emoji].count += 1
    acc[reaction.emoji].readerIds.push(reaction.readerId)
    return acc
  }, {} as Record<string, GroupedReaction>)

  return Object.values(grouped)
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const paragraphId = searchParams.get('paragraphId')
    const chapterVariantId = searchParams.get('chapterVariantId')

    if (!paragraphId || !chapterVariantId) {
      return NextResponse.json(
        { error: 'paragraphId and chapterVariantId are required' },
        { status: 400 },
      )
    }

    const [annotationReactions, legacyReactions] = await Promise.all([
      db.annotation.findMany({
        where: {
          kind: 'reaction',
          paragraphId,
          chapterVariantId,
          status: 'active',
        },
        select: {
          emoji: true,
          readerId: true,
        },
        orderBy: { createdAt: 'desc' },
      }),
      db.reaction.findMany({
        where: {
          paragraphId,
          chapterVariantId,
        },
        select: {
          emoji: true,
          readerId: true,
        },
        orderBy: { createdAt: 'desc' },
      }),
    ])

    return NextResponse.json(groupReactions([
      ...annotationReactions.map((reaction) => ({
        emoji: reaction.emoji || '👍',
        readerId: reaction.readerId,
      })),
      ...legacyReactions,
    ]))
  } catch (error) {
    console.error('Error fetching reactions:', error)
    return NextResponse.json(
      { error: 'Failed to fetch reactions' },
      { status: 500 },
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { paragraphId, chapterVariantId, readerId, emoji } = body
    const username = typeof body.username === 'string' ? body.username.trim() : ''
    const bookId = typeof body.bookId === 'string' ? body.bookId : ''
    const chapterId = typeof body.chapterId === 'string' ? body.chapterId : ''
    const variantType = typeof body.variantType === 'string' && body.variantType.length > 0 ? body.variantType : 'original'

    const selection = buildAnnotationSelection({
      paragraphId,
      endParagraphId: body.selection?.endParagraphId ?? paragraphId,
      startOffset: body.selection?.startOffset ?? 0,
      endOffset: body.selection?.endOffset ?? 0,
      selectedText: body.selection?.selectedText ?? '',
    })

    if (!paragraphId || !chapterVariantId || !readerId || !emoji || !username) {
      return NextResponse.json(
        { error: 'paragraphId, chapterVariantId, readerId, emoji, and username are required' },
        { status: 400 },
      )
    }

    let resolvedBookId = bookId
    let resolvedChapterId = chapterId
    let resolvedVariantType = variantType

    if (!resolvedBookId || !resolvedChapterId) {
      const chapterVariant = await db.chapterVariant.findUnique({
        where: { id: chapterVariantId },
        select: {
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
        resolvedBookId = resolvedBookId || chapterVariant.chapter.bookId
        resolvedChapterId = resolvedChapterId || chapterVariant.chapter.id
        resolvedVariantType = chapterVariant.variantType || resolvedVariantType
      }
    }

    if (!resolvedBookId || !resolvedChapterId) {
      return NextResponse.json(
        { error: 'bookId and chapterId are required or must be resolvable from chapterVariantId' },
        { status: 400 },
      )
    }

    const existing = await db.annotation.findFirst({
      where: {
        kind: 'reaction',
        paragraphId,
        chapterVariantId,
        readerId,
        emoji,
        startOffset: selection.startOffset,
        endOffset: selection.endOffset,
        endParagraphId: selection.endParagraphId,
        bookId: resolvedBookId,
        chapterId: resolvedChapterId,
      },
    })

    if (existing) {
      await db.annotation.delete({ where: { id: existing.id } })
      return NextResponse.json({
        action: 'removed',
        emoji,
        paragraphId,
        readerId,
      })
    }

    const reaction = await db.annotation.create({
      data: {
        bookId: resolvedBookId,
        chapterId: resolvedChapterId,
        chapterVariantId,
        variantType: resolvedVariantType,
        readerId,
        username,
        kind: 'reaction',
        status: 'active',
        emoji,
        selectedText: selection.selectedText || null,
        paragraphId,
        endParagraphId: selection.endParagraphId,
        startOffset: selection.startOffset,
        endOffset: selection.endOffset,
      },
    })

    return NextResponse.json(
      {
        action: 'added',
        reaction,
      },
      { status: 201 },
    )
  } catch (error) {
    console.error('Error toggling reaction:', error)
    return NextResponse.json(
      { error: 'Failed to toggle reaction' },
      { status: 500 },
    )
  }
}
