export type AnnotationKind = 'reaction' | 'quote' | 'comment'

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
  variantType: string
  readerId: string
  username: string
  body: string | null
  emoji: string | null
  selectedText: string | null
  paragraphId: string | null
  endParagraphId: string | null
  startOffset: number
  endOffset: number
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
