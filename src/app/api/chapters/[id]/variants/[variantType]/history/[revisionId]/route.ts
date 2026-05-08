import { NextRequest, NextResponse } from 'next/server'
import {
  getVariantRevisionDetails,
  restoreChapterVariantRevision,
} from '@/lib/chapter-revisions'
import { db } from '@/lib/db'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; variantType: string; revisionId: string }> },
) {
  try {
    const { id, variantType, revisionId } = await params
    const revision = await db.$transaction((tx) => getVariantRevisionDetails(tx, {
      chapterId: id,
      variantType,
      revisionId,
    }))

    if (!revision) {
      return NextResponse.json({ error: 'Ревизия не найдена' }, { status: 404 })
    }

    return NextResponse.json({ revision })
  } catch (error) {
    console.error('Error loading revision:', error)
    return NextResponse.json({ error: 'Ошибка загрузки ревизии' }, { status: 500 })
  }
}

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; variantType: string; revisionId: string }> },
) {
  try {
    const { id, variantType, revisionId } = await params
    const restored = await db.$transaction((tx) => restoreChapterVariantRevision(tx, {
      chapterId: id,
      variantType,
      revisionId,
    }))

    return NextResponse.json({
      variant: restored.variant,
      headRevisionId: restored.headRevision.id,
      revisionNumber: restored.headRevision.revisionNumber,
    })
  } catch (error) {
    console.error('Error restoring revision:', error)
    return NextResponse.json({ error: 'Ошибка восстановления ревизии' }, { status: 500 })
  }
}
