export interface PureOfflineProgressRecord {
  updatedAt: string
}

export interface PureOfflineVariantRecord {
  id: string
  variantType: string
}

export interface PureOfflineChapterRecord {
  id: string
  title: string
  level?: number
  position: number
  prevChapterId: string | null
  nextChapterId: string | null
  variants: PureOfflineVariantRecord[]
  preview: unknown
  commentsPreview: unknown[]
  commentCount: number
}

export interface PureOfflineBookRecord {
  book: {
    id: string
    slug: string
    title: string
    author: {
      slug: string
      name: string
    }
    coverUrl: string | null
  }
  key: string
  chapters: PureOfflineChapterRecord[]
  variantPresets: Record<string, unknown>
  downloadedAt: string
  estimatedSizeBytes: number
}

export interface PureOfflineFeedWindowResult<TSection> {
  sections: TSection[]
  variantPresets?: Record<string, unknown>
  hasPrev: boolean
  hasNext: boolean
}

export function pickLatestByUpdatedAt<T extends PureOfflineProgressRecord | null>(
  localProgress: T,
  serverProgress: T,
): T {
  if (!localProgress) return serverProgress
  if (!serverProgress) return localProgress

  return new Date(localProgress.updatedAt).getTime() >= new Date(serverProgress.updatedAt).getTime()
    ? localProgress
    : serverProgress
}

export function buildPureOfflineFeedWindow<TSection>(
  record: PureOfflineBookRecord,
  anchorChapterId: string,
  before: number,
  after: number,
  buildSection: (chapter: PureOfflineChapterRecord) => TSection | null,
): PureOfflineFeedWindowResult<TSection> | null {
  const anchorIndex = record.chapters.findIndex((chapter) => chapter.id === anchorChapterId)
  if (anchorIndex < 0) {
    return null
  }

  const startIndex = Math.max(0, anchorIndex - before)
  const endIndex = Math.min(record.chapters.length - 1, anchorIndex + after)
  const sections = record.chapters
    .slice(startIndex, endIndex + 1)
    .map((chapter) => buildSection(chapter))
    .filter((section): section is TSection => Boolean(section))

  return {
    sections,
    variantPresets: record.variantPresets,
    hasPrev: startIndex > 0,
    hasNext: endIndex < record.chapters.length - 1,
  }
}

export function summarizePureOfflineBook(params: {
  record: PureOfflineBookRecord
  pendingActions: number
  failedActions: number
}) {
  return {
    bookId: params.record.book.id,
    key: params.record.key,
    title: params.record.book.title,
    slug: params.record.book.slug,
    authorSlug: params.record.book.author.slug,
    authorName: params.record.book.author.name,
    coverUrl: params.record.book.coverUrl,
    downloadedAt: params.record.downloadedAt,
    estimatedSizeBytes: params.record.estimatedSizeBytes,
    pendingActions: params.pendingActions,
    failedActions: params.failedActions,
  }
}
