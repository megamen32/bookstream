import type { ReaderComment } from './comment-types'

export interface ReaderParagraph {
  id: string
  stableKey: string
  position: number
  text: string
  html?: string
  textAlign?: 'left' | 'center' | 'right' | 'justify' | null
  indentPx?: number
}

export interface ReaderChapterListItem {
  id: string
  title: string
  position: number
  level?: number
  variants: Array<{ id: string; variantType: string }>
}

export interface FeedPreviewTopQuote {
  id: string
  text: string
  upvoteCount: number
  reacted: boolean
  reactionsCount: number
  commentsCount: number
  readerId: string
  username: string
  createdAt: string
  chapterId: string
  variantType: string
  paragraphId: string | null
  paragraphEndId: string | null
  startOffset?: number
  endOffset?: number
}

export interface FeedPreviewStats {
  commentsCount: number
  reactionsCount: number
  quotesCount: number
  bookmarksCount: number | null
  topQuote: FeedPreviewTopQuote | null
}

export interface FeedSectionPreview {
  leadComment: ReaderComment | null
  freshComments: ReaderComment[]
  quotesPreview: FeedPreviewTopQuote[]
  stats: FeedPreviewStats
}

export interface FeedSectionData {
  chapter: ReaderChapterListItem
  variant: {
    id: string
    variantType: string
    revisionId?: string | null
    revisionNumber?: number | null
    paragraphs: ReaderParagraph[]
  }
  preview: FeedSectionPreview
  commentsPreview: ReaderComment[]
  commentCount: number
  prevChapterId: string | null
  nextChapterId: string | null
}
