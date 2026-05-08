import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import {
  normalizeProgressPercent,
  normalizeSecondsDelta,
  recordReadingStatsEvent,
  type ReadingStatsEventInput,
} from '@/lib/reading-stats'

interface ReadingStatsRequestBody {
  readerId?: string
  bookId?: string
  chapterId?: string
  eventType?: 'open' | 'heartbeat'
  secondsDelta?: number
  progressPercent?: number
}

/**
 * Persists a lightweight reading analytics event for a book and chapter.
 *
 * @param request Incoming request with reading telemetry.
 * @returns Success flag or a validation error.
 */
export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as ReadingStatsRequestBody
    const readerId = body.readerId?.trim()
    const bookId = body.bookId?.trim()
    const chapterId = body.chapterId?.trim()
    const eventType = body.eventType

    if (!readerId || !bookId || !chapterId || (eventType !== 'open' && eventType !== 'heartbeat')) {
      return NextResponse.json(
        { error: 'readerId, bookId, chapterId and eventType are required' },
        { status: 400 },
      )
    }

    const chapter = await db.chapter.findFirst({
      where: {
        id: chapterId,
        bookId,
      },
      select: {
        id: true,
      },
    })

    if (!chapter) {
      return NextResponse.json({ error: 'Глава не найдена' }, { status: 404 })
    }

    const input: ReadingStatsEventInput = {
      readerId,
      bookId,
      chapterId,
      eventType,
      secondsDelta: normalizeSecondsDelta(body.secondsDelta),
      progressPercent: normalizeProgressPercent(body.progressPercent ?? 0),
    }

    await recordReadingStatsEvent(db, input)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error recording reading stats:', error)
    return NextResponse.json(
      { error: 'Не удалось сохранить статистику чтения' },
      { status: 500 },
    )
  }
}
