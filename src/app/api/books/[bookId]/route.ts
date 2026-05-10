import { NextRequest, NextResponse } from 'next/server'
import { getAppSettings } from '@/lib/app-settings'
import { buildOwnedBookWhere, getOwnedBook } from '@/lib/admin-ownership'
import { buildBookUpdateData, BookUpdateValidationError } from '@/lib/book-update'
import { db } from '@/lib/db'
import { getAdminSessionReader } from '@/lib/admin-auth'

function estimateTextLengthFromHtml(contentHtml: string): number {
  return contentHtml
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .length
}

async function getDraftAccessReaderId(request: NextRequest): Promise<string | null> {
  const { searchParams } = new URL(request.url)
  if (searchParams.get('includeDrafts') !== '1') {
    return null
  }

  const adminReader = await getAdminSessionReader(request)
  return adminReader?.id || null
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ bookId: string }> }
) {
  try {
    const { bookId } = await params
    const { searchParams } = new URL(request.url)
    const authorSlug = searchParams.get('authorSlug')
    const draftReaderId = await getDraftAccessReaderId(request)

    let book

    if (authorSlug) {
      // Lookup by authorSlug + book slug
      const author = await db.author.findUnique({
        where: { slug: authorSlug },
      })
      if (!author) {
        return NextResponse.json({ error: 'Author not found' }, { status: 404 })
      }
      book = await db.book.findFirst({
        where: {
          authorId: author.id,
          slug: bookId,
          ...(draftReaderId ? buildOwnedBookWhere(draftReaderId) : { isPublic: true }),
        },
        include: {
          author: true,
          chapters: {
            orderBy: { position: 'asc' },
            select: {
              id: true,
              title: true,
              level: true,
              position: true,
              variants: {
                select: {
                  id: true,
                  variantType: true,
                  contentHtml: true,
                  _count: {
                    select: {
                      paragraphs: true,
                    },
                  },
                },
              },
            },
          },
          _count: { select: { chapters: true } },
        },
      })
    } else {
      // Lookup by book ID
      book = await db.book.findFirst({
        where: {
          id: bookId,
          ...(draftReaderId ? buildOwnedBookWhere(draftReaderId) : { isPublic: true }),
        },
        include: {
          author: true,
          chapters: {
            orderBy: { position: 'asc' },
            select: {
              id: true,
              title: true,
              level: true,
              position: true,
              variants: {
                select: {
                  id: true,
                  variantType: true,
                  contentHtml: true,
                  _count: {
                    select: {
                      paragraphs: true,
                    },
                  },
                },
              },
            },
          },
          _count: { select: { chapters: true } },
        },
      })
    }

    if (!book) {
      return NextResponse.json({ error: 'Книга не найдена' }, { status: 404 })
    }

    const commentCount = await db.annotation.count({
      where: {
        bookId: book.id,
        kind: 'comment',
        status: 'active',
      },
    })

    const chapters = book.chapters.map((chapter) => {
      const sourceVariant = chapter.variants.find((variant) => variant.variantType === 'original')
        || chapter.variants[0]
      const sourceHtml = sourceVariant?.contentHtml || ''

      return {
        id: chapter.id,
        title: chapter.title,
        level: chapter.level,
        position: chapter.position,
        paragraphCount: sourceVariant?._count.paragraphs || 0,
        estimatedChars: estimateTextLengthFromHtml(sourceHtml),
        hasImages: /<img[\s>]/i.test(sourceHtml),
        variants: chapter.variants.map((variant) => ({
          id: variant.id,
          variantType: variant.variantType,
        })),
      }
    })

    return NextResponse.json({
      ...book,
      chapters,
      _count: {
        ...book._count,
        comments: commentCount,
      },
    })
  } catch (error) {
    console.error('Error fetching book:', error)
    return NextResponse.json({ error: 'Ошибка загрузки книги' }, { status: 500 })
  }
}

export async function PUT(
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
      return NextResponse.json({ error: 'Book not found' }, { status: 404 })
    }
    const settings = await getAppSettings()

    const body = await request.json()
    const updateData = buildBookUpdateData(body, {
      canPublish: adminReader.isMainAdmin || settings.allowUserPublishing,
    })

    const book = await db.book.update({
      where: { id: ownedBook.id },
      data: updateData,
    })

    return NextResponse.json(book)
  } catch (error: unknown) {
    console.error('Error updating book:', error)
    if (error instanceof BookUpdateValidationError) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }
    if (error && typeof error === 'object' && 'code' in error && (error as { code: string }).code === 'P2002') {
      return NextResponse.json({ error: 'Книга с таким slug уже существует' }, { status: 409 })
    }
    return NextResponse.json({ error: 'Ошибка обновления книги' }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ bookId: string }> }
) {
  try {
    const adminReader = await getAdminSessionReader(request)
    if (!adminReader) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { bookId } = await params
    const book = await db.book.findUnique({
      where: { id: bookId },
      select: {
        id: true,
        author: {
          select: {
            ownerReaderId: true,
          },
        },
        chapters: {
          select: {
            id: true,
            variants: {
              select: { id: true },
            },
          },
        },
      },
    })

    if (!book) {
      return NextResponse.json({ error: 'Книга не найдена' }, { status: 404 })
    }
    if (book.author.ownerReaderId !== adminReader.id) {
      return NextResponse.json({ error: 'Книга не найдена' }, { status: 404 })
    }

    const chapterIds = book.chapters.map((chapter) => chapter.id)
    const variantIds = book.chapters.flatMap((chapter) => chapter.variants.map((variant) => variant.id))

    await db.$transaction(async (tx) => {
      await tx.readingProgress.deleteMany({
        where: { bookId },
      })

      await tx.bookReaderStat.deleteMany({
        where: { bookId },
      })

      await tx.chapterReaderStat.deleteMany({
        where: { bookId },
      })

      await tx.annotation.deleteMany({
        where: { bookId },
      })

      if (variantIds.length > 0) {
        await tx.reaction.deleteMany({
          where: {
            chapterVariantId: { in: variantIds },
          },
        })

        await tx.paragraph.deleteMany({
          where: {
            chapterVariantId: { in: variantIds },
          },
        })

        await tx.chapterVariantRevisionParagraph.deleteMany({
          where: {
            revision: {
              chapterVariantId: { in: variantIds },
            },
          },
        })

        await tx.chapterVariantRevision.deleteMany({
          where: {
            chapterVariantId: { in: variantIds },
          },
        })

        await tx.chapterVariant.deleteMany({
          where: {
            id: { in: variantIds },
          },
        })
      }

      if (chapterIds.length > 0) {
        await tx.chapter.deleteMany({
          where: {
            id: { in: chapterIds },
          },
        })
      }

      await tx.book.delete({
        where: { id: bookId },
      })
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting book:', error)
    return NextResponse.json({ error: 'Ошибка удаления книги' }, { status: 500 })
  }
}
