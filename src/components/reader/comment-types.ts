export interface ReaderCommentQuote {
  id: string
  variantType: string
  selectedText: string
  paragraphId: string
  endParagraphId?: string | null
}

export interface ReaderComment {
  id: string
  readerId: string
  username: string
  body: string
  createdAt: string
  quotes: ReaderCommentQuote[]
}

export type CommentSubmitHandler = (body: string) => Promise<ReaderComment | null>
