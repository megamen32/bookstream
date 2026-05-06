import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

// GET /api/books — List books (with author info). Query params: authorSlug
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const authorSlug = searchParams.get('authorSlug');

    const books = await db.book.findMany({
      where: authorSlug
        ? { author: { slug: authorSlug } }
        : undefined,
      orderBy: { createdAt: 'desc' },
      include: {
        author: {
          select: { id: true, slug: true, name: true },
        },
        _count: {
          select: { chapters: true },
        },
      },
    });

    return NextResponse.json(books);
  } catch (error) {
    console.error('Error listing books:', error);
    return NextResponse.json(
      { error: 'Failed to list books' },
      { status: 500 }
    );
  }
}

// POST /api/books — Create book
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { authorSlug, slug, title, description, readingModeDefault } = body;

    if (!authorSlug || !slug || !title) {
      return NextResponse.json(
        { error: 'authorSlug, slug, and title are required' },
        { status: 400 }
      );
    }

    // Find the author
    const author = await db.author.findUnique({
      where: { slug: authorSlug },
    });

    if (!author) {
      return NextResponse.json(
        { error: 'Author not found' },
        { status: 404 }
      );
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
    });

    return NextResponse.json(book, { status: 201 });
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
      );
    }
    console.error('Error creating book:', error);
    return NextResponse.json(
      { error: 'Failed to create book' },
      { status: 500 }
    );
  }
}
