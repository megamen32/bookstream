import { NextRequest, NextResponse } from 'next/server'
import { ensureVariantParagraphs } from '@/lib/chapter-variants'
import { db } from '@/lib/db'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const { searchParams } = new URL(request.url)
    const variantType = searchParams.get('variantType') || 'original'

    const chapter = await db.chapter.findUnique({
      where: { id },
      include: {
        book: {
          select: {
            id: true,
            slug: true,
            title: true,
            author: {
              select: {
                slug: true,
                name: true,
              },
            },
            chapters: {
              orderBy: { position: 'asc' },
              select: {
                id: true,
                title: true,
                position: true,
              },
            },
          },
        },
        variants: true,
      },
    })

    if (!chapter) {
      return NextResponse.json({ error: 'Chapter not found' }, { status: 404 })
    }

    // Get the requested variant with paragraphs separately
    const variant = chapter.variants.find(v => v.variantType === variantType)

    if (!variant) {
      return NextResponse.json({ error: 'Variant not found' }, { status: 404 })
    }

    // Fetch paragraphs only for the requested variant
    const variantWithParagraphs = await db.chapterVariant.findUnique({
      where: { id: variant.id },
      include: {
        paragraphs: { orderBy: { position: 'asc' } },
      },
    })

    if (!variantWithParagraphs) {
      return NextResponse.json({ error: 'Variant not found' }, { status: 404 })
    }

    const paragraphs = await ensureVariantParagraphs(
      db,
      variantWithParagraphs.id,
      variantWithParagraphs.contentHtml
    )

    // Fetch all variant presets for UI (they define available generation options)
    const presets = await db.variantPreset.findMany({
      orderBy: { position: 'asc' },
    })
    const presetMap = Object.fromEntries(presets.map(p => [p.slug, p]))

    return NextResponse.json({
      chapter,
      variant: {
        id: variantWithParagraphs.id,
        variantType: variantWithParagraphs.variantType,
        contentHtml: variantWithParagraphs.contentHtml,
        paragraphs,
      },
      variantPresets: presetMap,
      prevChapter: chapter.book.chapters.find(c => c.position === chapter.position - 1) || null,
      nextChapter: chapter.book.chapters.find(c => c.position === chapter.position + 1) || null,
    })
  } catch (error) {
    console.error('Error fetching chapter:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()
    const { title } = body as { title?: string }

    if (!title || !title.trim()) {
      return NextResponse.json({ error: 'title is required' }, { status: 400 })
    }

    const chapter = await db.chapter.update({
      where: { id },
      data: { title: title.trim() },
    })

    return NextResponse.json(chapter)
  } catch (error) {
    console.error('Error updating chapter:', error)
    return NextResponse.json({ error: 'Ошибка обновления главы' }, { status: 500 })
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const chapter = await db.chapter.findUnique({
      where: { id },
      select: {
        id: true,
        bookId: true,
        position: true,
        variants: {
          select: { id: true },
        },
      },
    })

    if (!chapter) {
      return NextResponse.json({ error: 'Chapter not found' }, { status: 404 })
    }

    const variantIds = chapter.variants.map((variant) => variant.id)

    await db.$transaction(async (tx) => {
      await tx.comment.deleteMany({
        where: { chapterId: id },
      })

      await tx.readingProgress.deleteMany({
        where: {
          bookId: chapter.bookId,
          chapterId: id,
        },
      })

      if (variantIds.length > 0) {
        await tx.reaction.deleteMany({
          where: {
            chapterVariantId: { in: variantIds },
          },
        })

        await tx.paragraph.deleteMany({
          where: {
            chapterVariantId: { in: variantIds },
          },
        })

        await tx.chapterVariant.deleteMany({
          where: {
            id: { in: variantIds },
          },
        })
      }

      await tx.chapter.delete({
        where: { id },
      })

      // Keep chapter positions dense so reader navigation and ordering remain stable.
      await tx.chapter.updateMany({
        where: {
          bookId: chapter.bookId,
          position: { gt: chapter.position },
        },
        data: {
          position: { decrement: 1 },
        },
      })
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting chapter:', error)
    return NextResponse.json({ error: 'Ошибка удаления главы' }, { status: 500 })
  }
}
