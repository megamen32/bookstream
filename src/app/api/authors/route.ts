import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

// GET /api/authors — List all authors
export async function GET() {
  try {
    const authors = await db.author.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        _count: {
          select: { books: true },
        },
      },
    });
    return NextResponse.json(authors);
  } catch (error) {
    console.error('Error listing authors:', error);
    return NextResponse.json(
      { error: 'Failed to list authors' },
      { status: 500 }
    );
  }
}

// POST /api/authors — Create author
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { slug, name, bio } = body;

    if (!slug || !name) {
      return NextResponse.json(
        { error: 'slug and name are required' },
        { status: 400 }
      );
    }

    const author = await db.author.create({
      data: {
        slug,
        name,
        bio: bio || null,
      },
    });

    return NextResponse.json(author, { status: 201 });
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
      );
    }
    console.error('Error creating author:', error);
    return NextResponse.json(
      { error: 'Failed to create author' },
      { status: 500 }
    );
  }
}
