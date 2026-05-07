import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { mapAnnotationComment, sortCommentsByTop } from '@/lib/annotations'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const bookId = searchParams.get('bookId')
    const status = searchParams.get('status')
    const readerId = searchParams.get('readerId')

    const comments = await db.annotation.findMany({
      where: {
        kind: 'comment',
        ...(bookId ? { bookId } : {}),
        ...(status && status !== 'all' ? { status } : {}),
      },
      include: {
        votes: {
          select: {
            readerId: true,
          },
        },
        chapter: {
          select: {
            id: true,
            title: true,
            position: true,
          },
        },
      },
      take: 300,
    })

    return NextResponse.json(sortCommentsByTop(comments.map((comment) => mapAnnotationComment(comment, readerId))))
  } catch (error) {
    console.error('Error fetching comments:', error)
    return NextResponse.json({ error: 'Ошибка загрузки комментариев' }, { status: 500 })
  }
}
