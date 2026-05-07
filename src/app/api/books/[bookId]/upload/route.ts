import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { syncVariantParagraphsFromHtml } from '@/lib/chapter-variants'
import {
  persistImportedBookCover,
  readImportedBookFile,
  splitImportedHtmlIntoChaptersWithFallbackTitle,
} from '@/lib/book-import'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ bookId: string }> }
) {
  try {
    const { bookId } = await params
    const formData = await request.formData()
    const file = formData.get('file')
    const cover = formData.get('cover')
    const suggestedCoverDataUrl = formData.get('suggestedCoverDataUrl')

    if (!(file instanceof File)) {
      return NextResponse.json({ error: 'Файл не найден' }, { status: 400 })
    }

    const book = await db.book.findUnique({
      where: { id: bookId },
      select: { id: true, slug: true, title: true },
    })

    if (!book) {
      return NextResponse.json({ error: 'Книга не найдена' }, { status: 404 })
    }

    const importedContent = await readImportedBookFile(file)
    const chapterParts = splitImportedHtmlIntoChaptersWithFallbackTitle(
      importedContent.html,
      book.title
    )
    const detectedCoverDataUrl =
      typeof suggestedCoverDataUrl === 'string'
        ? suggestedCoverDataUrl
        : importedContent.coverDataUrl

    for (let index = 0; index < chapterParts.length; index += 1) {
      const chapterTitle = chapterParts[index].title || `Глава ${index + 1}`
      const chapter = await db.chapter.create({
        data: {
          bookId,
          title: chapterTitle,
          position: index,
        },
      })

      const variant = await db.chapterVariant.create({
        data: {
          chapterId: chapter.id,
          variantType: 'original',
          contentHtml: chapterParts[index].content,
        },
      })

      await syncVariantParagraphsFromHtml(db, variant.id, variant.contentHtml)
    }

    const coverUrl = await persistImportedBookCover({
      bookId: book.id,
      bookSlug: book.slug,
      coverFile: cover instanceof File ? cover : null,
      suggestedCoverDataUrl: detectedCoverDataUrl,
    })

    if (coverUrl) {
      await db.book.update({
        where: { id: book.id },
        data: { coverUrl },
      })
    }

    return NextResponse.json({
      success: true,
      chaptersCreated: chapterParts.length,
      coverAttached: Boolean(coverUrl),
    })
  } catch (error) {
    console.error('Error uploading file:', error)
    return NextResponse.json({ error: 'Ошибка загрузки файла' }, { status: 500 })
  }
}
