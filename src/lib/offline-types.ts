import type { ReaderComment } from '../components/reader/comment-types.ts'
import type {
  FeedSectionData,
  FeedSectionPreview,
  ReaderChapterListItem,
  ReaderParagraph,
} from '../components/reader/feed-types.ts'
import type { AnnotationKind, UnifiedAnnotationItem } from './annotations.ts'
import type { ReadingMode, VariantType } from './store.ts'

export interface VariantPresetRecord {
  id: string
  label: string
  emoji: string
  description?: string
  targetSizePercent?: number | null
  position?: number
}

export interface OfflineBookIdentity {
  id: string
  slug: string
  title: string
  description: string | null
  coverUrl: string | null
  readingModeDefault: ReadingMode
  author: {
    slug: string
    name: string
  }
}

export interface OfflineBookQuoteRecord {
  id: string
  text: string
  variantType: string
  variantLabel: string
  chapterId: string
  paragraphId: string
  paragraphEndId?: string | null
  startOffset?: number
  endOffset?: number
  chapterTitle: string
  chapterPosition: number
  username: string
  readerId: string
  createdAt: string
  upvoteCount: number
  reacted: boolean
  commentsCount?: number
  reactionsCount?: number
  syncStatus?: 'synced' | 'pending' | 'failed'
}

export interface OfflineVariantRecord {
  id: string
  variantType: string
  paragraphs: ReaderParagraph[]
}

export interface OfflineChapterRecord {
  id: string
  title: string
  level?: number
  position: number
  prevChapterId: string | null
  nextChapterId: string | null
  variants: OfflineVariantRecord[]
  preview: FeedSectionPreview
  commentsPreview: ReaderComment[]
  commentCount: number
}

export interface OfflineProgressRecord {
  readerId: string
  bookId: string
  chapterId: string
  variantType: VariantType
  scrollPercent: number
  fontSize: number
  lineHeight: number
  readingMode: ReadingMode
  updatedAt: string
}

export interface OfflineBookRecord {
  key: string
  book: OfflineBookIdentity
  chapters: OfflineChapterRecord[]
  chapterList: ReaderChapterListItem[]
  variantPresets: Record<string, VariantPresetRecord>
  bookQuotes: OfflineBookQuoteRecord[]
  readerAnnotations: UnifiedAnnotationItem[]
  serverProgress: OfflineProgressRecord | null
  downloadedAt: string
  estimatedSizeBytes: number
}

export interface OfflineBookListItem {
  bookId: string
  key: string
  title: string
  slug: string
  authorSlug: string
  authorName: string
  coverUrl: string | null
  downloadedAt: string
  estimatedSizeBytes: number
  pendingActions: number
  failedActions: number
}

export interface ReaderBootstrapData {
  book: OfflineBookIdentity & {
    chapters: ReaderChapterListItem[]
  }
  variantPresets: Record<string, VariantPresetRecord>
  serverProgress: OfflineProgressRecord | null
}

export interface OfflineSyncState {
  bookId: string
  lastSyncAt: string | null
  pendingActions: number
  failedActions: number
  syncing: boolean
}

export interface OfflineAnnotationPayload {
  kind: Extract<AnnotationKind, 'quote' | 'reaction'>
  bookId: string
  chapterId: string
  chapterVariantId: string
  variantType: string
  readerId: string
  username: string
  toggleAction: 'add' | 'remove'
  emoji?: string | null
  selection: {
    paragraphId: string
    endParagraphId: string
    selectedText: string
    startOffset: number
    endOffset: number
  }
}

export interface OfflineCommentPayload {
  bookId: string
  chapterId: string
  readerId: string
  username: string
  body: string
  quotes?: Array<{
    chapterVariantId?: string | null
    variantType: string
    paragraphId: string
    endParagraphId?: string | null
    selectedText?: string
    startOffset?: number
    endOffset?: number
  }>
}

export interface OfflineAnnotationVotePayload {
  annotationId: string
  readerId: string
}

export interface PendingOfflineActionBase<TType extends string, TPayload> {
  operationId: string
  type: TType
  readerId: string
  bookId: string
  chapterId: string | null
  createdAt: string
  retryCount: number
  status: 'pending' | 'syncing' | 'failed'
  error: string | null
  payload: TPayload
}

export type PendingOfflineAction =
  | PendingOfflineActionBase<'progress', OfflineProgressRecord>
  | PendingOfflineActionBase<'comment', OfflineCommentPayload & { localCommentId: string }>
  | PendingOfflineActionBase<'quote', OfflineAnnotationPayload & { localAnnotationId: string }>
  | PendingOfflineActionBase<'reaction', OfflineAnnotationPayload & { localAnnotationId: string }>
  | PendingOfflineActionBase<'annotation-vote', OfflineAnnotationVotePayload>

export interface OfflineFeedResponse {
  sections: FeedSectionData[]
  variantPresets?: Record<string, VariantPresetRecord>
  hasPrev: boolean
  hasNext: boolean
}
