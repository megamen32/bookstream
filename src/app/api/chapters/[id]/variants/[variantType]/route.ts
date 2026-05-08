import { NextRequest, NextResponse } from 'next/server'
import { saveChapterVariantRevision } from '@/lib/chapter-revisions'
import { db } from '@/lib/db'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; variantType: string }> }
) {
  try {
    const { id, variantType } = await params
    const variant = await db.chapterVariant.findUnique({
      where: {
        chapterId_variantType: { chapterId: id, variantType },
      },
    })
    if (!variant) {
      return NextResponse.json({ error: 'Вариант не найден' }, { status: 404 })
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
    const { id, variantType } = await params
    const { contentHtml } = await request.json()
    const saved = await db.$transaction((tx) => saveChapterVariantRevision(tx, {
      chapterId: id,
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
