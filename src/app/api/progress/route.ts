import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

// GET /api/progress — Get reading progress
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const readerId = searchParams.get('readerId');
    const bookId = searchParams.get('bookId');

    if (!readerId || !bookId) {
      return NextResponse.json(
        { error: 'readerId and bookId are required' },
        { status: 400 }
      );
    }

    const progress = await db.readingProgress.findUnique({
      where: {
        readerId_bookId: {
          readerId,
          bookId,
        },
      },
    });

    if (!progress) {
      return NextResponse.json(null);
    }

    return NextResponse.json(progress);
  } catch (error) {
    console.error('Error fetching progress:', error);
    return NextResponse.json(
      { error: 'Failed to fetch reading progress' },
      { status: 500 }
    );
  }
}

// POST /api/progress — Upsert reading progress
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      readerId,
      bookId,
      chapterId,
      variantType,
      scrollPercent,
      fontSize,
      lineHeight,
      readingMode,
    } = body;

    if (!readerId || !bookId) {
      return NextResponse.json(
        { error: 'readerId and bookId are required' },
        { status: 400 }
      );
    }

    const progress = await db.readingProgress.upsert({
      where: {
        readerId_bookId: {
          readerId,
          bookId,
        },
      },
      update: {
        ...(chapterId !== undefined && { chapterId }),
        ...(variantType !== undefined && { variantType }),
        ...(scrollPercent !== undefined && { scrollPercent }),
        ...(fontSize !== undefined && { fontSize }),
        ...(lineHeight !== undefined && { lineHeight }),
        ...(readingMode !== undefined && { readingMode }),
      },
      create: {
        readerId,
        bookId,
        chapterId: chapterId || '',
        variantType: variantType || 'original',
        scrollPercent: scrollPercent ?? 0,
        fontSize: fontSize ?? 18,
        lineHeight: lineHeight ?? 1.6,
        readingMode: readingMode || 'feed',
      },
    });

    return NextResponse.json(progress);
  } catch (error) {
    console.error('Error saving progress:', error);
    return NextResponse.json(
      { error: 'Failed to save reading progress' },
      { status: 500 }
    );
  }
}
