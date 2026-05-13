import type { ReaderComment } from '../components/reader/comment-types.ts'
import type { FeedSectionData, ReaderChapterListItem } from '../components/reader/feed-types.ts'
import {
  annotationKindLabel,
  sortCommentsByTop,
  sortItemsByCreatedAt,
  type UnifiedAnnotationItem,
} from './annotations.ts'
import type {
  OfflineBookListItem,
  OfflineBookQuoteRecord,
  OfflineBookRecord,
  OfflineChapterRecord,
  OfflineFeedResponse,
  OfflineProgressRecord,
  OfflineSyncState,
  PendingOfflineAction,
  ReaderBootstrapData,
} from './offline-types.ts'
import {
  buildPureOfflineFeedWindow,
  pickLatestByUpdatedAt,
  summarizePureOfflineBook,
} from './offline-pure.ts'

function resolveVariant(
  chapter: OfflineChapterRecord,
  requestedVariant: string,
): OfflineChapterRecord['variants'][number] | null {
  return chapter.variants.find((variant) => variant.variantType === requestedVariant)
    || chapter.variants.find((variant) => variant.variantType === 'original')
    || chapter.variants[0]
    || null
}

export function buildOfflineBookKey(authorSlug: string, bookSlug: string): string {
  return `${authorSlug}::${bookSlug}`
}

export function buildReaderBootstrapData(record: OfflineBookRecord): ReaderBootstrapData {
  return {
    book: {
      ...record.book,
      chapters: record.chapterList,
    },
    variantPresets: record.variantPresets,
    serverProgress: record.serverProgress,
  }
}

export function buildOfflineBookData(record: OfflineBookRecord): ReaderBootstrapData['book'] {
  return buildReaderBootstrapData(record).book
}

export function buildOfflineFeedWindow(
  record: OfflineBookRecord,
  anchorChapterId: string,
  requestedVariant: string,
  before: number,
  after: number,
): OfflineFeedResponse | null {
  const result = buildPureOfflineFeedWindow(record, anchorChapterId, before, after, (chapter) => (
    buildOfflineSection(record, chapter.id, requestedVariant)
  ))

  if (!result) {
    return null
  }

  return {
    ...result,
    variantPresets: record.variantPresets,
  }
}

export function buildOfflineSection(
  record: OfflineBookRecord,
  chapterId: string,
  requestedVariant: string,
): FeedSectionData | null {
  const chapter = record.chapters.find((entry) => entry.id === chapterId)
  if (!chapter) {
    return null
  }

  const variant = resolveVariant(chapter, requestedVariant)
  if (!variant) {
    return null
  }

  return {
    chapter: {
      id: chapter.id,
      title: chapter.title,
      position: chapter.position,
      level: chapter.level,
      variants: chapter.variants.map((entry) => ({
        id: entry.id,
        variantType: entry.variantType,
      })),
    },
    variant,
    bibliographyItemsByNumber: chapter.bibliographyItemsByNumber,
    preview: chapter.preview,
    commentsPreview: chapter.commentsPreview,
    commentCount: chapter.commentCount,
    prevChapterId: chapter.prevChapterId,
    nextChapterId: chapter.nextChapterId,
  }
}

export function buildOfflineComments(
  record: OfflineBookRecord,
  chapterId?: string,
): ReaderComment[] {
  if (!chapterId) {
    return sortCommentsByTop(record.chapters.flatMap((chapter) => chapter.commentsPreview))
  }

  const chapter = record.chapters.find((entry) => entry.id === chapterId)
  return chapter ? sortCommentsByTop(chapter.commentsPreview) : []
}

export function buildOfflineQuotes(record: OfflineBookRecord): OfflineBookQuoteRecord[] {
  return [...record.bookQuotes].sort((a, b) => {
    if (b.upvoteCount !== a.upvoteCount) return b.upvoteCount - a.upvoteCount
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  })
}

export function buildOfflineAnnotations(
  record: OfflineBookRecord,
  params: {
    readerId?: string | null
    chapterId?: string | null
    kind?: UnifiedAnnotationItem['kind'] | null
  },
): UnifiedAnnotationItem[] {
  const { readerId, chapterId, kind } = params

  return sortItemsByCreatedAt(
    record.readerAnnotations.filter((annotation) => {
      if (readerId && annotation.readerId !== readerId) return false
      if (chapterId && annotation.chapterId !== chapterId) return false
      if (kind && annotation.kind !== kind) return false
      return true
    }),
  )
}

export function mergeProgressRecords(
  localProgress: OfflineProgressRecord | null,
  serverProgress: OfflineProgressRecord | null,
): OfflineProgressRecord | null {
  return pickLatestByUpdatedAt(localProgress, serverProgress)
}

export function summarizeOfflineBook(
  record: OfflineBookRecord,
  actions: PendingOfflineAction[],
  syncState: OfflineSyncState | null,
): OfflineBookListItem {
  const bookActions = actions.filter((action) => action.bookId === record.book.id)
  const pendingActions = syncState?.pendingActions ?? bookActions.filter((action) => action.status !== 'failed').length
  const failedActions = syncState?.failedActions ?? bookActions.filter((action) => action.status === 'failed').length

  return summarizePureOfflineBook({
    record,
    pendingActions,
    failedActions,
  })
}

export function buildOfflineCatalogBooks(records: OfflineBookRecord[]): Array<{
  id: string
  slug: string
  title: string
  description: string | null
  coverUrl: string | null
  author: {
    id: string
    slug: string
    name: string
  }
  _count: {
    chapters: number
    comments: number
  }
}> {
  return records
    .map((record) => ({
      id: record.book.id,
      slug: record.book.slug,
      title: record.book.title,
      description: record.book.description,
      coverUrl: record.book.coverUrl,
      author: {
        id: record.book.author.slug,
        slug: record.book.author.slug,
        name: record.book.author.name,
      },
      _count: {
        chapters: record.chapterList.length,
        comments: record.chapters.reduce((sum, chapter) => sum + chapter.commentCount, 0),
      },
    }))
    .sort((a, b) => a.title.localeCompare(b.title, 'ru'))
}

export function buildOfflineAuthorBooks(
  records: OfflineBookRecord[],
  authorSlug: string,
): Array<{
  id: string
  slug: string
  title: string
  description: string | null
  coverUrl: string | null
  createdAt: string
  author: { slug: string; name: string }
  _count: { chapters: number; comments: number }
}> {
  return records
    .filter((record) => record.book.author.slug === authorSlug)
    .map((record) => ({
      id: record.book.id,
      slug: record.book.slug,
      title: record.book.title,
      description: record.book.description,
      coverUrl: record.book.coverUrl,
      createdAt: record.downloadedAt,
      author: {
        slug: record.book.author.slug,
        name: record.book.author.name,
      },
      _count: {
        chapters: record.chapterList.length,
        comments: record.chapters.reduce((sum, chapter) => sum + chapter.commentCount, 0),
      },
    }))
    .sort((a, b) => a.title.localeCompare(b.title, 'ru'))
}

export function buildOfflineReaderAnnotations(records: OfflineBookRecord[]): UnifiedAnnotationItem[] {
  return sortItemsByCreatedAt(records.flatMap((record) => record.readerAnnotations))
}

export function formatOfflineByteSize(size: number): string {
  if (size < 1024) return `${size} B`
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`
  return `${(size / (1024 * 1024)).toFixed(1)} MB`
}

export function buildPendingCommentMetaLabel(comment: ReaderComment): string | null {
  if (comment.syncStatus === 'pending') return 'Синхронизируется'
  if (comment.syncStatus === 'failed') return 'Ошибка синка'
  return null
}

export function createOfflineAnnotation(params: {
  id: string
  kind: UnifiedAnnotationItem['kind']
  bookId: string
  chapterId: string
  chapterTitle: string
  chapterPosition: number
  chapterVariantId: string | null
  variantType: string
  readerId: string
  username: string
  body?: string | null
  emoji?: string | null
  selectedText?: string | null
  paragraphId?: string | null
  endParagraphId?: string | null
  startOffset?: number
  endOffset?: number
  syncStatus?: UnifiedAnnotationItem['syncStatus']
  offlineOperationId?: string | null
  syncError?: string | null
}): UnifiedAnnotationItem {
  return {
    id: params.id,
    kind: params.kind,
    kindLabel: annotationKindLabel(params.kind),
    createdAt: new Date().toISOString(),
    bookId: params.bookId,
    chapterId: params.chapterId,
    chapterTitle: params.chapterTitle,
    chapterPosition: params.chapterPosition,
    chapterVariantId: params.chapterVariantId,
    variantType: params.variantType,
    readerId: params.readerId,
    username: params.username,
    body: params.body ?? null,
    emoji: params.emoji ?? null,
    isSynthetic: false,
    selectedText: params.selectedText ?? null,
    paragraphId: params.paragraphId ?? null,
    endParagraphId: params.endParagraphId ?? null,
    startOffset: params.startOffset ?? 0,
    endOffset: params.endOffset ?? 0,
    syncStatus: params.syncStatus ?? 'pending',
    offlineOperationId: params.offlineOperationId ?? null,
    syncError: params.syncError ?? null,
  }
}

export function cloneOfflineBookRecord(record: OfflineBookRecord): OfflineBookRecord {
  return JSON.parse(JSON.stringify(record)) as OfflineBookRecord
}

export function findChapterListItem(chapters: ReaderChapterListItem[], chapterId: string): ReaderChapterListItem | null {
  return chapters.find((chapter) => chapter.id === chapterId) || null
}
