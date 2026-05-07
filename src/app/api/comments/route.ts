import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

// GET /api/comments — Get comments for a chapter
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const chapterId = searchParams.get('chapterId');
    const readerId = searchParams.get('readerId');

    if (!chapterId) {
      return NextResponse.json(
        { error: 'chapterId is required' },
        { status: 400 }
      );
    }

    const comments = await db.comment.findMany({
      where: {
        chapterId,
        // Filter out shadowbanned comments unless the requesting reader is the author
        ...(readerId ? {
          OR: [
            { status: { not: 'shadowbanned' } },
            { readerId },
          ],
        } : {
          status: { not: 'shadowbanned' },
        }),
      },
      orderBy: { createdAt: 'desc' },
      include: {
        quotes: true,
      },
    });

    return NextResponse.json(comments);
  } catch (error) {
    console.error('Error fetching comments:', error);
    return NextResponse.json(
      { error: 'Failed to fetch comments' },
      { status: 500 }
    );
  }
}

// POST /api/comments — Create comment
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { bookId, chapterId, readerId, username, body: commentBody, quote } = body;

    if (!bookId || !chapterId || !readerId || !username || !commentBody) {
      return NextResponse.json(
        { error: 'bookId, chapterId, readerId, username, and body are required' },
        { status: 400 }
      );
    }

    // Rate limit: check last comment time (15s cooldown)
    const fifteenSecondsAgo = new Date(Date.now() - 15_000);
    const recentComment = await db.comment.findFirst({
      where: {
        readerId,
        createdAt: { gte: fifteenSecondsAgo },
      },
    });

    if (recentComment) {
      return NextResponse.json(
        { error: 'Please wait before posting another comment (15s cooldown)' },
        { status: 429 }
      );
    }

    // Create the comment
    const comment = await db.comment.create({
      data: {
        bookId,
        chapterId,
        readerId,
        username,
        body: commentBody,
        quotes: quote
          ? {
              create: {
                variantType: quote.variantType || 'original',
                paragraphId: quote.paragraphId,
                endParagraphId: quote.endParagraphId || null,
                selectedText: quote.selectedText,
                startOffset: quote.startOffset || 0,
                endOffset: quote.endOffset || 0,
              },
            }
          : undefined,
      },
      include: {
        quotes: true,
      },
    });

    return NextResponse.json(comment, { status: 201 });
  } catch (error) {
    console.error('Error creating comment:', error);
    return NextResponse.json(
      { error: 'Failed to create comment' },
      { status: 500 }
    );
  }
}
