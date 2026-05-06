import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { paragraphId, chapterVariantId, readerId, emoji } = body

    if (!paragraphId || !chapterVariantId || !readerId || !emoji) {
      return NextResponse.json(
        { error: 'paragraphId, chapterVariantId, readerId, and emoji are required' },
        { status: 400 }
      )
    }

    // Toggle reaction: if exists, delete; if not, create
    const existing = await db.reaction.findUnique({
      where: {
        paragraphId_readerId_emoji: { paragraphId, readerId, emoji },
      },
    })

    if (existing) {
      await db.reaction.delete({ where: { id: existing.id } })
      return NextResponse.json({ action: 'removed' })
    }

    await db.reaction.create({
      data: { paragraphId, chapterVariantId, readerId, emoji },
    })

    return NextResponse.json({ action: 'added' }, { status: 201 })
  } catch (error) {
    console.error('Error toggling reaction:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
