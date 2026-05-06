import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    const comments = await db.comment.findMany({
      where: {
        chapterId: id,
        status: 'active',
      },
      include: {
        quotes: true,
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    })

    return NextResponse.json({ comments })
  } catch (error) {
    console.error('Error fetching comments:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()
    const { readerId, username, body: commentBody, bookId, quotes } = body

    if (!readerId || !username || !commentBody || !bookId) {
      return NextResponse.json(
        { error: 'readerId, username, body, and bookId are required' },
        { status: 400 }
      )
    }

    const comment = await db.comment.create({
      data: {
        bookId,
        chapterId: id,
        readerId,
        username,
        body: commentBody,
        quotes: quotes
          ? {
              create: quotes.map((q: { variantType: string; paragraphId: string; selectedText: string }) => ({
                variantType: q.variantType,
                paragraphId: q.paragraphId,
                selectedText: q.selectedText,
              })),
            }
          : undefined,
      },
      include: {
        quotes: true,
      },
    })

    return NextResponse.json({ comment }, { status: 201 })
  } catch (error) {
    console.error('Error creating comment:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
