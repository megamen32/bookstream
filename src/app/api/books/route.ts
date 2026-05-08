import { NextRequest, NextResponse } from 'next/server'
import type { Prisma } from '@prisma/client'
import { buildOwnedBookWhere } from '@/lib/admin-ownership'
import { getAdminSessionReader } from '@/lib/admin-auth'
import { db } from '@/lib/db'

async function getDraftAccessReaderId(request: NextRequest): Promise<string | null> {
  const { searchParams } = new URL(request.url)
  if (searchParams.get('includeDrafts') !== '1') {
    return null
  }

  const adminReader = await getAdminSessionReader(request)
  return adminReader?.id || null
}

// GET /api/books — List books (with author info). Query params: authorSlug
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const authorSlug = searchParams.get('authorSlug')
    const sort = searchParams.get('sort') === 'popular' ? 'popular' : 'latest'
    const limitRaw = searchParams.get('limit')
    const limit = limitRaw && Number.isFinite(Number(limitRaw))
      ? Math.max(1, Math.min(100, Math.round(Number(limitRaw))))
      : undefined
    const draftReaderId = await getDraftAccessReaderId(request)
    const where: Prisma.BookWhereInput = draftReaderId
      ? {
          ...(authorSlug
            ? {
                author: {
                  slug: authorSlug,
                  ownerReaderId: draftReaderId,
                },
              }
            : buildOwnedBookWhere(draftReaderId)),
        }
      : {
          ...(authorSlug ? { author: { slug: authorSlug } } : {}),
          isPublic: true,
        }

    const [books, commentCounts] = await Promise.all([
      db.book.findMany({
        where,
        orderBy: sort === 'popular'
          ? [
              { readerStats: { _count: 'desc' } },
              { createdAt: 'desc' },
            ]
          : { createdAt: 'desc' },
        ...(limit ? { take: limit } : {}),
        include: {
          author: {
            select: { id: true, slug: true, name: true },
          },
          _count: {
            select: { chapters: true, readerStats: true },
          },
        },
      }),
      db.annotation.groupBy({
        by: ['bookId'],
        where: {
          kind: 'comment',
          status: 'active',
        },
        _count: {
          _all: true,
        },
      }),
    ])

    const commentCountByBookId = new Map(
      commentCounts.map((entry) => [entry.bookId, entry._count._all]),
    )

    return NextResponse.json(
      books.map((book) => ({
        ...book,
        _count: {
          ...book._count,
          comments: commentCountByBookId.get(book.id) ?? 0,
          readers: book._count.readerStats,
        },
      })),
    )
  } catch (error) {
    console.error('Error listing books:', error)
    return NextResponse.json(
      { error: 'Failed to list books' },
      { status: 500 }
    )
  }
}

// POST /api/books — Create book
export async function POST(request: NextRequest) {
  try {
    const adminReader = await getAdminSessionReader(request)
    if (!adminReader) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { authorSlug, slug, title, description, readingModeDefault } = body

    if (!authorSlug || !slug || !title) {
      return NextResponse.json(
        { error: 'authorSlug, slug, and title are required' },
        { status: 400 }
      )
    }

    const author = await db.author.findFirst({
      where: {
        slug: authorSlug,
        ownerReaderId: adminReader.id,
      },
    })

    if (!author) {
      return NextResponse.json(
        { error: 'Author not found or does not belong to you' },
        { status: 404 }
      )
    }

    const book = await db.book.create({
      data: {
        slug,
        title,
        description: description || null,
        readingModeDefault: readingModeDefault || 'feed',
        authorId: author.id,
      },
      include: {
        author: {
          select: { id: true, slug: true, name: true },
        },
      },
    })

    return NextResponse.json(book, { status: 201 })
  } catch (error: unknown) {
    if (
      error &&
      typeof error === 'object' &&
      'code' in error &&
      (error as { code: string }).code === 'P2002'
    ) {
      return NextResponse.json(
        { error: 'Book with this slug already exists for this author' },
        { status: 409 }
      )
    }
    console.error('Error creating book:', error)
    return NextResponse.json(
      { error: 'Failed to create book' },
      { status: 500 }
    )
  }
}
