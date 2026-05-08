import type { PrismaClient } from '@prisma/client'

export const READING_STATS_HEARTBEAT_SECONDS = 15
export const READING_STATS_COMPLETION_THRESHOLD = 0.95

export type ReadingStatsEventType = 'open' | 'heartbeat'

export interface ReadingStatsEventInput {
  readerId: string
  bookId: string
  chapterId: string
  eventType: ReadingStatsEventType
  secondsDelta?: number
  progressPercent: number
}

export interface ChapterStatsSummary {
  chapterId: string
  title: string
  position: number
  uniqueReaders: number
  totalReadSeconds: number
  avgProgressPercent: number
  completionRatePercent: number
}

export interface BookStatsSummary {
  uniqueReaders: number
  totalReadSeconds: number
  avgReadSeconds: number
  avgProgressPercent: number
  completionRatePercent: number
}

export interface AdminBookStatsResponse {
  book: BookStatsSummary
  chapters: ChapterStatsSummary[]
  topChapters: ChapterStatsSummary[]
}

export interface PublicBookStatsResponse {
  book: BookStatsSummary
}

interface BookStatAggregateRow {
  _count: { _all: number }
  _avg: {
    totalReadSeconds: number | null
    furthestProgressPercent: number | null
  }
  _sum: {
    totalReadSeconds: number | null
  }
}

interface CompletionAggregateRow {
  isCompleted: boolean
  _count: { _all: number }
}

interface ChapterAggregateRow {
  chapterId: string
  _count: { _all: number }
  _avg: {
    furthestProgressPercent: number | null
  }
  _sum: {
    totalReadSeconds: number | null
  }
}

/**
 * Clamps persisted progress to the reader-visible 0..1 range.
 *
 * @param progressPercent Progress fraction reported by the client.
 * @returns Sanitized progress fraction.
 */
export function normalizeProgressPercent(progressPercent: number): number {
  if (!Number.isFinite(progressPercent)) {
    return 0
  }

  return Math.max(0, Math.min(1, progressPercent))
}

/**
 * Clamps heartbeat duration to a small trusted range.
 *
 * @param secondsDelta Client-reported active reading time delta.
 * @returns Sanitized integer seconds.
 */
export function normalizeSecondsDelta(secondsDelta: number | undefined): number {
  if (!Number.isFinite(secondsDelta)) {
    return 0
  }

  return Math.max(0, Math.min(READING_STATS_HEARTBEAT_SECONDS * 4, Math.round(secondsDelta as number)))
}

/**
 * Converts a progress fraction into a rounded percentage for presentation.
 *
 * @param value Fractional progress from 0 to 1.
 * @returns Integer percentage from 0 to 100.
 */
export function formatPercent(value: number | null | undefined): number {
  if (!Number.isFinite(value ?? NaN)) {
    return 0
  }

  return Math.max(0, Math.min(100, Math.round((value as number) * 100)))
}

/**
 * Returns whether a reader should be treated as having completed the content.
 *
 * @param progressPercent Furthest known progress fraction.
 * @returns Completion flag based on the shared threshold.
 */
export function isCompletedByProgress(progressPercent: number): boolean {
  return normalizeProgressPercent(progressPercent) >= READING_STATS_COMPLETION_THRESHOLD
}

/**
 * Records a reading analytics event without changing the main progress model.
 *
 * @param client Prisma client or transaction.
 * @param input Normalized event payload.
 */
export async function recordReadingStatsEvent(
  client: PrismaClient,
  input: ReadingStatsEventInput,
): Promise<void> {
  const progressPercent = normalizeProgressPercent(input.progressPercent)
  const secondsDelta = input.eventType === 'heartbeat' ? normalizeSecondsDelta(input.secondsDelta) : 0
  const completed = isCompletedByProgress(progressPercent)
  const now = new Date()

  await client.$transaction(async (tx) => {
    const [existingBookStat, existingChapterStat] = await Promise.all([
      tx.bookReaderStat.findUnique({
        where: {
          bookId_readerId: {
            bookId: input.bookId,
            readerId: input.readerId,
          },
        },
        select: {
          furthestProgressPercent: true,
          isCompleted: true,
        },
      }),
      tx.chapterReaderStat.findUnique({
        where: {
          chapterId_readerId: {
            chapterId: input.chapterId,
            readerId: input.readerId,
          },
        },
        select: {
          furthestProgressPercent: true,
          isCompleted: true,
        },
      }),
    ])

    const nextBookProgress = Math.max(existingBookStat?.furthestProgressPercent ?? 0, progressPercent)
    const nextChapterProgress = Math.max(existingChapterStat?.furthestProgressPercent ?? 0, progressPercent)

    await tx.bookReaderStat.upsert({
      where: {
        bookId_readerId: {
          bookId: input.bookId,
          readerId: input.readerId,
        },
      },
      update: {
        lastOpenedAt: now,
        totalReadSeconds: { increment: secondsDelta },
        furthestProgressPercent: { set: nextBookProgress },
        lastChapterId: input.chapterId,
        isCompleted: Boolean(existingBookStat?.isCompleted) || completed,
      },
      create: {
        bookId: input.bookId,
        readerId: input.readerId,
        firstOpenedAt: now,
        lastOpenedAt: now,
        totalReadSeconds: secondsDelta,
        furthestProgressPercent: nextBookProgress,
        lastChapterId: input.chapterId,
        isCompleted: completed,
      },
    })

    await tx.chapterReaderStat.upsert({
      where: {
        chapterId_readerId: {
          chapterId: input.chapterId,
          readerId: input.readerId,
        },
      },
      update: {
        lastOpenedAt: now,
        totalReadSeconds: { increment: secondsDelta },
        furthestProgressPercent: { set: nextChapterProgress },
        isCompleted: Boolean(existingChapterStat?.isCompleted) || completed,
      },
      create: {
        bookId: input.bookId,
        chapterId: input.chapterId,
        readerId: input.readerId,
        firstOpenedAt: now,
        lastOpenedAt: now,
        totalReadSeconds: secondsDelta,
        furthestProgressPercent: nextChapterProgress,
        isCompleted: completed,
      },
    })

    const chapterCompletionCount = await tx.chapterReaderStat.count({
      where: {
        bookId: input.bookId,
        readerId: input.readerId,
        isCompleted: true,
      },
    })

    await tx.bookReaderStat.update({
      where: {
        bookId_readerId: {
          bookId: input.bookId,
          readerId: input.readerId,
        },
      },
      data: {
        furthestProgressPercent: nextBookProgress,
        completedChaptersCount: chapterCompletionCount,
        isCompleted: Boolean(existingBookStat?.isCompleted) || completed,
      },
    })

    await tx.chapterReaderStat.update({
      where: {
        chapterId_readerId: {
          chapterId: input.chapterId,
          readerId: input.readerId,
        },
      },
      data: {
        furthestProgressPercent: nextChapterProgress,
        isCompleted: Boolean(existingChapterStat?.isCompleted) || completed,
      },
    })
  })
}

function toBookStatsSummary(
  aggregate: BookStatAggregateRow,
  completions: CompletionAggregateRow[],
): BookStatsSummary {
  const uniqueReaders = aggregate._count._all
  const completionCount = completions.find((entry) => entry.isCompleted)?._count._all ?? 0

  return {
    uniqueReaders,
    totalReadSeconds: aggregate._sum.totalReadSeconds ?? 0,
    avgReadSeconds: Math.round(aggregate._avg.totalReadSeconds ?? 0),
    avgProgressPercent: formatPercent(aggregate._avg.furthestProgressPercent),
    completionRatePercent: uniqueReaders > 0 ? Math.round((completionCount / uniqueReaders) * 100) : 0,
  }
}

/**
 * Builds the aggregated analytics payload for a single book.
 *
 * @param client Prisma client.
 * @param bookId Target book id.
 * @returns Admin-oriented book and chapter analytics.
 */
export async function getAdminBookStats(
  client: PrismaClient,
  bookId: string,
): Promise<AdminBookStatsResponse> {
  const [
    bookAggregate,
    bookCompletions,
    chapterAggregates,
    chapterCompletions,
    chapters,
  ] = await Promise.all([
    client.bookReaderStat.aggregate({
      where: { bookId },
      _count: { _all: true },
      _avg: {
        totalReadSeconds: true,
        furthestProgressPercent: true,
      },
      _sum: {
        totalReadSeconds: true,
      },
    }),
    client.bookReaderStat.groupBy({
      by: ['isCompleted'],
      where: { bookId },
      _count: { _all: true },
    }),
    client.chapterReaderStat.groupBy({
      by: ['chapterId'],
      where: { bookId },
      _count: { _all: true },
      _avg: {
        furthestProgressPercent: true,
      },
      _sum: {
        totalReadSeconds: true,
      },
    }),
    client.chapterReaderStat.groupBy({
      by: ['chapterId', 'isCompleted'],
      where: { bookId },
      _count: { _all: true },
    }),
    client.chapter.findMany({
      where: { bookId },
      orderBy: { position: 'asc' },
      select: {
        id: true,
        title: true,
        position: true,
      },
    }),
  ])

  const completionCountsByChapterId = new Map<string, number>()
  for (const completionRow of chapterCompletions) {
    if (completionRow.isCompleted) {
      completionCountsByChapterId.set(completionRow.chapterId, completionRow._count._all)
    }
  }

  const chapterAggregateById = new Map(
    chapterAggregates.map((row) => [row.chapterId, row] as const),
  )

  const chapterSummaries = chapters.map((chapter) => {
    const aggregate = chapterAggregateById.get(chapter.id)
    const uniqueReaders = aggregate?._count._all ?? 0
    const completionCount = completionCountsByChapterId.get(chapter.id) ?? 0

    return {
      chapterId: chapter.id,
      title: chapter.title,
      position: chapter.position,
      uniqueReaders,
      totalReadSeconds: aggregate?._sum.totalReadSeconds ?? 0,
      avgProgressPercent: formatPercent(aggregate?._avg.furthestProgressPercent),
      completionRatePercent: uniqueReaders > 0 ? Math.round((completionCount / uniqueReaders) * 100) : 0,
    }
  })

  const topChapters = [...chapterSummaries]
    .sort((left, right) => (
      right.uniqueReaders - left.uniqueReaders ||
      right.totalReadSeconds - left.totalReadSeconds ||
      left.position - right.position
    ))
    .slice(0, 3)

  return {
    book: toBookStatsSummary(bookAggregate as BookStatAggregateRow, bookCompletions as CompletionAggregateRow[]),
    chapters: chapterSummaries,
    topChapters,
  }
}
