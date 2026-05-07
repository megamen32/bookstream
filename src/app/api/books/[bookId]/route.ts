import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

function canViewDrafts(request: NextRequest): boolean {
  const { searchParams } = new URL(request.url)
  if (searchParams.get('includeDrafts') === '1') {
    return true
  }

  const referer = request.headers.get('referer')
  if (!referer) {
    return false
  }

  try {
    return new URL(referer).pathname.startsWith('/admin')
  } catch {
    return false
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ bookId: string }> }
) {
  try {
    const { bookId } = await params
    const { searchParams } = new URL(request.url)
    const authorSlug = searchParams.get('authorSlug')
    const includeDrafts = canViewDrafts(request)

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
          ...(includeDrafts ? {} : { isPublic: true }),
        },
        include: {
          author: true,
          chapters: {
            orderBy: { position: 'asc' },
            include: { variants: true },
          },
          _count: { select: { comments: true } },
        },
      })
    } else {
      // Lookup by book ID
      book = await db.book.findFirst({
        where: {
          id: bookId,
          ...(includeDrafts ? {} : { isPublic: true }),
        },
        include: {
          author: true,
          chapters: {
            orderBy: { position: 'asc' },
            include: { variants: true },
          },
          _count: { select: { comments: true } },
        },
      })
    }

    if (!book) {
      return NextResponse.json({ error: 'Книга не найдена' }, { status: 404 })
    }

    return NextResponse.json(book)
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
    const { bookId } = await params
    const body = await request.json()
    const { title, description, slug, isPublic, readingModeDefault } = body

    const book = await db.book.update({
      where: { id: bookId },
      data: {
        ...(title !== undefined && { title }),
        ...(description !== undefined && { description }),
        ...(slug !== undefined && { slug }),
        ...(isPublic !== undefined && { isPublic }),
        ...(readingModeDefault !== undefined && { readingModeDefault }),
      },
    })

    return NextResponse.json(book)
  } catch (error: unknown) {
    console.error('Error updating book:', error)
    if (error && typeof error === 'object' && 'code' in error && (error as { code: string }).code === 'P2002') {
      return NextResponse.json({ error: 'Книга с таким slug уже существует' }, { status: 409 })
    }
    return NextResponse.json({ error: 'Ошибка обновления книги' }, { status: 500 })
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ bookId: string }> }
) {
  try {
    const { bookId } = await params
    const book = await db.book.findUnique({
      where: { id: bookId },
      select: {
        id: true,
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

    const chapterIds = book.chapters.map((chapter) => chapter.id)
    const variantIds = book.chapters.flatMap((chapter) => chapter.variants.map((variant) => variant.id))

    await db.$transaction(async (tx) => {
      await tx.readingProgress.deleteMany({
        where: { bookId },
      })

      await tx.annotation.deleteMany({
        where: { bookId },
      })

      await tx.comment.deleteMany({
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
