import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const bookId = searchParams.get('bookId')
    const status = searchParams.get('status')

    const where: Record<string, unknown> = {}
    if (bookId) where.bookId = bookId
    if (status && status !== 'all') where.status = status

    const comments = await db.comment.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        chapter: {
          select: { title: true },
        },
      },
    })

    return NextResponse.json(comments)
  } catch (error) {
    console.error('Error fetching comments:', error)
    return NextResponse.json({ error: 'Ошибка загрузки комментариев' }, { status: 500 })
  }
}
