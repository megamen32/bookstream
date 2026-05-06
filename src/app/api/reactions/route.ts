import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

// GET /api/reactions — Get reactions for a paragraph
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const paragraphId = searchParams.get('paragraphId');
    const chapterVariantId = searchParams.get('chapterVariantId');

    if (!paragraphId || !chapterVariantId) {
      return NextResponse.json(
        { error: 'paragraphId and chapterVariantId are required' },
        { status: 400 }
      );
    }

    const reactions = await db.reaction.findMany({
      where: {
        paragraphId,
        chapterVariantId,
      },
      orderBy: { createdAt: 'desc' },
    });

    // Group by emoji and count
    const grouped = reactions.reduce((acc, reaction) => {
      if (!acc[reaction.emoji]) {
        acc[reaction.emoji] = {
          emoji: reaction.emoji,
          count: 0,
          readerIds: [],
        };
      }
      acc[reaction.emoji].count++;
      acc[reaction.emoji].readerIds.push(reaction.readerId);
      return acc;
    }, {} as Record<string, { emoji: string; count: number; readerIds: string[] }>);

    return NextResponse.json(Object.values(grouped));
  } catch (error) {
    console.error('Error fetching reactions:', error);
    return NextResponse.json(
      { error: 'Failed to fetch reactions' },
      { status: 500 }
    );
  }
}

// POST /api/reactions — Toggle reaction
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { paragraphId, chapterVariantId, readerId, emoji } = body;

    if (!paragraphId || !chapterVariantId || !readerId || !emoji) {
      return NextResponse.json(
        { error: 'paragraphId, chapterVariantId, readerId, and emoji are required' },
        { status: 400 }
      );
    }

    // Check if reaction already exists (toggle)
    const existing = await db.reaction.findUnique({
      where: {
        paragraphId_readerId_emoji: {
          paragraphId,
          readerId,
          emoji,
        },
      },
    });

    if (existing) {
      // Remove reaction (toggle off)
      await db.reaction.delete({
        where: { id: existing.id },
      });

      return NextResponse.json({
        action: 'removed',
        emoji,
        paragraphId,
        readerId,
      });
    }

    // Create new reaction (toggle on)
    const reaction = await db.reaction.create({
      data: {
        paragraphId,
        chapterVariantId,
        readerId,
        emoji,
      },
    });

    return NextResponse.json({
      action: 'added',
      reaction,
    }, { status: 201 });
  } catch (error) {
    console.error('Error toggling reaction:', error);
    return NextResponse.json(
      { error: 'Failed to toggle reaction' },
      { status: 500 }
    );
  }
}
