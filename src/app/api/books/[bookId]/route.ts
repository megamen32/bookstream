import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ bookId: string }> }
) {
  try {
    const { bookId } = await params
    const { searchParams } = new URL(request.url)
    const authorSlug = searchParams.get('authorSlug')

    let book

    if (authorSlug) {
      // Lookup by authorSlug + book slug
      const author = await db.author.findUnique({
        where: { slug: authorSlug },
      })
      if (!author) {
        return NextResponse.json({ error: 'Author not found' }, { status: 404 })
      }
      book = await db.book.findUnique({
        where: {
          authorId_slug: { authorId: author.id, slug: bookId },
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
      book = await db.book.findUnique({
        where: { id: bookId },
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
    await db.book.delete({ where: { id: bookId } })
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting book:', error)
    return NextResponse.json({ error: 'Ошибка удаления книги' }, { status: 500 })
  }
}
