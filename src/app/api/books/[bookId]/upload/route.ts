import { NextRequest, NextResponse } from 'next/server'
import { getOwnedBook } from '@/lib/admin-ownership'
import { getAdminSessionReader } from '@/lib/admin-auth'
import { db } from '@/lib/db'
import { saveChapterVariantRevision } from '@/lib/chapter-revisions'
import {
  persistImportedBookCover,
  readImportedBookFile,
  splitImportedHtmlIntoChaptersWithFallbackTitle,
} from '@/lib/book-import'

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

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ bookId: string }> }
) {
  try {
    const adminReader = await getAdminSessionReader(request)
    if (!adminReader) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { bookId } = await params
    const ownedBook = await getOwnedBook(adminReader.id, bookId)
    if (!ownedBook) {
      return NextResponse.json({ error: 'Книга не найдена' }, { status: 404 })
    }

    const formData = await request.formData()
    const file = formData.get('file')
    const cover = formData.get('cover')
    const suggestedCoverDataUrl = formData.get('suggestedCoverDataUrl')

    if (!(file instanceof File)) {
      return NextResponse.json({ error: 'Файл не найден' }, { status: 400 })
    }

    if (cover instanceof File && !isAcceptedCoverFile(cover)) {
      return NextResponse.json(
        { error: 'Поддерживаются только обложки JPG, PNG, WEBP и AVIF' },
        { status: 400 }
      )
    }

    const book = await db.book.findUnique({
      where: { id: ownedBook.id },
      select: {
        id: true,
        slug: true,
        title: true,
        _count: {
          select: {
            chapters: true,
          },
        },
      },
    })

    if (!book) {
      return NextResponse.json({ error: 'Книга не найдена' }, { status: 404 })
    }

    if (book._count.chapters > 0) {
      return NextResponse.json(
        { error: 'Импорт в непустую книгу пока запрещён: сначала создайте новую книгу или очистите текущую.' },
        { status: 409 }
      )
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
          bookId: ownedBook.id,
          title: chapterTitle,
          position: index,
          level: chapterParts[index].level,
        },
      })

      await db.$transaction((tx) => saveChapterVariantRevision(tx, {
        chapterId: chapter.id,
        variantType: 'original',
        contentHtml: chapterParts[index].content,
        editedByAuthor: true,
        source: 'import',
      }))
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
