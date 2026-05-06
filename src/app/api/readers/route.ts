import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

// POST /api/readers — Create or update reader
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, currentUsername } = body;

    if (!id || !currentUsername) {
      return NextResponse.json(
        { error: 'id and currentUsername are required' },
        { status: 400 }
      );
    }

    const reader = await db.reader.upsert({
      where: { id },
      update: {
        currentUsername,
      },
      create: {
        id,
        currentUsername,
      },
    });

    return NextResponse.json(reader, { status: 201 });
  } catch (error) {
    console.error('Error creating/updating reader:', error);
    return NextResponse.json(
      { error: 'Failed to create or update reader' },
      { status: 500 }
    );
  }
}

// GET /api/readers — Get reader by id
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json(
        { error: 'id query parameter is required' },
        { status: 400 }
      );
    }

    const reader = await db.reader.findUnique({
      where: { id },
    });

    if (!reader) {
      return NextResponse.json(null);
    }

    return NextResponse.json(reader);
  } catch (error) {
    console.error('Error fetching reader:', error);
    return NextResponse.json(
      { error: 'Failed to fetch reader' },
      { status: 500 }
    );
  }
}
