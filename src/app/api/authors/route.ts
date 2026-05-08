import { NextRequest, NextResponse } from 'next/server'
import { ensureReaderAuthorProfile } from '@/lib/admin-ownership'
import { getAdminSessionReader } from '@/lib/admin-auth'
import { db } from '@/lib/db'

// GET /api/authors — List all authors
export async function GET(request: NextRequest) {
  try {
    const adminReader = await getAdminSessionReader(request)
    if (adminReader) {
      const authors = await db.author.findMany({
        where: { ownerReaderId: adminReader.id },
        orderBy: { createdAt: 'desc' },
        include: {
          _count: {
            select: { books: true },
          },
        },
      })

      if (authors.length === 0) {
        const createdAuthor = await ensureReaderAuthorProfile(adminReader.id, adminReader.currentUsername)
        return NextResponse.json([
          {
            ...createdAuthor,
            _count: {
              books: 0,
            },
          },
        ])
      }

      return NextResponse.json(authors)
    }

    const authors = await db.author.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        _count: {
          select: { books: true },
        },
      },
    })
    return NextResponse.json(authors)
  } catch (error) {
    console.error('Error listing authors:', error)
    return NextResponse.json(
      { error: 'Failed to list authors' },
      { status: 500 }
    )
  }
}

// POST /api/authors — Create author
export async function POST(request: NextRequest) {
  try {
    const adminReader = await getAdminSessionReader(request)
    if (!adminReader) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { slug, name, bio } = body

    if (!slug || !name) {
      return NextResponse.json(
        { error: 'slug and name are required' },
        { status: 400 }
      )
    }

    const author = await db.author.create({
      data: {
        slug,
        name,
        bio: bio || null,
        ownerReaderId: adminReader.id,
      },
    })

    return NextResponse.json(author, { status: 201 })
  } catch (error: unknown) {
    if (
      error &&
      typeof error === 'object' &&
      'code' in error &&
      (error as { code: string }).code === 'P2002'
    ) {
      return NextResponse.json(
        { error: 'Author with this slug already exists' },
        { status: 409 }
      )
    }
    console.error('Error creating author:', error)
    return NextResponse.json(
      { error: 'Failed to create author' },
      { status: 500 }
    )
  }
}

// PUT /api/authors — Update current admin's author
export async function PUT(request: NextRequest) {
  try {
    const adminReader = await getAdminSessionReader(request)
    if (!adminReader) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json() as {
      id?: string
      slug?: string
      name?: string
      bio?: string | null
    }
    const id = body.id?.trim()
    const slug = body.slug?.trim()
    const name = body.name?.trim()

    if (!slug || !name) {
      return NextResponse.json({ error: 'slug and name are required' }, { status: 400 })
    }

    const existingAuthor = id
      ? await db.author.findFirst({
          where: {
            id,
            ownerReaderId: adminReader.id,
          },
          select: { id: true },
        })
      : await db.author.findFirst({
          where: { ownerReaderId: adminReader.id },
          orderBy: { createdAt: 'asc' },
          select: { id: true },
        })

    if (!existingAuthor) {
      return NextResponse.json({ error: 'Автор не найден' }, { status: 404 })
    }

    const author = await db.author.update({
      where: { id: existingAuthor.id },
      data: {
        slug,
        name,
        bio: body.bio?.trim() || null,
      },
    })

    return NextResponse.json(author)
  } catch (error: unknown) {
    if (
      error &&
      typeof error === 'object' &&
      'code' in error &&
      (error as { code: string }).code === 'P2002'
    ) {
      return NextResponse.json({ error: 'Author with this slug already exists' }, { status: 409 })
    }
    console.error('Error updating author:', error)
    return NextResponse.json({ error: 'Failed to update author' }, { status: 500 })
  }
}
