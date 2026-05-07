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

export interface FeedSectionData {
  chapter: ReaderChapterListItem
  variant: {
    id: string
    variantType: string
    paragraphs: ReaderParagraph[]
  }
  commentsPreview: ReaderComment[]
  commentCount: number
  prevChapterId: string | null
  nextChapterId: string | null
}
