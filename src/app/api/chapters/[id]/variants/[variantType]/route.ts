import { NextRequest, NextResponse } from 'next/server'
import { getOwnedChapter } from '@/lib/admin-ownership'
import { getAdminSessionReader } from '@/lib/admin-auth'
import { saveChapterVariantRevision } from '@/lib/chapter-revisions'
import { db } from '@/lib/db'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; variantType: string }> }
) {
  try {
    const adminReader = await getAdminSessionReader(request)
    const { id, variantType } = await params
    const includeDrafts = new URL(request.url).searchParams.get('includeDrafts') === '1'
    if (includeDrafts && !adminReader) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const chapter = await db.chapter.findUnique({
      where: { id },
      select: {
        book: {
          select: {
            isPublic: true,
            author: {
              select: {
                ownerReaderId: true,
              },
            },
          },
        },
      },
    })
    if (!chapter) {
      return NextResponse.json({ error: 'Вариант не найден' }, { status: 404 })
    }
    if (!chapter.book.isPublic && chapter.book.author.ownerReaderId !== adminReader?.id) {
      return NextResponse.json({ error: 'Вариант не найден' }, { status: 404 })
    }

    const variant = await db.chapterVariant.findUnique({
      where: {
        chapterId_variantType: { chapterId: id, variantType },
      },
    })
    if (!variant) {
      return NextResponse.json({ error: 'Вариант не найден' }, { status: 404 })
    }
    if (includeDrafts) {
      const ownedChapter = await getOwnedChapter(adminReader!.id, id)
      if (!ownedChapter) {
        return NextResponse.json({ error: 'Вариант не найден' }, { status: 404 })
      }
    }
    return NextResponse.json(variant)
  } catch (error) {
    console.error('Error fetching variant:', error)
    return NextResponse.json({ error: 'Ошибка загрузки варианта' }, { status: 500 })
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; variantType: string }> }
) {
  try {
    const adminReader = await getAdminSessionReader(request)
    if (!adminReader) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id, variantType } = await params
    const ownedChapter = await getOwnedChapter(adminReader.id, id)
    if (!ownedChapter) {
      return NextResponse.json({ error: 'Глава не найдена' }, { status: 404 })
    }

    const { contentHtml } = await request.json()
    const saved = await db.$transaction((tx) => saveChapterVariantRevision(tx, {
      chapterId: ownedChapter.id,
      variantType,
      contentHtml,
      editedByAuthor: true,
      source: 'manual',
    }))

    return NextResponse.json({
      ...saved.variant,
      headRevisionId: saved.headRevision.id,
      revisionNumber: saved.headRevision.revisionNumber,
    })
  } catch (error) {
    console.error('Error updating variant:', error)
    return NextResponse.json({ error: 'Ошибка сохранения варианта' }, { status: 500 })
  }
}
