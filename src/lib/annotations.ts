export type AnnotationKind = 'reaction' | 'quote' | 'comment'
export type AnnotationAnchorStatus = 'exact' | 'approximate' | 'stale'

export interface AnnotationSelection {
  paragraphId: string
  endParagraphId?: string | null
  startOffset?: number | null
  endOffset?: number | null
  selectedText?: string | null
}

export interface AnnotationRange {
  start: number
  end: number
  kind: AnnotationKind
  badgeLabel: string
  emoji?: string | null
}

export interface AnnotationParagraphRange {
  paragraphId: string
  endParagraphId: string
  startOffset: number
  endOffset: number
  kind: AnnotationKind
  badgeLabel: string
  emoji?: string | null
  selectedText?: string | null
}

export interface AnnotationTextSegment {
  text: string
  highlighted: boolean
  badges: AnnotationParagraphRange[]
}

export interface ParagraphLike {
  id: string
  text: string
}

export interface ParagraphIndexMapLike {
  get(key: string): number | undefined
}

export interface AnnotationLike {
  kind: string
  paragraphId: string | null
  endParagraphId: string | null
  anchorStatus?: AnnotationAnchorStatus | string | null
  startOffset: number
  endOffset: number
  selectedText?: string | null
  emoji?: string | null
}

export interface UnifiedAnnotationItem {
  id: string
  kind: AnnotationKind
  kindLabel: string
  createdAt: string
  bookId: string
  chapterId: string
  chapterTitle: string
  chapterPosition: number
  chapterVariantId: string | null
  sourceRevisionId?: string | null
  resolvedRevisionId?: string | null
  variantType: string
  readerId: string
  username: string
  body: string | null
  emoji: string | null
  isSynthetic: boolean
  selectedText: string | null
  paragraphId: string | null
  endParagraphId: string | null
  startStableKey?: string | null
  endStableKey?: string | null
  anchorPrefix?: string | null
  anchorSuffix?: string | null
  anchorStatus?: AnnotationAnchorStatus
  anchorScore?: number | null
  startOffset: number
  endOffset: number
  syncStatus?: 'synced' | 'pending' | 'failed'
  offlineOperationId?: string | null
  syncError?: string | null
}

export interface AnnotationVoteLike {
  readerId: string
}

export interface AnnotationChapterLike {
  id: string
  title: string
  position: number
}

export interface AnnotationCommentItem {
  id: string
  bookId: string
  chapterId: string
  chapterTitle: string
  chapterPosition: number
  chapterVariantId: string | null
  sourceRevisionId?: string | null
  resolvedRevisionId?: string | null
  variantType: string
  readerId: string
  username: string
  body: string
  status: string
  isSynthetic: boolean
  createdAt: string
  selectedText: string | null
  paragraphId: string | null
  endParagraphId: string | null
  startStableKey?: string | null
  endStableKey?: string | null
  anchorPrefix?: string | null
  anchorSuffix?: string | null
  anchorStatus?: AnnotationAnchorStatus
  anchorScore?: number | null
  startOffset: number
  endOffset: number
  upvoteCount: number
  reacted: boolean
  quotes: Array<{
    id: string
    variantType: string
    selectedText: string
    paragraphId: string
    endParagraphId?: string | null
  }>
}

export interface AnnotationQuoteItem {
  id: string
  text: string
  variantType: string
  chapterId: string
  readerId: string
  paragraphId: string
  paragraphEndId: string | null
  startOffset: number
  endOffset: number
  chapterTitle: string
  chapterPosition: number
  username: string
  createdAt: string
  upvoteCount: number
  reacted: boolean
  isSynthetic: boolean
}

export interface AnnotationCommentRowLike {
  id: string
  bookId: string
  chapterId: string
  chapterVariantId: string | null
  variantType: string
  readerId: string
  username: string
  body: string | null
  status: string
  isSynthetic: boolean
  createdAt: Date
  selectedText: string | null
  paragraphId: string | null
  endParagraphId: string | null
  sourceRevisionId?: string | null
  resolvedRevisionId?: string | null
  startStableKey?: string | null
  endStableKey?: string | null
  anchorPrefix?: string | null
  anchorSuffix?: string | null
  anchorStatus?: AnnotationAnchorStatus | string | null
  anchorScore?: number | null
  startOffset: number
  endOffset: number
  votes: AnnotationVoteLike[]
  chapter: AnnotationChapterLike
}

export interface AnnotationQuoteRowLike {
  id: string
  selectedText: string | null
  variantType: string
  startOffset: number
  endOffset: number
  paragraphId: string | null
  endParagraphId: string | null
  sourceRevisionId?: string | null
  resolvedRevisionId?: string | null
  startStableKey?: string | null
  endStableKey?: string | null
  anchorPrefix?: string | null
  anchorSuffix?: string | null
  anchorStatus?: AnnotationAnchorStatus | string | null
  anchorScore?: number | null
  createdAt: Date
  readerId: string
  username: string
  isSynthetic: boolean
  votes: AnnotationVoteLike[]
  chapter: AnnotationChapterLike
}

export function sortItemsByCreatedAt<T extends { createdAt: string }>(items: T[]): T[] {
  return [...items].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
}

export function sortCommentsByTop<T extends { upvoteCount: number; createdAt: string }>(comments: T[]): T[] {
  return [...comments].sort((a, b) => {
    if (b.upvoteCount !== a.upvoteCount) return b.upvoteCount - a.upvoteCount
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  })
}

export function sortQuotesByTop<T extends { upvoteCount: number; createdAt: string }>(quotes: T[]): T[] {
  return sortCommentsByTop(quotes)
}

export function mapAnnotationComment(
  annotation: AnnotationCommentRowLike,
  readerId?: string | null,
): AnnotationCommentItem {
  const reacted = Boolean(readerId && annotation.votes.some((vote) => vote.readerId === readerId))
  const selectedText = annotation.selectedText && annotation.selectedText.trim().length > 0
    ? annotation.selectedText
    : null
  const paragraphId = annotation.paragraphId
  const endParagraphId = annotation.endParagraphId

  return {
    id: annotation.id,
    bookId: annotation.bookId,
    chapterId: annotation.chapterId,
    chapterTitle: annotation.chapter.title,
    chapterPosition: annotation.chapter.position,
    chapterVariantId: annotation.chapterVariantId,
    sourceRevisionId: annotation.sourceRevisionId || null,
    resolvedRevisionId: annotation.resolvedRevisionId || null,
    variantType: annotation.variantType,
    readerId: annotation.readerId,
    username: annotation.username,
    body: annotation.body || '',
    status: annotation.status,
    isSynthetic: annotation.isSynthetic,
    createdAt: annotation.createdAt.toISOString(),
    selectedText,
    paragraphId,
    endParagraphId,
    startStableKey: annotation.startStableKey || null,
    endStableKey: annotation.endStableKey || null,
    anchorPrefix: annotation.anchorPrefix || null,
    anchorSuffix: annotation.anchorSuffix || null,
    anchorStatus: normalizeAnchorStatus(annotation.anchorStatus),
    anchorScore: annotation.anchorScore ?? 1,
    startOffset: annotation.startOffset,
    endOffset: annotation.endOffset,
    upvoteCount: annotation.votes.length,
    reacted,
    quotes: paragraphId && selectedText
      ? [{
          id: `${annotation.id}:quote`,
          variantType: annotation.variantType,
          selectedText,
          paragraphId,
          endParagraphId,
        }]
      : [],
  }
}

export function mapAnnotationQuote(
  annotation: AnnotationQuoteRowLike,
  readerId?: string | null,
): AnnotationQuoteItem | null {
  const text = annotation.selectedText?.trim() || ''
  const paragraphId = annotation.paragraphId || ''
  if (!text || !paragraphId) {
    return null
  }

  return {
    id: annotation.id,
    text,
    variantType: annotation.variantType,
    chapterId: annotation.chapter.id,
    readerId: annotation.readerId,
    paragraphId,
    paragraphEndId: annotation.endParagraphId,
    startOffset: annotation.startOffset,
    endOffset: annotation.endOffset,
    chapterTitle: annotation.chapter.title,
    chapterPosition: annotation.chapter.position,
    username: annotation.username,
    createdAt: annotation.createdAt.toISOString(),
    upvoteCount: annotation.votes.length,
    reacted: Boolean(readerId && annotation.votes.some((vote) => vote.readerId === readerId)),
    isSynthetic: annotation.isSynthetic,
  }
}

export function normalizeParagraphEnd(paragraphId: string, endParagraphId?: string | null): string {
  return endParagraphId && endParagraphId.length > 0 ? endParagraphId : paragraphId
}

export function annotationKindLabel(kind: AnnotationKind): string {
  if (kind === 'reaction') return 'Реакция'
  if (kind === 'quote') return 'Цитата'
  return 'Комментарий'
}

export function annotationBadgeLabel(kind: AnnotationKind): string {
  if (kind === 'reaction') return 'вы'
  if (kind === 'quote') return 'цитата'
  return 'коммент'
}

export function annotationKindFromString(kind: string): AnnotationKind {
  if (kind === 'quote') return 'quote'
  if (kind === 'comment') return 'comment'
  return 'reaction'
}

export function normalizeAnchorStatus(status?: string | null): AnnotationAnchorStatus {
  if (status === 'approximate' || status === 'stale') {
    return status
  }

  return 'exact'
}

export function buildAnnotationSelection(
  selection: Partial<AnnotationSelection> & { paragraphId?: string | null },
): {
  paragraphId: string
  endParagraphId: string
  startOffset: number
  endOffset: number
  selectedText: string
} {
  const paragraphId = typeof selection.paragraphId === 'string' ? selection.paragraphId : ''
  const endParagraphId = normalizeParagraphEnd(paragraphId, selection.endParagraphId)
  const startOffset = Number.isFinite(selection.startOffset) ? Math.max(0, Number(selection.startOffset)) : 0
  const endOffset = Number.isFinite(selection.endOffset) ? Math.max(0, Number(selection.endOffset)) : 0
  const selectedText = typeof selection.selectedText === 'string' ? selection.selectedText : ''

  return {
    paragraphId,
    endParagraphId,
    startOffset,
    endOffset,
    selectedText,
  }
}

export function buildAnnotationParagraphRanges<T extends AnnotationLike>(
  annotations: T[],
  paragraphs: ParagraphLike[],
  paragraphIndexMap: ParagraphIndexMapLike,
): AnnotationParagraphRange[] {
  const ranges: AnnotationParagraphRange[] = []

  for (const annotation of annotations) {
    const paragraphId = annotation.paragraphId
    if (!paragraphId) continue

    const startIndex = paragraphIndexMap.get(paragraphId)
    const endIndex = paragraphIndexMap.get(normalizeParagraphEnd(paragraphId, annotation.endParagraphId))
    if (startIndex === undefined || endIndex === undefined) continue

    const [fromIndex, toIndex] = startIndex <= endIndex ? [startIndex, endIndex] : [endIndex, startIndex]
    const fromParagraph = paragraphs[fromIndex]
    const toParagraph = paragraphs[toIndex]
    if (!fromParagraph || !toParagraph) continue

    const kind = annotationKindFromString(annotation.kind)
    const badgeLabel = annotationBadgeLabel(kind)
    const hasExplicitSelection =
      typeof annotation.selectedText === 'string' && annotation.selectedText.trim().length > 0
      || annotation.startOffset > 0
      || annotation.endOffset > 0

    if (fromIndex === toIndex) {
      const endOffset = kind === 'reaction' && !hasExplicitSelection
        ? fromParagraph.text.length
        : annotation.endOffset
      ranges.push({
        paragraphId: fromParagraph.id,
        endParagraphId: toParagraph.id,
        startOffset: annotation.startOffset,
        endOffset,
        kind,
        badgeLabel,
        emoji: annotation.emoji,
        selectedText: annotation.selectedText,
      })
      continue
    }

    const fromEndOffset = kind === 'reaction' && !hasExplicitSelection
      ? fromParagraph.text.length
      : fromParagraph.text.length
    ranges.push({
      paragraphId: fromParagraph.id,
      endParagraphId: fromParagraph.id,
      startOffset: annotation.startOffset,
      endOffset: fromEndOffset,
      kind,
      badgeLabel,
      emoji: annotation.emoji,
      selectedText: annotation.selectedText,
    })

    for (let index = fromIndex + 1; index < toIndex; index += 1) {
      const paragraph = paragraphs[index]
      if (!paragraph) continue
      ranges.push({
        paragraphId: paragraph.id,
        endParagraphId: paragraph.id,
        startOffset: 0,
        endOffset: paragraph.text.length,
        kind,
        badgeLabel,
        emoji: annotation.emoji,
        selectedText: annotation.selectedText,
      })
    }

    const toStartOffset = kind === 'reaction' && !hasExplicitSelection ? 0 : 0
    ranges.push({
      paragraphId: toParagraph.id,
      endParagraphId: toParagraph.id,
      startOffset: toStartOffset,
      endOffset: kind === 'reaction' && !hasExplicitSelection ? toParagraph.text.length : annotation.endOffset,
      kind,
      badgeLabel,
      emoji: annotation.emoji,
      selectedText: annotation.selectedText,
    })
  }

  return ranges
}

export function splitTextByAnnotationRanges(
  text: string,
  ranges: AnnotationParagraphRange[],
): AnnotationTextSegment[] {
  if (text.length === 0 || ranges.length === 0) {
    return [{ text, highlighted: false, badges: [] }]
  }

  const boundaries = new Set<number>([0, text.length])
  for (const range of ranges) {
    const start = Math.max(0, Math.min(range.startOffset, text.length))
    const end = Math.max(0, Math.min(range.endOffset, text.length))
    if (end > start) {
      boundaries.add(start)
      boundaries.add(end)
    }
  }

  const sortedBoundaries = Array.from(boundaries).sort((a, b) => a - b)
  const segments: AnnotationTextSegment[] = []

  for (let index = 0; index < sortedBoundaries.length - 1; index += 1) {
    const start = sortedBoundaries[index]
    const end = sortedBoundaries[index + 1]
    if (end <= start) continue

    const activeBadges = ranges.filter((range) => range.startOffset < end && range.endOffset > start)
    const segmentText = text.slice(start, end)
    if (!segmentText) continue

    segments.push({
      text: segmentText,
      highlighted: activeBadges.length > 0,
      badges: activeBadges,
    })
  }

  return segments.length > 0 ? segments : [{ text, highlighted: false, badges: [] }]
}
