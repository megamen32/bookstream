import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { listVariantRevisionHistory } from '@/lib/chapter-revisions'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; variantType: string }> },
) {
  try {
    const { id, variantType } = await params
    const revisions = await db.$transaction((tx) => listVariantRevisionHistory(tx, {
      chapterId: id,
      variantType,
    }))

    return NextResponse.json({
      revisions,
    })
  } catch (error) {
    console.error('Error loading variant history:', error)
    return NextResponse.json({ error: 'Ошибка загрузки истории варианта' }, { status: 500 })
  }
}
