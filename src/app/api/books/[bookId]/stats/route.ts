import { NextRequest, NextResponse } from 'next/server'
import { getAdminSessionReader } from '@/lib/admin-auth'
import { getOwnedBook } from '@/lib/admin-ownership'
import { db } from '@/lib/db'
import { getAdminBookStats } from '@/lib/reading-stats'

/**
 * Returns reading analytics for a single book.
 *
 * Owners receive full chapter-level analytics. Public readers only receive
 * book-level aggregates when the book explicitly exposes them.
 *
 * @param request Incoming request.
 * @param context Dynamic route params.
 * @returns Stats payload or an access error.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ bookId: string }> },
) {
  try {
    const { bookId } = await params
    const adminReader = await getAdminSessionReader(request)
    const ownedBook = adminReader ? await getOwnedBook(adminReader.id, bookId) : null

    const book = await db.book.findUnique({
      where: { id: bookId },
      select: {
        id: true,
        isPublic: true,
        openStatsPublic: true,
      },
    })

    if (!book) {
      return NextResponse.json({ error: 'Книга не найдена' }, { status: 404 })
    }

    const canViewAdminStats = Boolean(ownedBook)
    const canViewPublicStats = book.isPublic && book.openStatsPublic

    if (!canViewAdminStats && !canViewPublicStats) {
      return NextResponse.json({ error: 'Статистика недоступна' }, { status: 404 })
    }

    const stats = await getAdminBookStats(db, bookId)

    if (canViewAdminStats) {
      return NextResponse.json(stats)
    }

    return NextResponse.json({
      book: stats.book,
    })
  } catch (error) {
    console.error('Error fetching book stats:', error)
    return NextResponse.json(
      { error: 'Не удалось загрузить статистику книги' },
      { status: 500 },
    )
  }
}
