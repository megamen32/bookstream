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

export interface FeedPreviewComment {
  id: string
  authorName: string
  body: string
}

export interface FeedPreviewTopQuote {
  text: string
  reactionsCount: number
  commentsCount: number
  chapterId: string
  variantType: string
  paragraphId: string | null
  paragraphEndId: string | null
}

export interface FeedPreviewStats {
  commentsCount: number
  reactionsCount: number
  quotesCount: number
  bookmarksCount: number | null
  topQuote: FeedPreviewTopQuote | null
}

export interface FeedSectionPreview {
  comments: FeedPreviewComment[]
  stats: FeedPreviewStats
}

export interface FeedSectionData {
  chapter: ReaderChapterListItem
  variant: {
    id: string
    variantType: string
    paragraphs: ReaderParagraph[]
  }
  preview: FeedSectionPreview
  commentsPreview: ReaderComment[]
  commentCount: number
  prevChapterId: string | null
  nextChapterId: string | null
}
