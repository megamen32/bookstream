import { NextRequest, NextResponse } from 'next/server'
import { buildParagraphInputsFromHtml, ensureVariantParagraphs } from '@/lib/chapter-variants'
import { getOwnedChapter } from '@/lib/admin-ownership'
import { getAdminSessionReader } from '@/lib/admin-auth'
import { db } from '@/lib/db'

async function canViewDrafts(request: NextRequest): Promise<boolean> {
  const { searchParams } = new URL(request.url)
  if (searchParams.get('includeDrafts') !== '1') {
    return false
  }

  return Boolean(await getAdminSessionReader(request))
}

function hasReadableChapterContent(contentHtml: string): boolean {
  const text = contentHtml.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
  return text.length > 0 || /<(img|table|blockquote|hr|ul|ol|pre)\b/i.test(contentHtml)
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const adminReader = await getAdminSessionReader(request)
    const { id } = await params
    const { searchParams } = new URL(request.url)
    const variantType = searchParams.get('variantType') || 'original'
    const includeDrafts = await canViewDrafts(request)

    const chapter = await db.chapter.findUnique({
      where: { id },
      include: {
        book: {
          select: {
            id: true,
            isPublic: true,
            slug: true,
            title: true,
            author: {
              select: {
                slug: true,
                name: true,
                ownerReaderId: true,
              },
            },
            chapters: {
              orderBy: { position: 'asc' },
              select: {
                id: true,
                title: true,
                level: true,
                position: true,
                variants: {
                  where: { variantType: 'original' },
                  select: { contentHtml: true },
                  take: 1,
                },
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

    if (!includeDrafts && !chapter.book.isPublic) {
      return NextResponse.json({ error: 'Chapter not found' }, { status: 404 })
    }
    if (includeDrafts && chapter.book.author.ownerReaderId !== adminReader?.id) {
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
        headRevision: {
          select: {
            id: true,
            revisionNumber: true,
          },
        },
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

    const parsedParagraphs = buildParagraphInputsFromHtml(variantWithParagraphs.contentHtml)
    const enrichedParagraphs = paragraphs.map((paragraph, index) => ({
      ...paragraph,
      html: parsedParagraphs[index]?.html ?? paragraph.text,
      textAlign: parsedParagraphs[index]?.textAlign ?? null,
      indentPx: parsedParagraphs[index]?.indentPx ?? 0,
    }))
    const visibleChapters = chapter.book.chapters
      .map(({ variants: chapterVariants, ...bookChapter }) => ({
        ...bookChapter,
        hasReadableContent: hasReadableChapterContent(chapterVariants[0]?.contentHtml ?? ''),
      }))
      .filter((bookChapter) => bookChapter.hasReadableContent)

    return NextResponse.json({
      chapter: {
        ...chapter,
        book: {
          ...chapter.book,
          chapters: visibleChapters,
        },
      },
      variant: {
        id: variantWithParagraphs.id,
        variantType: variantWithParagraphs.variantType,
        revisionId: variantWithParagraphs.headRevision?.id || null,
        revisionNumber: variantWithParagraphs.headRevision?.revisionNumber || null,
        contentHtml: variantWithParagraphs.contentHtml,
        paragraphs: enrichedParagraphs,
      },
      variantPresets: presetMap,
      prevChapter: [...visibleChapters].reverse().find((bookChapter) => bookChapter.position < chapter.position) || null,
      nextChapter: visibleChapters.find((bookChapter) => bookChapter.position > chapter.position) || null,
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
    const adminReader = await getAdminSessionReader(request)
    if (!adminReader) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params
    const ownedChapter = await getOwnedChapter(adminReader.id, id)
    if (!ownedChapter) {
      return NextResponse.json({ error: 'Глава не найдена' }, { status: 404 })
    }

    const body = await request.json()
    const { title } = body as { title?: string }

    if (!title || !title.trim()) {
      return NextResponse.json({ error: 'title is required' }, { status: 400 })
    }

    const chapter = await db.chapter.update({
      where: { id: ownedChapter.id },
      data: { title: title.trim() },
    })

    return NextResponse.json(chapter)
  } catch (error) {
    console.error('Error updating chapter:', error)
    return NextResponse.json({ error: 'Ошибка обновления главы' }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const adminReader = await getAdminSessionReader(request)
    if (!adminReader) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params
    const ownedChapter = await getOwnedChapter(adminReader.id, id)
    if (!ownedChapter) {
      return NextResponse.json({ error: 'Chapter not found' }, { status: 404 })
    }

    const chapter = await db.chapter.findUnique({
      where: { id: ownedChapter.id },
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
      await tx.annotation.deleteMany({
        where: { chapterId: ownedChapter.id },
      })

      await tx.readingProgress.deleteMany({
        where: {
          bookId: chapter.bookId,
          chapterId: ownedChapter.id,
        },
      })

      await tx.chapterReaderStat.deleteMany({
        where: {
          chapterId: ownedChapter.id,
        },
      })

      await tx.bookReaderStat.updateMany({
        where: {
          bookId: chapter.bookId,
          lastChapterId: ownedChapter.id,
        },
        data: {
          lastChapterId: null,
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
        where: { id: ownedChapter.id },
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
