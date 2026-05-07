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

    // Fetch variant presets for UI labels
    const variantTypes = chapter.variants.map(v => v.variantType)
    const presets = await db.variantPreset.findMany({
      where: { slug: { in: variantTypes } },
    })
    const presetMap = Object.fromEntries(presets.map(p => [p.slug, p]))

    return NextResponse.json({
      chapter,
      variant: {
        id: variantWithParagraphs!.id,
        variantType: variantWithParagraphs!.variantType,
        contentHtml: variantWithParagraphs!.contentHtml,
        paragraphs: variantWithParagraphs!.paragraphs,
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
