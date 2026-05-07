import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

interface CreateChapterBody {
  title?: string;
}

function getDefaultChapterTitle(position: number): string {
  return `Новая глава ${position + 1}`;
}

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

    const [chapters, commentCounts] = await Promise.all([
      db.chapter.findMany({
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
        },
      }),
      db.annotation.groupBy({
        by: ['chapterId'],
        where: {
          bookId,
          kind: 'comment',
          status: 'active',
        },
        _count: {
          _all: true,
        },
      }),
    ]);

    const commentCountByChapterId = new Map(
      commentCounts.map((entry) => [entry.chapterId, entry._count._all]),
    );

    return NextResponse.json(
      chapters.map((chapter) => ({
        ...chapter,
        _count: {
          comments: commentCountByChapterId.get(chapter.id) ?? 0,
        },
      })),
    );
  } catch (error) {
    console.error('Error listing chapters:', error);
    return NextResponse.json(
      { error: 'Failed to list chapters' },
      { status: 500 }
    );
  }
}

// POST /api/books/[bookId]/chapters — Create a new chapter at the end of the book
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ bookId: string }> }
) {
  try {
    const { bookId } = await params;
    const body = (await request.json()) as CreateChapterBody;

    const book = await db.book.findUnique({
      where: { id: bookId },
      select: { id: true },
    });

    if (!book) {
      return NextResponse.json(
        { error: 'Book not found' },
        { status: 404 }
      );
    }

    const lastChapter = await db.chapter.findFirst({
      where: { bookId },
      orderBy: { position: 'desc' },
      select: { position: true },
    });

    const position = lastChapter ? lastChapter.position + 1 : 0;
    const title = body.title?.trim() || getDefaultChapterTitle(position);

    const chapter = await db.$transaction(async (tx) => {
      const createdChapter = await tx.chapter.create({
        data: {
          bookId,
          title,
          position,
        },
        include: { variants: true },
      });

      const originalVariant = await tx.chapterVariant.create({
        data: {
          chapterId: createdChapter.id,
          variantType: 'original',
          contentHtml: '',
        },
      });

      return {
        ...createdChapter,
        variants: [originalVariant],
      };
    });

    return NextResponse.json(chapter, { status: 201 });
  } catch (error) {
    console.error('Error creating chapter:', error);
    return NextResponse.json(
      { error: 'Failed to create chapter' },
      { status: 500 }
    );
  }
}
