import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { buildAnnotationAnchorFromSelection, resolveAnnotationVariantContext } from '@/lib/chapter-revisions'

/**
 * Deprecated compatibility route.
 * New readers should use /api/annotations directly.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { paragraphId, chapterVariantId, readerId, emoji } = body
    const username = typeof body.username === 'string' ? body.username.trim() : ''
    const variantType = typeof body.variantType === 'string' && body.variantType.length > 0 ? body.variantType : 'original'

    if (!paragraphId || !chapterVariantId || !readerId || !emoji || !username) {
      return NextResponse.json(
        { error: 'paragraphId, chapterVariantId, readerId, emoji, and username are required' },
        { status: 400 },
      )
    }

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

    if (!chapterVariant) {
      return NextResponse.json({ error: 'chapterVariant not found' }, { status: 404 })
    }

    const variantContext = await resolveAnnotationVariantContext(db, {
      chapterVariantId,
      chapterId: chapterVariant.chapter.id,
      variantType: chapterVariant.variantType || variantType,
    })

    if (!variantContext) {
      return NextResponse.json({ error: 'chapterVariant not found' }, { status: 404 })
    }

    const selection = buildAnnotationAnchorFromSelection(variantContext, {
      paragraphId,
      endParagraphId: body.selection?.endParagraphId ?? paragraphId,
      startOffset: body.selection?.startOffset ?? 0,
      endOffset: body.selection?.endOffset ?? 0,
      selectedText: body.selection?.selectedText ?? '',
    })

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
      },
    })

    if (existing) {
      await db.annotation.delete({ where: { id: existing.id } })
      return NextResponse.json({ action: 'removed' })
    }

    await db.annotation.create({
      data: {
        bookId: chapterVariant.chapter.bookId,
        chapterId: chapterVariant.chapter.id,
        chapterVariantId,
        variantType: chapterVariant.variantType || variantType,
        readerId,
        username,
        kind: 'reaction',
        status: 'active',
        emoji,
        selectedText: selection.selectedText || null,
        paragraphId,
        endParagraphId: selection.endParagraphId,
        sourceRevisionId: selection.sourceRevisionId,
        resolvedRevisionId: selection.resolvedRevisionId,
        startStableKey: selection.startStableKey,
        endStableKey: selection.endStableKey,
        anchorPrefix: selection.anchorPrefix,
        anchorSuffix: selection.anchorSuffix,
        anchorStatus: selection.anchorStatus,
        anchorScore: selection.anchorScore,
        startOffset: selection.startOffset,
        endOffset: selection.endOffset,
      },
    })

    return NextResponse.json({ action: 'added' }, { status: 201 })
  } catch (error) {
    console.error('Error toggling reaction:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
