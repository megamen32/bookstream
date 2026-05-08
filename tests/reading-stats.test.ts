import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  formatPercent,
  normalizeProgressPercent,
  normalizeSecondsDelta,
  recordReadingStatsEvent,
} from '../src/lib/reading-stats.ts'

interface BookReaderStatRecord {
  bookId: string
  readerId: string
  firstOpenedAt: Date
  lastOpenedAt: Date
  totalReadSeconds: number
  furthestProgressPercent: number
  lastChapterId: string | null
  completedChaptersCount: number
  isCompleted: boolean
}

interface ChapterReaderStatRecord {
  bookId: string
  chapterId: string
  readerId: string
  firstOpenedAt: Date
  lastOpenedAt: Date
  totalReadSeconds: number
  furthestProgressPercent: number
  isCompleted: boolean
}

function createReadingStatsClient(): {
  client: {
    $transaction: <T>(callback: (tx: any) => Promise<T>) => Promise<T>
  }
  bookStats: Map<string, BookReaderStatRecord>
  chapterStats: Map<string, ChapterReaderStatRecord>
} {
  const bookStats = new Map<string, BookReaderStatRecord>()
  const chapterStats = new Map<string, ChapterReaderStatRecord>()

  const transaction = {
    bookReaderStat: {
      findUnique: async ({ where }: { where: { bookId_readerId: { bookId: string; readerId: string } } }) => {
        const key = `${where.bookId_readerId.bookId}::${where.bookId_readerId.readerId}`
        const stat = bookStats.get(key)
        if (!stat) {
          return null
        }

        return {
          furthestProgressPercent: stat.furthestProgressPercent,
          isCompleted: stat.isCompleted,
        }
      },
      upsert: async ({
        where,
        update,
        create,
      }: {
        where: { bookId_readerId: { bookId: string; readerId: string } }
        update: Record<string, unknown>
        create: BookReaderStatRecord
      }) => {
        const key = `${where.bookId_readerId.bookId}::${where.bookId_readerId.readerId}`
        const existing = bookStats.get(key)
        if (existing) {
          bookStats.set(key, {
            ...existing,
            lastOpenedAt: update.lastOpenedAt as Date,
            totalReadSeconds: existing.totalReadSeconds + ((update.totalReadSeconds as { increment: number }).increment ?? 0),
            furthestProgressPercent: (update.furthestProgressPercent as { set: number }).set,
            lastChapterId: update.lastChapterId as string,
            isCompleted: update.isCompleted as boolean,
          })
          return
        }

        bookStats.set(key, { ...create })
      },
      update: async ({
        where,
        data,
      }: {
        where: { bookId_readerId: { bookId: string; readerId: string } }
        data: Record<string, unknown>
      }) => {
        const key = `${where.bookId_readerId.bookId}::${where.bookId_readerId.readerId}`
        const existing = bookStats.get(key)
        assert.ok(existing)
        bookStats.set(key, {
          ...existing,
          furthestProgressPercent: (data.furthestProgressPercent as number | undefined) ?? existing.furthestProgressPercent,
          completedChaptersCount: (data.completedChaptersCount as number | undefined) ?? existing.completedChaptersCount,
          isCompleted: (data.isCompleted as boolean | undefined) ?? existing.isCompleted,
        })
      },
    },
    chapterReaderStat: {
      findUnique: async ({ where }: { where: { chapterId_readerId: { chapterId: string; readerId: string } } }) => {
        const key = `${where.chapterId_readerId.chapterId}::${where.chapterId_readerId.readerId}`
        const stat = chapterStats.get(key)
        if (!stat) {
          return null
        }

        return {
          furthestProgressPercent: stat.furthestProgressPercent,
          isCompleted: stat.isCompleted,
        }
      },
      upsert: async ({
        where,
        update,
        create,
      }: {
        where: { chapterId_readerId: { chapterId: string; readerId: string } }
        update: Record<string, unknown>
        create: ChapterReaderStatRecord
      }) => {
        const key = `${where.chapterId_readerId.chapterId}::${where.chapterId_readerId.readerId}`
        const existing = chapterStats.get(key)
        if (existing) {
          chapterStats.set(key, {
            ...existing,
            lastOpenedAt: update.lastOpenedAt as Date,
            totalReadSeconds: existing.totalReadSeconds + ((update.totalReadSeconds as { increment: number }).increment ?? 0),
            furthestProgressPercent: (update.furthestProgressPercent as { set: number }).set,
            isCompleted: update.isCompleted as boolean,
          })
          return
        }

        chapterStats.set(key, { ...create })
      },
      count: async ({ where }: { where: { bookId: string; readerId: string; isCompleted: boolean } }) => {
        return Array.from(chapterStats.values()).filter((stat) => (
          stat.bookId === where.bookId &&
          stat.readerId === where.readerId &&
          stat.isCompleted === where.isCompleted
        )).length
      },
      update: async ({
        where,
        data,
      }: {
        where: { chapterId_readerId: { chapterId: string; readerId: string } }
        data: Record<string, unknown>
      }) => {
        const key = `${where.chapterId_readerId.chapterId}::${where.chapterId_readerId.readerId}`
        const existing = chapterStats.get(key)
        assert.ok(existing)
        chapterStats.set(key, {
          ...existing,
          furthestProgressPercent: (data.furthestProgressPercent as number | undefined) ?? existing.furthestProgressPercent,
          isCompleted: (data.isCompleted as boolean | undefined) ?? existing.isCompleted,
        })
      },
    },
  }

  return {
    client: {
      $transaction: async <T>(callback: (tx: any) => Promise<T>): Promise<T> => await callback(transaction),
    },
    bookStats,
    chapterStats,
  }
}

describe('reading stats helpers', () => {
  it('normalizes progress and heartbeat duration', () => {
    assert.equal(normalizeProgressPercent(-1), 0)
    assert.equal(normalizeProgressPercent(0.42), 0.42)
    assert.equal(normalizeProgressPercent(10), 1)
    assert.equal(normalizeSecondsDelta(undefined), 0)
    assert.equal(normalizeSecondsDelta(7.6), 8)
    assert.equal(normalizeSecondsDelta(999), 60)
    assert.equal(formatPercent(0.376), 38)
  })

  it('creates book and chapter stats on the first open', async () => {
    const { client, bookStats, chapterStats } = createReadingStatsClient()

    await recordReadingStatsEvent(client as any, {
      readerId: 'reader-1',
      bookId: 'book-1',
      chapterId: 'chapter-1',
      eventType: 'open',
      progressPercent: 0.15,
    })

    assert.equal(bookStats.size, 1)
    assert.equal(chapterStats.size, 1)
    assert.equal(bookStats.get('book-1::reader-1')?.furthestProgressPercent, 0.15)
    assert.equal(chapterStats.get('chapter-1::reader-1')?.totalReadSeconds, 0)
  })

  it('keeps furthest progress monotonic and increments reading time on heartbeat', async () => {
    const { client, bookStats, chapterStats } = createReadingStatsClient()

    await recordReadingStatsEvent(client as any, {
      readerId: 'reader-1',
      bookId: 'book-1',
      chapterId: 'chapter-1',
      eventType: 'open',
      progressPercent: 0.8,
    })

    await recordReadingStatsEvent(client as any, {
      readerId: 'reader-1',
      bookId: 'book-1',
      chapterId: 'chapter-1',
      eventType: 'heartbeat',
      secondsDelta: 12,
      progressPercent: 0.35,
    })

    assert.equal(bookStats.get('book-1::reader-1')?.furthestProgressPercent, 0.8)
    assert.equal(chapterStats.get('chapter-1::reader-1')?.furthestProgressPercent, 0.8)
    assert.equal(bookStats.get('book-1::reader-1')?.totalReadSeconds, 12)
    assert.equal(chapterStats.get('chapter-1::reader-1')?.totalReadSeconds, 12)
  })

  it('marks completion only after the threshold and does not duplicate unique readers', async () => {
    const { client, bookStats } = createReadingStatsClient()

    await recordReadingStatsEvent(client as any, {
      readerId: 'reader-1',
      bookId: 'book-1',
      chapterId: 'chapter-1',
      eventType: 'open',
      progressPercent: 0.94,
    })
    await recordReadingStatsEvent(client as any, {
      readerId: 'reader-1',
      bookId: 'book-1',
      chapterId: 'chapter-1',
      eventType: 'open',
      progressPercent: 0.94,
    })

    assert.equal(bookStats.size, 1)
    assert.equal(bookStats.get('book-1::reader-1')?.isCompleted, false)

    await recordReadingStatsEvent(client as any, {
      readerId: 'reader-1',
      bookId: 'book-1',
      chapterId: 'chapter-1',
      eventType: 'heartbeat',
      secondsDelta: 5,
      progressPercent: 0.95,
    })

    assert.equal(bookStats.get('book-1::reader-1')?.isCompleted, true)
    assert.equal(bookStats.get('book-1::reader-1')?.completedChaptersCount, 1)
  })
})
