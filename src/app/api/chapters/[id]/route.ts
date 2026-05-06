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
        variants: {
          where: { variantType },
          include: {
            paragraphs: {
              orderBy: { position: 'asc' },
            },
          },
        },
      },
    })

    if (!chapter) {
      return NextResponse.json({ error: 'Chapter not found' }, { status: 404 })
    }

    const variant = chapter.variants[0]

    if (!variant) {
      return NextResponse.json({ error: 'Variant not found' }, { status: 404 })
    }

    return NextResponse.json({
      chapter,
      variant: {
        id: variant.id,
        variantType: variant.variantType,
        contentHtml: variant.contentHtml,
        paragraphs: variant.paragraphs,
      },
      prevChapter: chapter.book.chapters.find(c => c.position === chapter.position - 1) || null,
      nextChapter: chapter.book.chapters.find(c => c.position === chapter.position + 1) || null,
    })
  } catch (error) {
    console.error('Error fetching chapter:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
