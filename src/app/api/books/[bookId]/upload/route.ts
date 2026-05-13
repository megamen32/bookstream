import { NextRequest, NextResponse } from 'next/server'
import { getOwnedBook } from '@/lib/admin-ownership'
import { getAdminSessionReader } from '@/lib/admin-auth'
import { db } from '@/lib/db'
import { saveChapterVariantRevision } from '@/lib/chapter-revisions'
import {
  persistImportedBookCover,
  persistImportedBookImage,
  readImportedBookFile,
} from '@/lib/book-import'
import { transformBibliographicAnnotations } from '@/lib/books/annotations'
import {
  flattenImportedSections,
  splitImportedHtmlIntoSections,
} from '@/lib/imported-book-html'
import mammoth from 'mammoth'

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

    const importedContent = await readImportedBookFile(file, {
      convertImage: mammoth.images.imgElement(async (image) => ({
        src: await persistImportedBookImage({
          bookId: book.id,
          image,
        }),
      })),
    })
    const chapterParts = flattenImportedSections(
      splitImportedHtmlIntoSections(importedContent.html, book.title),
    )
    const detectedCoverDataUrl =
      typeof suggestedCoverDataUrl === 'string'
        ? suggestedCoverDataUrl
        : importedContent.coverDataUrl
    let bibliographyDetected = false
    let bibliographyDetectionMethod: 'heading' | 'tail-heuristic' | 'none' = 'none'
    let bibliographyItemsCount = 0
    let annotationMarkersCount = 0
    let unresolvedMarkersCount = 0

    for (let index = 0; index < chapterParts.length; index += 1) {
      const chapterTitle = chapterParts[index].title || `Глава ${index + 1}`
      const bibliographicTransform = transformBibliographicAnnotations(chapterParts[index].contentHtml)
      bibliographyDetected = bibliographyDetected || bibliographicTransform.diagnostics.bibliographyDetected
      if (bibliographicTransform.diagnostics.detectionMethod === 'heading') {
        bibliographyDetectionMethod = 'heading'
      } else if (
        bibliographyDetectionMethod === 'none'
        && bibliographicTransform.diagnostics.detectionMethod === 'tail-heuristic'
      ) {
        bibliographyDetectionMethod = 'tail-heuristic'
      }
      bibliographyItemsCount += bibliographicTransform.diagnostics.bibliographyItemsCount
      annotationMarkersCount += bibliographicTransform.diagnostics.annotationMarkersCount
      unresolvedMarkersCount += bibliographicTransform.diagnostics.unresolvedMarkersCount

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
        contentHtml: bibliographicTransform.html,
        editedByAuthor: true,
        source: 'import',
      }))

      if (bibliographicTransform.items.length > 0) {
        for (const item of bibliographicTransform.items) {
          await db.bibliographyItem.upsert({
            where: {
              bookId_number: {
                bookId: book.id,
                number: item.number,
              },
            },
            create: {
              bookId: book.id,
              chapterId: chapter.id,
              number: item.number,
              rawText: item.rawText,
              normalizedText: item.normalizedText,
            },
            update: {
              chapterId: chapter.id,
              rawText: item.rawText,
              normalizedText: item.normalizedText,
            },
          })
        }
      }
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
      bibliographyDetected,
      detectionMethod: bibliographyDetectionMethod,
      bibliographyItemsCount,
      annotationMarkersCount,
      unresolvedMarkersCount,
    })
  } catch (error) {
    console.error('Error uploading file:', error)
    return NextResponse.json({ error: 'Ошибка загрузки файла' }, { status: 500 })
  }
}
