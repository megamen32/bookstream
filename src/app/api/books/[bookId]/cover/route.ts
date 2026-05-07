import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { persistImportedBookCover } from '@/lib/book-import'

const COVER_ACCEPTED_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.webp', '.avif'] as const
const COVER_ACCEPTED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/avif'] as const

/**
 * Returns a normalized file extension including the leading dot.
 *
 * @param fileName Original uploaded filename.
 * @returns Lowercased extension or an empty string when the file has none.
 */
function getFileExtension(fileName: string): string {
  const extension = fileName.split('.').pop()?.toLowerCase()
  return extension ? `.${extension}` : ''
}

/**
 * Checks whether the uploaded file can be treated as a book cover image.
 *
 * @param file Uploaded file from multipart form data.
 * @returns `true` when the MIME type or extension matches allowed image formats.
 */
function isAcceptedCoverFile(file: File): boolean {
  if (COVER_ACCEPTED_MIME_TYPES.includes(file.type as typeof COVER_ACCEPTED_MIME_TYPES[number])) {
    return true
  }

  return COVER_ACCEPTED_EXTENSIONS.includes(
    getFileExtension(file.name) as typeof COVER_ACCEPTED_EXTENSIONS[number]
  )
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ bookId: string }> }
) {
  try {
    const { bookId } = await params
    const formData = await request.formData()
    const cover = formData.get('cover')

    if (!(cover instanceof File)) {
      return NextResponse.json({ error: 'Файл обложки не передан' }, { status: 400 })
    }

    if (!isAcceptedCoverFile(cover)) {
      return NextResponse.json(
        { error: 'Поддерживаются только изображения JPG, PNG, WEBP и AVIF' },
        { status: 400 }
      )
    }

    const book = await db.book.findUnique({
      where: { id: bookId },
      select: { id: true, slug: true },
    })

    if (!book) {
      return NextResponse.json({ error: 'Книга не найдена' }, { status: 404 })
    }

    const coverUrl = await persistImportedBookCover({
      bookId: book.id,
      bookSlug: book.slug,
      coverFile: cover,
      suggestedCoverDataUrl: null,
    })

    if (!coverUrl) {
      return NextResponse.json({ error: 'Не удалось обработать обложку' }, { status: 500 })
    }

    const updatedBook = await db.book.update({
      where: { id: bookId },
      data: { coverUrl },
      select: { id: true, coverUrl: true },
    })

    return NextResponse.json(updatedBook)
  } catch (error) {
    console.error('Error updating book cover:', error)
    return NextResponse.json({ error: 'Ошибка обновления обложки' }, { status: 500 })
  }
}
