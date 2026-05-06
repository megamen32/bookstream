import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const { searchParams } = new URL(request.url)
    const variantType = searchParams.get('variantType') || 'original'

    const variant = await db.chapterVariant.findFirst({
      where: {
        chapterId: id,
        variantType,
      },
      include: {
        paragraphs: {
          orderBy: { position: 'asc' },
        },
      },
    })

    if (!variant) {
      return NextResponse.json({ error: 'Variant not found' }, { status: 404 })
    }

    return NextResponse.json({
      id: variant.id,
      variantType: variant.variantType,
      contentHtml: variant.contentHtml,
      paragraphs: variant.paragraphs,
    })
  } catch (error) {
    console.error('Error fetching variant:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
