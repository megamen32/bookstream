export interface ReaderCommentQuote {
  id: string
  variantType: string
  selectedText: string
  paragraphId: string
  endParagraphId?: string | null
}

export interface ReaderComment {
  id: string
  bookId?: string
  chapterId?: string
  chapterTitle?: string
  chapterPosition?: number
  chapterVariantId?: string | null
  variantType?: string
  readerId: string
  username: string
  body: string
  isSynthetic?: boolean
  createdAt: string
  selectedText?: string | null
  paragraphId?: string | null
  endParagraphId?: string | null
  anchorStatus?: 'exact' | 'approximate' | 'stale' | null
  startOffset?: number
  endOffset?: number
  upvoteCount: number
  reacted: boolean
  quotes: ReaderCommentQuote[]
  syncStatus?: 'synced' | 'pending' | 'failed'
  offlineOperationId?: string | null
  syncError?: string | null
}

export type CommentSubmitHandler = (body: string) => Promise<ReaderComment | null>
