import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

// GET /api/books/[bookId]/chapters — List chapters for a book (ordered by position)
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ bookId: string }> }
) {
  try {
    const { bookId } = await params;

    // Verify book exists
    const book = await db.book.findUnique({
      where: { id: bookId },
    });

    if (!book) {
      return NextResponse.json(
        { error: 'Book not found' },
        { status: 404 }
      );
    }

    const chapters = await db.chapter.findMany({
      where: { bookId },
      orderBy: { position: 'asc' },
      include: {
        variants: {
          select: {
            id: true,
            variantType: true,
            editedByAuthor: true,
            createdAt: true,
            updatedAt: true,
          },
          orderBy: { createdAt: 'asc' },
        },
        _count: {
          select: { comments: true },
        },
      },
    });

    return NextResponse.json(chapters);
  } catch (error) {
    console.error('Error listing chapters:', error);
    return NextResponse.json(
      { error: 'Failed to list chapters' },
      { status: 500 }
    );
  }
}
