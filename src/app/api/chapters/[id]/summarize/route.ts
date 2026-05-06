import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    // Find the original variant
    const original = await db.chapterVariant.findUnique({
      where: {
        chapterId_variantType: { chapterId: id, variantType: 'original' },
      },
    })

    if (!original) {
      return NextResponse.json({ error: 'Оригинальный текст не найден' }, { status: 404 })
    }

    // Strip HTML to get plain text
    const plainText = original.contentHtml
      .replace(/<[^>]*>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()

    const sentences = plainText
      .split(/(?<=[.!?])\s+/)
      .filter((s) => s.length > 20)

    // Simple summarization: take every other sentence for "clean", every third for "essence"
    const cleanSentences = sentences.filter((_, i) => i % 2 === 0 || i % 5 === 0)
    const essenceSentences = sentences.filter((_, i) => i % 3 === 0)

    const cleanHtml = cleanSentences.map((s) => `<p>${s}</p>`).join('\n')
    const essenceHtml = essenceSentences.map((s) => `<p>${s}</p>`).join('\n')

    // Upsert both variants
    await db.chapterVariant.upsert({
      where: {
        chapterId_variantType: { chapterId: id, variantType: 'clean' },
      },
      update: { contentHtml: cleanHtml },
      create: { chapterId: id, variantType: 'clean', contentHtml: cleanHtml },
    })

    await db.chapterVariant.upsert({
      where: {
        chapterId_variantType: { chapterId: id, variantType: 'essence' },
      },
      update: { contentHtml: essenceHtml },
      create: { chapterId: id, variantType: 'essence', contentHtml: essenceHtml },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error generating summary:', error)
    return NextResponse.json({ error: 'Ошибка генерации' }, { status: 500 })
  }
}
