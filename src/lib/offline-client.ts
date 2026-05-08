'use client'

import { sortCommentsByTop } from '@/lib/annotations'
import {
  addOfflineAction,
  deleteOfflineAction,
  deleteOfflineActionsForBook,
  deleteOfflineBook,
  deleteOfflineProgressForBook,
  deleteOfflineSyncState,
  getOfflineBook,
  getOfflineBookByKey,
  getOfflineProgress,
  getOfflineSyncState,
  listOfflineActions,
  listOfflineBooks,
  listOfflineSyncStates,
  putOfflineBook,
  putOfflineProgress,
  putOfflineSyncState,
  updateOfflineAction,
} from '@/lib/offline-db'
import {
  buildOfflineAnnotations,
  buildOfflineAuthorBooks,
  buildOfflineBookKey,
  buildOfflineCatalogBooks,
  buildOfflineComments,
  buildOfflineFeedWindow,
  buildOfflineQuotes,
  buildOfflineReaderAnnotations,
  buildOfflineSection,
  cloneOfflineBookRecord,
  createOfflineAnnotation,
  mergeProgressRecords,
  summarizeOfflineBook,
} from '@/lib/offline-helpers'
import type { ReaderComment } from '@/components/reader/comment-types'
import type { UnifiedAnnotationItem } from '@/lib/annotations'
import type {
  OfflineAnnotationPayload,
  OfflineBookListItem,
  OfflineBookQuoteRecord,
  OfflineBookRecord,
  OfflineCommentPayload,
  OfflineFeedResponse,
  OfflineProgressRecord,
  OfflineSyncState,
  PendingOfflineAction,
} from '@/lib/offline-types'

const OFFLINE_EVENT = 'bookstream:offline-updated'
const COVER_CACHE = 'bookstream-covers-v1'
const RUNTIME_CACHE = 'bookstream-runtime-v1'
let syncInFlight: Promise<void> | null = null

type DownloadPayload = Omit<OfflineBookRecord, 'key' | 'estimatedSizeBytes'>

function hasWindow(): boolean {
  return typeof window !== 'undefined'
}

function buildEstimatedSizeBytes<T>(value: T): number {
  return new TextEncoder().encode(JSON.stringify(value)).length
}

function buildTempId(prefix: string): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `${prefix}-${crypto.randomUUID()}`
  }

  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`
}

function dispatchOfflineEvent(bookId?: string): void {
  if (!hasWindow()) return

  window.dispatchEvent(new CustomEvent(OFFLINE_EVENT, {
    detail: {
      bookId: bookId || null,
    },
  }))
}

async function cacheUrl(cacheName: string, url: string | null | undefined): Promise<void> {
  if (!url || !hasWindow() || !('caches' in window)) {
    return
  }

  try {
    const cache = await window.caches.open(cacheName)
    const response = await fetch(url, { cache: 'reload' })
    if (response.ok) {
      await cache.put(url, response.clone())
    }
  } catch (error) {
    console.error('Failed to cache offline asset:', error)
  }
}

function updateQuoteVoteSnapshot(record: OfflineBookRecord, quoteId: string): OfflineBookRecord {
  record.bookQuotes = record.bookQuotes.map((quote) => (
    quote.id === quoteId
      ? {
          ...quote,
          reacted: !quote.reacted,
          upvoteCount: quote.reacted ? Math.max(0, quote.upvoteCount - 1) : quote.upvoteCount + 1,
        }
      : quote
  ))

  for (const chapter of record.chapters) {
    chapter.preview.quotesPreview = chapter.preview.quotesPreview.map((quote) => (
      quote.id === quoteId
        ? {
            ...quote,
            reacted: !quote.reacted,
            upvoteCount: quote.reacted ? Math.max(0, quote.upvoteCount - 1) : quote.upvoteCount + 1,
          }
        : quote
    ))

    if (chapter.preview.stats.topQuote?.id === quoteId) {
      const topQuote = chapter.preview.stats.topQuote
      chapter.preview.stats.topQuote = {
        ...topQuote,
        reacted: !topQuote.reacted,
        upvoteCount: topQuote.reacted ? Math.max(0, topQuote.upvoteCount - 1) : topQuote.upvoteCount + 1,
      }
    }
  }

  return record
}

async function updateSyncState(bookId: string): Promise<void> {
  const actions = (await listOfflineActions()).filter((action) => action.bookId === bookId)
  const current = await getOfflineSyncState(bookId)
  const state: OfflineSyncState = {
    bookId,
    lastSyncAt: current?.lastSyncAt || null,
    pendingActions: actions.filter((action) => action.status !== 'failed').length,
    failedActions: actions.filter((action) => action.status === 'failed').length,
    syncing: current?.syncing || false,
  }

  await putOfflineSyncState(state)
}

async function updateBookRecord(
  bookId: string,
  updater: (record: OfflineBookRecord) => OfflineBookRecord,
): Promise<OfflineBookRecord | null> {
  const record = await getOfflineBook(bookId)
  if (!record) {
    return null
  }

  const nextRecord = updater(cloneOfflineBookRecord(record))
  nextRecord.estimatedSizeBytes = buildEstimatedSizeBytes(nextRecord)
  await putOfflineBook(nextRecord)
  dispatchOfflineEvent(bookId)
  return nextRecord
}

function findAnnotationIndex(
  annotations: UnifiedAnnotationItem[],
  payload: OfflineAnnotationPayload,
): number {
  return annotations.findIndex((annotation) => (
    annotation.kind === payload.kind
    && annotation.chapterId === payload.chapterId
    && annotation.chapterVariantId === payload.chapterVariantId
    && annotation.paragraphId === payload.selection.paragraphId
    && annotation.endParagraphId === payload.selection.endParagraphId
    && annotation.startOffset === payload.selection.startOffset
    && annotation.endOffset === payload.selection.endOffset
    && annotation.emoji === (payload.emoji ?? null)
  ))
}

function prependComment(chapterComments: ReaderComment[], comment: ReaderComment): ReaderComment[] {
  return sortCommentsByTop([comment, ...chapterComments.filter((entry) => entry.id !== comment.id)])
}

function createOfflineCommentFromPayload(
  chapter: OfflineBookRecord['chapters'][number],
  payload: OfflineCommentPayload & { localCommentId: string },
  operationId: string,
): ReaderComment {
  const quote = payload.quotes?.[0]

  return {
    id: payload.localCommentId,
    bookId: payload.bookId,
    chapterId: payload.chapterId,
    chapterTitle: chapter.title,
    chapterPosition: chapter.position,
    chapterVariantId: quote?.chapterVariantId ?? null,
    variantType: quote?.variantType ?? 'original',
    readerId: payload.readerId,
    username: payload.username,
    body: payload.body,
    createdAt: new Date().toISOString(),
    selectedText: quote?.selectedText ?? null,
    paragraphId: quote?.paragraphId ?? null,
    endParagraphId: quote?.endParagraphId ?? null,
    startOffset: quote?.startOffset ?? 0,
    endOffset: quote?.endOffset ?? 0,
    upvoteCount: 0,
    reacted: false,
    quotes: quote?.selectedText && quote.paragraphId ? [{
      id: `${payload.localCommentId}:quote`,
      variantType: quote.variantType,
      selectedText: quote.selectedText,
      paragraphId: quote.paragraphId,
      endParagraphId: quote.endParagraphId ?? null,
    }] : [],
    syncStatus: 'pending',
    offlineOperationId: operationId,
    syncError: null,
  }
}

async function markActionFailed(
  action: PendingOfflineAction,
  errorMessage: string,
): Promise<void> {
  const failedAction: PendingOfflineAction = {
    ...action,
    status: 'failed',
    error: errorMessage,
    retryCount: action.retryCount + 1,
  }
  await updateOfflineAction(failedAction)

  if (action.type === 'comment') {
    await updateBookRecord(action.bookId, (record) => {
      const chapter = record.chapters.find((entry) => entry.id === action.chapterId)
      if (chapter) {
        chapter.commentsPreview = chapter.commentsPreview.map((comment) => (
          comment.id === action.payload.localCommentId
            ? { ...comment, syncStatus: 'failed', syncError: errorMessage }
            : comment
        ))
      }
      record.readerAnnotations = record.readerAnnotations.map((annotation) => (
        annotation.offlineOperationId === action.operationId
          ? { ...annotation, syncStatus: 'failed', syncError: errorMessage }
          : annotation
      ))
      return record
    })
  }

  if (action.type === 'quote' || action.type === 'reaction') {
    await updateBookRecord(action.bookId, (record) => {
      record.readerAnnotations = record.readerAnnotations.map((annotation) => (
        annotation.id === action.payload.localAnnotationId
          ? { ...annotation, syncStatus: 'failed', syncError: errorMessage }
          : annotation
      ))
      return record
    })
  }

  await updateSyncState(action.bookId)
}

function isRetriableStatus(status: number): boolean {
  return status >= 500 || status === 429
}

async function syncProgressAction(action: Extract<PendingOfflineAction, { type: 'progress' }>): Promise<void> {
  const response = await fetch('/api/progress', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(action.payload),
  })

  if (!response.ok) {
    throw new Error(`progress:${response.status}`)
  }

  await deleteOfflineAction(action.operationId)
  await updateSyncState(action.bookId)
}

async function syncCommentAction(action: Extract<PendingOfflineAction, { type: 'comment' }>): Promise<void> {
  const response = await fetch(`/api/chapters/${action.payload.chapterId}/comments`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      readerId: action.payload.readerId,
      username: action.payload.username,
      body: action.payload.body,
      bookId: action.payload.bookId,
      quotes: action.payload.quotes,
    }),
  })

  if (!response.ok) {
    throw new Error(`comment:${response.status}`)
  }

  const data = await response.json() as { comment?: ReaderComment }
  const syncedComment = data.comment
  if (syncedComment) {
    await updateBookRecord(action.bookId, (record) => {
      const chapter = record.chapters.find((entry) => entry.id === action.chapterId)
      if (chapter) {
        chapter.commentsPreview = prependComment(
          chapter.commentsPreview.filter((comment) => comment.id !== action.payload.localCommentId),
          {
            ...syncedComment,
            syncStatus: 'synced',
            offlineOperationId: null,
            syncError: null,
          },
        )
        chapter.commentCount = Math.max(chapter.commentCount, chapter.commentsPreview.length)
        chapter.preview.leadComment = chapter.commentsPreview[0] || null
        chapter.preview.freshComments = chapter.commentsPreview.slice(1, 4)
        chapter.preview.stats.commentsCount = Math.max(chapter.preview.stats.commentsCount, chapter.commentCount)
      }

      record.readerAnnotations = record.readerAnnotations.map((annotation) => (
        annotation.offlineOperationId === action.operationId && annotation.kind === 'comment'
          ? {
              ...annotation,
              id: syncedComment.id,
              createdAt: syncedComment.createdAt,
              syncStatus: 'synced',
              offlineOperationId: null,
              syncError: null,
            }
          : annotation
      ))

      return record
    })
  }

  await deleteOfflineAction(action.operationId)
  await updateSyncState(action.bookId)
}

async function syncAnnotationAction(
  action: Extract<PendingOfflineAction, { type: 'quote' | 'reaction' }>,
): Promise<void> {
  const response = await fetch('/api/annotations', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      kind: action.payload.kind,
      bookId: action.payload.bookId,
      chapterId: action.payload.chapterId,
      chapterVariantId: action.payload.chapterVariantId,
      variantType: action.payload.variantType,
      readerId: action.payload.readerId,
      username: action.payload.username,
      emoji: action.payload.emoji ?? null,
      selection: action.payload.selection,
    }),
  })

  if (!response.ok) {
    throw new Error(`annotation:${response.status}`)
  }

  const data = await response.json() as {
    action?: 'added' | 'removed'
    annotation?: {
      id: string
      createdAt?: string
    }
  }

  if (action.payload.toggleAction === 'add' && data.annotation?.id) {
    await updateBookRecord(action.bookId, (record) => {
      record.readerAnnotations = record.readerAnnotations.map((annotation) => (
        annotation.id === action.payload.localAnnotationId
          ? {
              ...annotation,
              id: data.annotation?.id || annotation.id,
              syncStatus: 'synced',
              offlineOperationId: null,
              syncError: null,
            }
          : annotation
      ))
      return record
    })
  }

  await deleteOfflineAction(action.operationId)
  await updateSyncState(action.bookId)
}

async function syncVoteAction(action: Extract<PendingOfflineAction, { type: 'annotation-vote' }>): Promise<void> {
  const response = await fetch(`/api/annotations/${action.payload.annotationId}/vote`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      readerId: action.payload.readerId,
    }),
  })

  if (!response.ok) {
    throw new Error(`vote:${response.status}`)
  }

  await deleteOfflineAction(action.operationId)
  await updateSyncState(action.bookId)
}

async function syncSingleAction(action: PendingOfflineAction): Promise<void> {
  const syncingAction = {
    ...action,
    status: 'syncing' as const,
    error: null,
  }
  await updateOfflineAction(syncingAction)
  await putOfflineSyncState({
    bookId: action.bookId,
    lastSyncAt: (await getOfflineSyncState(action.bookId))?.lastSyncAt || null,
    pendingActions: 0,
    failedActions: 0,
    syncing: true,
  })

  try {
    switch (action.type) {
      case 'progress':
        await syncProgressAction(syncingAction as Extract<PendingOfflineAction, { type: 'progress' }>)
        break
      case 'comment':
        await syncCommentAction(syncingAction as Extract<PendingOfflineAction, { type: 'comment' }>)
        break
      case 'quote':
      case 'reaction':
        await syncAnnotationAction(syncingAction as Extract<PendingOfflineAction, { type: 'quote' | 'reaction' }>)
        break
      case 'annotation-vote':
        await syncVoteAction(syncingAction as Extract<PendingOfflineAction, { type: 'annotation-vote' }>)
        break
    }

    await putOfflineSyncState({
      bookId: action.bookId,
      lastSyncAt: new Date().toISOString(),
      pendingActions: 0,
      failedActions: 0,
      syncing: false,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'offline_sync_failed'
    const statusPart = message.split(':')[1]
    const status = statusPart ? Number.parseInt(statusPart, 10) : NaN

    if (Number.isFinite(status) && !isRetriableStatus(status)) {
      await markActionFailed(syncingAction, message)
    } else {
      await updateOfflineAction({
        ...syncingAction,
        status: 'pending',
        error: message,
        retryCount: syncingAction.retryCount + 1,
      })
      await updateSyncState(syncingAction.bookId)
    }
  }
}

function ensureOnline(): void {
  if (hasWindow() && navigator.onLine === false) {
    throw new Error('offline')
  }
}

export function subscribeOfflineUpdates(handler: () => void): () => void {
  if (!hasWindow()) {
    return () => {}
  }

  const wrapped = () => handler()
  window.addEventListener(OFFLINE_EVENT, wrapped)
  return () => window.removeEventListener(OFFLINE_EVENT, wrapped)
}

export async function downloadBook(bookId: string, readerId: string): Promise<OfflineBookRecord> {
  const response = await fetch(`/api/books/${bookId}/offline-package?readerId=${readerId}`)
  if (!response.ok) {
    throw new Error('offline_package_failed')
  }

  const payload = await response.json() as DownloadPayload
  const record: OfflineBookRecord = {
    ...payload,
    key: buildOfflineBookKey(payload.book.author.slug, payload.book.slug),
    estimatedSizeBytes: 0,
  }
  record.estimatedSizeBytes = buildEstimatedSizeBytes(record)

  await putOfflineBook(record)
  if (record.serverProgress) {
    await putOfflineProgress(record.serverProgress)
  }
  await updateSyncState(bookId)
  await cacheUrl(COVER_CACHE, record.book.coverUrl)
  await cacheUrl(RUNTIME_CACHE, '/')
  await cacheUrl(RUNTIME_CACHE, `/${record.book.author.slug}`)
  await cacheUrl(RUNTIME_CACHE, `/${record.book.author.slug}/${record.book.slug}`)
  await cacheUrl(RUNTIME_CACHE, `/${record.book.author.slug}/${record.book.slug}/read`)
  await cacheUrl(RUNTIME_CACHE, '/me/offline')
  await cacheUrl(RUNTIME_CACHE, '/me/annotations')
  dispatchOfflineEvent(bookId)
  return record
}

export async function refreshDownloadedBook(bookId: string, readerId: string): Promise<OfflineBookRecord> {
  return await downloadBook(bookId, readerId)
}

export async function removeDownloadedBook(bookId: string): Promise<void> {
  await deleteOfflineBook(bookId)
  await deleteOfflineProgressForBook(bookId)
  await deleteOfflineActionsForBook(bookId)
  await deleteOfflineSyncState(bookId)
  dispatchOfflineEvent(bookId)
}

export async function getDownloadedBooks(): Promise<OfflineBookListItem[]> {
  const [books, actions, syncStates] = await Promise.all([
    listOfflineBooks(),
    listOfflineActions(),
    listOfflineSyncStates(),
  ])
  const syncStateByBookId = new Map(syncStates.map((state) => [state.bookId, state]))

  return books
    .map((record) => summarizeOfflineBook(record, actions, syncStateByBookId.get(record.book.id) || null))
    .sort((a, b) => new Date(b.downloadedAt).getTime() - new Date(a.downloadedAt).getTime())
}

export async function getOfflineCatalogBooks(): Promise<ReturnType<typeof buildOfflineCatalogBooks>> {
  const books = await listOfflineBooks()
  return buildOfflineCatalogBooks(books)
}

export async function getOfflineAuthorBooks(authorSlug: string): Promise<ReturnType<typeof buildOfflineAuthorBooks>> {
  const books = await listOfflineBooks()
  return buildOfflineAuthorBooks(books, authorSlug)
}

export async function getAllOfflineReaderAnnotations(): Promise<UnifiedAnnotationItem[]> {
  const books = await listOfflineBooks()
  return buildOfflineReaderAnnotations(books)
}

export async function getOfflineBookBySlugs(authorSlug: string, bookSlug: string): Promise<OfflineBookRecord | null> {
  return await getOfflineBookByKey(buildOfflineBookKey(authorSlug, bookSlug))
}

export async function getOfflineBookRecord(bookId: string): Promise<OfflineBookRecord | null> {
  return await getOfflineBook(bookId)
}

export async function getOfflineFeedWindow(
  bookId: string,
  anchorChapterId: string,
  variantType: string,
  before: number,
  after: number,
): Promise<OfflineFeedResponse | null> {
  const record = await getOfflineBook(bookId)
  if (!record) return null
  return buildOfflineFeedWindow(record, anchorChapterId, variantType, before, after)
}

export async function getOfflineChapterSection(
  bookId: string,
  chapterId: string,
  variantType: string,
): Promise<ReturnType<typeof buildOfflineSection>> {
  const record = await getOfflineBook(bookId)
  if (!record) return null
  return buildOfflineSection(record, chapterId, variantType)
}

export async function getOfflineComments(
  bookId: string,
  chapterId?: string,
): Promise<ReaderComment[]> {
  const record = await getOfflineBook(bookId)
  if (!record) return []
  return buildOfflineComments(record, chapterId)
}

export async function getOfflineQuotes(bookId: string): Promise<OfflineBookQuoteRecord[]> {
  const record = await getOfflineBook(bookId)
  if (!record) return []
  return buildOfflineQuotes(record)
}

export async function getOfflineAnnotations(params: {
  bookId: string
  readerId?: string | null
  chapterId?: string | null
  kind?: UnifiedAnnotationItem['kind'] | null
}): Promise<UnifiedAnnotationItem[]> {
  const record = await getOfflineBook(params.bookId)
  if (!record) return []
  return buildOfflineAnnotations(record, {
    readerId: params.readerId,
    chapterId: params.chapterId,
    kind: params.kind,
  })
}

export async function getEffectiveOfflineProgress(
  bookId: string,
  readerId: string,
  serverProgress: OfflineProgressRecord | null,
): Promise<OfflineProgressRecord | null> {
  const localProgress = await getOfflineProgress(bookId, readerId)
  return mergeProgressRecords(localProgress, serverProgress)
}

export async function saveProgressUpdate(progress: OfflineProgressRecord): Promise<void> {
  await putOfflineProgress(progress)
  const operationId = `progress:${progress.bookId}:${progress.readerId}`
  await updateOfflineAction({
    operationId,
    type: 'progress',
    readerId: progress.readerId,
    bookId: progress.bookId,
    chapterId: progress.chapterId,
    createdAt: new Date().toISOString(),
    retryCount: 0,
    status: 'pending',
    error: null,
    payload: progress,
  })
  await updateSyncState(progress.bookId)
  dispatchOfflineEvent(progress.bookId)

  if (!hasWindow() || navigator.onLine !== false) {
    void syncOfflineQueue()
  }
}

export async function queueOfflineComment(payload: OfflineCommentPayload): Promise<ReaderComment> {
  const record = await getOfflineBook(payload.bookId)
  if (!record) {
    throw new Error('offline_book_missing')
  }

  const chapter = record.chapters.find((entry) => entry.id === payload.chapterId)
  if (!chapter) {
    throw new Error('offline_chapter_missing')
  }

  const cooldownLimit = Date.now() - 15_000
  const recentOwnComment = chapter.commentsPreview.find((comment) => (
    comment.readerId === payload.readerId
    && new Date(comment.createdAt).getTime() >= cooldownLimit
  ))
  if (recentOwnComment) {
    throw new Error('comment_cooldown')
  }

  const operationId = buildTempId('comment-op')
  const localCommentId = buildTempId('comment')
  const queuedPayload = {
    ...payload,
    localCommentId,
  }
  const comment = createOfflineCommentFromPayload(chapter, queuedPayload, operationId)

  await updateBookRecord(payload.bookId, (nextRecord) => {
    const targetChapter = nextRecord.chapters.find((entry) => entry.id === payload.chapterId)
    if (!targetChapter) return nextRecord

    targetChapter.commentsPreview = prependComment(targetChapter.commentsPreview, comment)
    targetChapter.commentCount += 1
    targetChapter.preview.leadComment = targetChapter.commentsPreview[0] || null
    targetChapter.preview.freshComments = targetChapter.commentsPreview.slice(1, 4)
    targetChapter.preview.stats.commentsCount += 1
    nextRecord.readerAnnotations.unshift(createOfflineAnnotation({
      id: localCommentId,
      kind: 'comment',
      bookId: payload.bookId,
      chapterId: payload.chapterId,
      chapterTitle: targetChapter.title,
      chapterPosition: targetChapter.position,
      chapterVariantId: payload.quotes?.[0]?.chapterVariantId ?? null,
      variantType: payload.quotes?.[0]?.variantType ?? 'original',
      readerId: payload.readerId,
      username: payload.username,
      body: payload.body,
      selectedText: payload.quotes?.[0]?.selectedText ?? null,
      paragraphId: payload.quotes?.[0]?.paragraphId ?? null,
      endParagraphId: payload.quotes?.[0]?.endParagraphId ?? null,
      startOffset: payload.quotes?.[0]?.startOffset ?? 0,
      endOffset: payload.quotes?.[0]?.endOffset ?? 0,
      offlineOperationId: operationId,
    }))
    return nextRecord
  })

  await addOfflineAction({
    operationId,
    type: 'comment',
    readerId: payload.readerId,
    bookId: payload.bookId,
    chapterId: payload.chapterId,
    createdAt: new Date().toISOString(),
    retryCount: 0,
    status: 'pending',
    error: null,
    payload: queuedPayload,
  })
  await updateSyncState(payload.bookId)

  if (!hasWindow() || navigator.onLine !== false) {
    void syncOfflineQueue()
  }

  return comment
}

export async function toggleOfflineAnnotation(payload: OfflineAnnotationPayload): Promise<{
  active: boolean
  annotation: UnifiedAnnotationItem | null
}> {
  const record = await getOfflineBook(payload.bookId)
  if (!record) {
    throw new Error('offline_book_missing')
  }

  const chapter = record.chapters.find((entry) => entry.id === payload.chapterId)
  if (!chapter) {
    throw new Error('offline_chapter_missing')
  }

  const existingIndex = findAnnotationIndex(record.readerAnnotations, payload)
  const existing = existingIndex >= 0 ? record.readerAnnotations[existingIndex] : null

  if (existing) {
    await updateBookRecord(payload.bookId, (nextRecord) => {
      nextRecord.readerAnnotations = nextRecord.readerAnnotations.filter((annotation) => annotation.id !== existing.id)
      return nextRecord
    })

    if (existing.syncStatus === 'pending' && existing.offlineOperationId) {
      await deleteOfflineAction(existing.offlineOperationId)
    } else {
      const operationId = buildTempId(`${payload.kind}-remove-op`)
      await addOfflineAction({
        operationId,
        type: payload.kind,
        readerId: payload.readerId,
        bookId: payload.bookId,
        chapterId: payload.chapterId,
        createdAt: new Date().toISOString(),
        retryCount: 0,
        status: 'pending',
        error: null,
        payload: {
          ...payload,
          toggleAction: 'remove',
          localAnnotationId: existing.id,
        },
      })
    }

    await updateSyncState(payload.bookId)
    if (!hasWindow() || navigator.onLine !== false) {
      void syncOfflineQueue()
    }

    return {
      active: false,
      annotation: existing,
    }
  }

  const operationId = buildTempId(`${payload.kind}-op`)
  const localAnnotationId = buildTempId(payload.kind)
  const annotation = createOfflineAnnotation({
    id: localAnnotationId,
    kind: payload.kind,
    bookId: payload.bookId,
    chapterId: payload.chapterId,
    chapterTitle: chapter.title,
    chapterPosition: chapter.position,
    chapterVariantId: payload.chapterVariantId,
    variantType: payload.variantType,
    readerId: payload.readerId,
    username: payload.username,
    emoji: payload.emoji ?? null,
    selectedText: payload.selection.selectedText,
    paragraphId: payload.selection.paragraphId,
    endParagraphId: payload.selection.endParagraphId,
    startOffset: payload.selection.startOffset,
    endOffset: payload.selection.endOffset,
    offlineOperationId: operationId,
  })

  await updateBookRecord(payload.bookId, (nextRecord) => {
    nextRecord.readerAnnotations.unshift(annotation)
    return nextRecord
  })
  await addOfflineAction({
    operationId,
    type: payload.kind,
    readerId: payload.readerId,
    bookId: payload.bookId,
    chapterId: payload.chapterId,
    createdAt: new Date().toISOString(),
    retryCount: 0,
    status: 'pending',
    error: null,
    payload: {
      ...payload,
      toggleAction: 'add',
      localAnnotationId,
    },
  })
  await updateSyncState(payload.bookId)

  if (!hasWindow() || navigator.onLine !== false) {
    void syncOfflineQueue()
  }

  return {
    active: true,
    annotation,
  }
}

export async function toggleOfflineAnnotationVote(bookId: string, annotationId: string, readerId: string): Promise<void> {
  await updateBookRecord(bookId, (record) => {
    for (const chapter of record.chapters) {
      chapter.commentsPreview = chapter.commentsPreview.map((comment) => (
        comment.id === annotationId
          ? {
              ...comment,
              reacted: !comment.reacted,
              upvoteCount: comment.reacted
                ? Math.max(0, comment.upvoteCount - 1)
                : comment.upvoteCount + 1,
            }
          : comment
      ))
    }
    return record
  })

  await addOfflineAction({
    operationId: buildTempId('vote-op'),
    type: 'annotation-vote',
    readerId,
    bookId,
    chapterId: null,
    createdAt: new Date().toISOString(),
    retryCount: 0,
    status: 'pending',
    error: null,
    payload: {
      annotationId,
      readerId,
    },
  })
  await updateSyncState(bookId)
  if (!hasWindow() || navigator.onLine !== false) {
    void syncOfflineQueue()
  }
}

export async function toggleOfflineQuoteVote(bookId: string, quoteId: string, readerId: string): Promise<void> {
  await updateBookRecord(bookId, (record) => updateQuoteVoteSnapshot(record, quoteId))

  await addOfflineAction({
    operationId: buildTempId('vote-op'),
    type: 'annotation-vote',
    readerId,
    bookId,
    chapterId: null,
    createdAt: new Date().toISOString(),
    retryCount: 0,
    status: 'pending',
    error: null,
    payload: {
      annotationId: quoteId,
      readerId,
    },
  })
  await updateSyncState(bookId)
  if (!hasWindow() || navigator.onLine !== false) {
    void syncOfflineQueue()
  }
}

export async function retryOfflineSync(bookId?: string): Promise<void> {
  const actions = await listOfflineActions()
  for (const action of actions) {
    if (action.status === 'failed' && (!bookId || action.bookId === bookId)) {
      await updateOfflineAction({
        ...action,
        status: 'pending',
        error: null,
      })
    }
  }
  if (!hasWindow() || navigator.onLine !== false) {
    await syncOfflineQueue()
  }
}

export async function syncOfflineQueue(): Promise<void> {
  if (syncInFlight) {
    return await syncInFlight
  }

  syncInFlight = (async () => {
    ensureOnline()
    const actions = await listOfflineActions()
    const actionable = actions
      .filter((action) => action.status !== 'syncing')
      .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())

    for (const action of actionable) {
      await syncSingleAction(action)
    }

    syncInFlight = null
  })()

  try {
    await syncInFlight
  } finally {
    syncInFlight = null
  }
}
