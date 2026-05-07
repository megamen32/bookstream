import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ commentId: string }> },
) {
  try {
    const { commentId } = await params
    const body = await request.json()
    const { status } = body

    if (!status) {
      return NextResponse.json({ error: 'status is required' }, { status: 400 })
    }

    const existing = await db.annotation.findUnique({
      where: { id: commentId },
      select: {
        id: true,
        kind: true,
      },
    })

    if (!existing || existing.kind !== 'comment') {
      return NextResponse.json({ error: 'Comment not found' }, { status: 404 })
    }

    const comment = await db.annotation.update({
      where: { id: commentId },
      data: { status },
    })

    return NextResponse.json(comment)
  } catch (error) {
    console.error('Error updating comment:', error)
    return NextResponse.json({ error: 'Failed to update comment' }, { status: 500 })
  }
}
