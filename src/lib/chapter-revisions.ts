import { randomUUID } from 'node:crypto'
import {
  type Annotation,
  type ChapterVariant,
  type ChapterVariantRevision,
  type Paragraph,
  Prisma,
} from '@prisma/client'
import { buildAnnotationSelection } from './annotations.ts'
import {
  buildParagraphInputsFromHtml,
  ensureVariantParagraphs,
  syncVariantParagraphs,
  type SyncedParagraphInput,
} from './chapter-variants.ts'

type RevisionStore = Pick<
  Prisma.TransactionClient,
  'annotation' | 'chapterVariant' | 'chapterVariantRevision' | 'chapterVariantRevisionParagraph' | 'paragraph'
>

export type AnnotationAnchorStatus = 'exact' | 'approximate' | 'stale'

export interface VariantRevisionSaveResult {
  variant: ChapterVariant
  headRevision: ChapterVariantRevision
  paragraphs: Paragraph[]
}

interface ParagraphSnapshotLike {
  id?: string
  stableKey: string
  position: number
  text: string
}

interface ChapterTextIndexEntry {
  paragraphId: string
  stableKey: string
  paragraphIndex: number
  start: number
  end: number
  text: string
}

interface ChapterTextIndex {
  text: string
  entries: ChapterTextIndexEntry[]
}

interface ResolvedAnchor {
  paragraphId: string | null
  endParagraphId: string | null
  startOffset: number
  endOffset: number
  startStableKey: string | null
  endStableKey: string | null
  anchorPrefix: string | null
  anchorSuffix: string | null
  anchorStatus: AnnotationAnchorStatus
  anchorScore: number
}

function normalizeAnchorText(text: string): string {
  return text.replace(/\s+/g, ' ').trim().toLowerCase()
}

function buildNewStableKey(): string {
  return `pk_${randomUUID().replace(/-/g, '').slice(0, 16)}`
}

function buildTrigrams(text: string): Set<string> {
  const normalized = normalizeAnchorText(text)
  if (normalized.length <= 3) {
    return normalized ? new Set([normalized]) : new Set()
  }

  const trigrams = new Set<string>()
  for (let index = 0; index < normalized.length - 2; index += 1) {
    trigrams.add(normalized.slice(index, index + 3))
  }
  return trigrams
}

function diceCoefficient(left: string, right: string): number {
  const leftTrigrams = buildTrigrams(left)
  const rightTrigrams = buildTrigrams(right)

  if (leftTrigrams.size === 0 || rightTrigrams.size === 0) {
    return normalizeAnchorText(left) === normalizeAnchorText(right) ? 1 : 0
  }

  let intersectionCount = 0
  for (const trigram of leftTrigrams) {
    if (rightTrigrams.has(trigram)) {
      intersectionCount += 1
    }
  }

  return (2 * intersectionCount) / (leftTrigrams.size + rightTrigrams.size)
}

function sliceContext(text: string, start: number, end: number): { prefix: string | null; suffix: string | null } {
  const prefix = text.slice(Math.max(0, start - 48), start).trim()
  const suffix = text.slice(end, Math.min(text.length, end + 48)).trim()

  return {
    prefix: prefix || null,
    suffix: suffix || null,
  }
}

function findParagraphIndexById(paragraphs: Array<{ id?: string; stableKey: string }>, paragraphId: string): number {
  return paragraphs.findIndex((paragraph) => paragraph.id === paragraphId)
}

function extractRangeText(
  paragraphs: Array<{ text: string }>,
  startIndex: number,
  endIndex: number,
  startOffset: number,
  endOffset: number,
): string {
  const [fromIndex, toIndex] = startIndex <= endIndex ? [startIndex, endIndex] : [endIndex, startIndex]
  const segments: string[] = []

  for (let index = fromIndex; index <= toIndex; index += 1) {
    const paragraph = paragraphs[index]
    if (!paragraph) {
      continue
    }

    if (fromIndex === toIndex) {
      segments.push(paragraph.text.slice(startOffset, endOffset))
      continue
    }

    if (index === fromIndex) {
      segments.push(paragraph.text.slice(startOffset))
      continue
    }

    if (index === toIndex) {
      segments.push(paragraph.text.slice(0, endOffset))
      continue
    }

    segments.push(paragraph.text)
  }

  return segments.join('\n\n')
}

function buildChapterTextIndex(paragraphs: ParagraphSnapshotLike[]): ChapterTextIndex {
  const entries: ChapterTextIndexEntry[] = []
  let cursor = 0
  const chunks: string[] = []

  for (const paragraph of paragraphs) {
    const start = cursor
    chunks.push(paragraph.text)
    cursor += paragraph.text.length
    entries.push({
      paragraphId: paragraph.id || '',
      stableKey: paragraph.stableKey,
      paragraphIndex: paragraph.position,
      start,
      end: cursor,
      text: paragraph.text,
    })
    chunks.push('\n\n')
    cursor += 2
  }

  if (chunks.length > 0) {
    chunks.splice(chunks.length - 1, 1)
    cursor -= 2
  }

  return {
    text: chunks.join(''),
    entries,
  }
}

function locateAbsoluteOffset(index: ChapterTextIndex, absoluteOffset: number): { paragraph: ChapterTextIndexEntry; offset: number } | null {
  for (const entry of index.entries) {
    if (absoluteOffset <= entry.end) {
      return {
        paragraph: entry,
        offset: Math.max(0, Math.min(entry.text.length, absoluteOffset - entry.start)),
      }
    }
  }

  const last = index.entries[index.entries.length - 1]
  if (!last) {
    return null
  }

  return {
    paragraph: last,
    offset: last.text.length,
  }
}

function toResolvedAnchor(
  index: ChapterTextIndex,
  absoluteStart: number,
  absoluteEnd: number,
  status: AnnotationAnchorStatus,
  score: number,
): ResolvedAnchor | null {
  const startLocation = locateAbsoluteOffset(index, absoluteStart)
  const endLocation = locateAbsoluteOffset(index, absoluteEnd)

  if (!startLocation || !endLocation) {
    return null
  }

  const selectedText = index.text.slice(absoluteStart, absoluteEnd)
  const context = sliceContext(index.text, absoluteStart, absoluteEnd)

  return {
    paragraphId: startLocation.paragraph.paragraphId || null,
    endParagraphId: endLocation.paragraph.paragraphId || null,
    startOffset: startLocation.offset,
    endOffset: endLocation.offset,
    startStableKey: startLocation.paragraph.stableKey,
    endStableKey: endLocation.paragraph.stableKey,
    anchorPrefix: context.prefix,
    anchorSuffix: context.suffix,
    anchorStatus: status,
    anchorScore: score,
  }
}

function buildSelectionContext(
  index: ChapterTextIndex,
  paragraphId: string,
  endParagraphId: string,
  startOffset: number,
  endOffset: number,
): { selectedText: string; anchorPrefix: string | null; anchorSuffix: string | null } | null {
  const startEntry = index.entries.find((entry) => entry.paragraphId === paragraphId)
  const endEntry = index.entries.find((entry) => entry.paragraphId === endParagraphId)

  if (!startEntry || !endEntry) {
    return null
  }

  const absoluteStart = startEntry.start + startOffset
  const absoluteEnd = endEntry.start + endOffset
  const context = sliceContext(index.text, absoluteStart, absoluteEnd)

  return {
    selectedText: index.text.slice(absoluteStart, absoluteEnd),
    anchorPrefix: context.prefix,
    anchorSuffix: context.suffix,
  }
}

export function assignParagraphStableKeys(
  previousParagraphs: ParagraphSnapshotLike[],
  nextParagraphs: SyncedParagraphInput[],
): SyncedParagraphInput[] {
  const normalizedPrevious = previousParagraphs.map((paragraph) => normalizeAnchorText(paragraph.text))
  const normalizedNext = nextParagraphs.map((paragraph) => normalizeAnchorText(paragraph.text))
  const previousMatched = new Set<number>()
  const nextMatched = new Set<number>()
  const assignedStableKeys = new Array<string | null>(nextParagraphs.length).fill(null)

  const previousByText = new Map<string, number[]>()
  normalizedPrevious.forEach((text, index) => {
    const indexes = previousByText.get(text)
    if (indexes) {
      indexes.push(index)
    } else {
      previousByText.set(text, [index])
    }
  })

  normalizedNext.forEach((text, index) => {
    const previousIndexes = previousByText.get(text)
    if (!previousIndexes || previousIndexes.length !== 1) {
      return
    }

    const previousIndex = previousIndexes[0]
    if (previousMatched.has(previousIndex)) {
      return
    }

    const nextIndexesWithSameText = normalizedNext.reduce<number[]>((acc, candidate, candidateIndex) => {
      if (candidate === text) {
        acc.push(candidateIndex)
      }
      return acc
    }, [])

    if (nextIndexesWithSameText.length !== 1) {
      return
    }

    assignedStableKeys[index] = previousParagraphs[previousIndex].stableKey
    previousMatched.add(previousIndex)
    nextMatched.add(index)
  })

  let cursor = 0
  for (let nextIndex = 0; nextIndex < nextParagraphs.length; nextIndex += 1) {
    if (nextMatched.has(nextIndex)) {
      continue
    }

    let bestPreviousIndex = -1
    let bestScore = 0

    for (let previousIndex = cursor; previousIndex < previousParagraphs.length; previousIndex += 1) {
      if (previousMatched.has(previousIndex)) {
        continue
      }

      const score = diceCoefficient(previousParagraphs[previousIndex].text, nextParagraphs[nextIndex].text)
      if (score > bestScore) {
        bestScore = score
        bestPreviousIndex = previousIndex
      }
    }

    if (bestPreviousIndex >= 0 && bestScore >= 0.72) {
      assignedStableKeys[nextIndex] = previousParagraphs[bestPreviousIndex].stableKey
      previousMatched.add(bestPreviousIndex)
      cursor = bestPreviousIndex + 1
      continue
    }

    assignedStableKeys[nextIndex] = buildNewStableKey()
  }

  return nextParagraphs.map((paragraph, index) => ({
    ...paragraph,
    stableKey: assignedStableKeys[index] || buildNewStableKey(),
  }))
}

async function ensureHeadRevisionForVariant(
  store: RevisionStore,
  variant: ChapterVariant,
): Promise<{ headRevision: ChapterVariantRevision; paragraphs: Paragraph[] }> {
  if (variant.headRevisionId) {
    const headRevision = await store.chapterVariantRevision.findUnique({
      where: { id: variant.headRevisionId },
    })

    if (headRevision) {
      const paragraphs = await ensureVariantParagraphs(store, variant.id, variant.contentHtml)
      return { headRevision, paragraphs }
    }
  }

  const currentParagraphs = await ensureVariantParagraphs(store, variant.id, variant.contentHtml)
  const initialRevision = await store.chapterVariantRevision.create({
    data: {
      chapterVariantId: variant.id,
      revisionNumber: 1,
      parentRevisionId: null,
      contentHtml: variant.contentHtml,
      source: 'migration',
    },
  })

  if (currentParagraphs.length > 0) {
    await store.chapterVariantRevisionParagraph.createMany({
      data: currentParagraphs.map((paragraph) => ({
        revisionId: initialRevision.id,
        stableKey: paragraph.stableKey,
        position: paragraph.position,
        text: paragraph.text,
      })),
    })
  }

  const nextVariant = await store.chapterVariant.update({
    where: { id: variant.id },
    data: {
      headRevisionId: initialRevision.id,
    },
  })

  return {
    headRevision: {
      ...initialRevision,
      chapterVariantId: nextVariant.id,
    },
    paragraphs: currentParagraphs,
  }
}

async function loadVariantForRevisionWrite(
  store: RevisionStore,
  params: { chapterId: string; variantType: string },
): Promise<ChapterVariant | null> {
  return store.chapterVariant.findUnique({
    where: {
      chapterId_variantType: {
        chapterId: params.chapterId,
        variantType: params.variantType,
      },
    },
  })
}

function resolveLegacyStableKey(
  annotation: Annotation,
  oldParagraphById: Map<string, Paragraph>,
  fallbackField: 'paragraphId' | 'endParagraphId',
): string | null {
  const directStableKey = fallbackField === 'paragraphId' ? annotation.startStableKey : annotation.endStableKey
  if (directStableKey) {
    return directStableKey
  }

  const paragraphId = fallbackField === 'paragraphId' ? annotation.paragraphId : annotation.endParagraphId
  if (!paragraphId) {
    return null
  }

  return oldParagraphById.get(paragraphId)?.stableKey || null
}

function resolveExactStableKeyAnchor(
  annotation: Annotation,
  oldParagraphs: Paragraph[],
  newParagraphs: Paragraph[],
): ResolvedAnchor | null {
  const oldParagraphById = new Map(oldParagraphs.map((paragraph) => [paragraph.id, paragraph]))
  const newParagraphByStableKey = new Map(newParagraphs.map((paragraph) => [paragraph.stableKey, paragraph]))
  const startStableKey = resolveLegacyStableKey(annotation, oldParagraphById, 'paragraphId')
  const endStableKey = resolveLegacyStableKey(annotation, oldParagraphById, 'endParagraphId')

  if (!startStableKey || !endStableKey) {
    return null
  }

  const startParagraph = newParagraphByStableKey.get(startStableKey)
  const endParagraph = newParagraphByStableKey.get(endStableKey)

  if (!startParagraph || !endParagraph) {
    return null
  }

  return {
    paragraphId: startParagraph.id,
    endParagraphId: endParagraph.id,
    startOffset: annotation.startOffset,
    endOffset: annotation.endOffset,
    startStableKey,
    endStableKey,
    anchorPrefix: annotation.anchorPrefix,
    anchorSuffix: annotation.anchorSuffix,
    anchorStatus: 'exact',
    anchorScore: 1,
  }
}

function validateResolvedAnchor(
  paragraphs: Paragraph[],
  annotation: Annotation,
  resolved: ResolvedAnchor,
): boolean {
  const selectedText = annotation.selectedText?.trim()
  if (!selectedText) {
    return true
  }

  const startIndex = paragraphs.findIndex((paragraph) => paragraph.id === resolved.paragraphId)
  const endIndex = paragraphs.findIndex((paragraph) => paragraph.id === resolved.endParagraphId)
  if (startIndex < 0 || endIndex < 0) {
    return false
  }

  const candidateText = extractRangeText(
    paragraphs,
    startIndex,
    endIndex,
    resolved.startOffset,
    resolved.endOffset,
  )

  return normalizeAnchorText(candidateText) === normalizeAnchorText(selectedText)
}

function scoreContextMatch(
  prefix: string | null,
  suffix: string | null,
  expectedPrefix: string | null,
  expectedSuffix: string | null,
): number {
  let score = 0

  if (expectedPrefix) {
    score += normalizeAnchorText(prefix || '').endsWith(normalizeAnchorText(expectedPrefix)) ? 0.5 : 0
  }

  if (expectedSuffix) {
    score += normalizeAnchorText(suffix || '').startsWith(normalizeAnchorText(expectedSuffix)) ? 0.5 : 0
  }

  return score
}

function resolveExactTextAnchor(
  annotation: Annotation,
  oldParagraphs: Paragraph[],
  newParagraphs: Paragraph[],
): ResolvedAnchor | null {
  const selectedText = annotation.selectedText?.trim()
  if (!selectedText) {
    return null
  }

  const newIndex = buildChapterTextIndex(newParagraphs)
  const caseFoldedText = newIndex.text.toLowerCase()
  const caseFoldedSelectedText = selectedText.toLowerCase()
  const occurrences: Array<{ start: number; end: number; score: number }> = []

  let fromIndex = 0
  while (fromIndex < caseFoldedText.length) {
    const candidateIndex = caseFoldedText.indexOf(caseFoldedSelectedText, fromIndex)
    if (candidateIndex < 0) {
      break
    }

    const absoluteEnd = candidateIndex + selectedText.length
    const context = sliceContext(newIndex.text, candidateIndex, absoluteEnd)
    const contextScore = scoreContextMatch(
      context.prefix,
      context.suffix,
      annotation.anchorPrefix,
      annotation.anchorSuffix,
    )

    occurrences.push({
      start: candidateIndex,
      end: absoluteEnd,
      score: contextScore,
    })
    fromIndex = candidateIndex + 1
  }

  if (occurrences.length === 0) {
    return null
  }

  const oldParagraphById = new Map(oldParagraphs.map((paragraph) => [paragraph.id, paragraph]))
  const startStableKey = resolveLegacyStableKey(annotation, oldParagraphById, 'paragraphId')
  const oldPosition = startStableKey
    ? oldParagraphs.find((paragraph) => paragraph.stableKey === startStableKey)?.position ?? 0
    : 0

  let best = occurrences[0]
  let bestScore = Number.NEGATIVE_INFINITY

  for (const occurrence of occurrences) {
    const startLocation = locateAbsoluteOffset(newIndex, occurrence.start)
    const proximityPenalty = startLocation ? Math.abs(startLocation.paragraph.paragraphIndex - oldPosition) * 0.05 : 0
    const score = occurrence.score - proximityPenalty
    if (score > bestScore) {
      best = occurrence
      bestScore = score
    }
  }

  const status: AnnotationAnchorStatus = occurrences.length === 1 || best.score >= 1 ? 'exact' : 'approximate'
  return toResolvedAnchor(newIndex, best.start, best.end, status, status === 'exact' ? 1 : 0.8)
}

function resolveApproximateAnchor(
  annotation: Annotation,
  oldParagraphs: Paragraph[],
  newParagraphs: Paragraph[],
): ResolvedAnchor | null {
  const selectedText = annotation.selectedText?.trim()
  if (selectedText) {
    const oldParagraphById = new Map(oldParagraphs.map((paragraph) => [paragraph.id, paragraph]))
    const startStableKey = resolveLegacyStableKey(annotation, oldParagraphById, 'paragraphId')
    const oldStartPosition = startStableKey
      ? oldParagraphs.find((paragraph) => paragraph.stableKey === startStableKey)?.position ?? 0
      : 0
    const oldEndStableKey = resolveLegacyStableKey(annotation, oldParagraphById, 'endParagraphId')
    const oldEndPosition = oldEndStableKey
      ? oldParagraphs.find((paragraph) => paragraph.stableKey === oldEndStableKey)?.position ?? oldStartPosition
      : oldStartPosition
    const expectedWindowSize = Math.max(1, Math.abs(oldEndPosition - oldStartPosition) + 1)
    const newIndex = buildChapterTextIndex(newParagraphs)

    let bestAnchor: ResolvedAnchor | null = null
    let bestScore = 0

    for (let startIndex = Math.max(0, oldStartPosition - 3); startIndex < Math.min(newParagraphs.length, oldStartPosition + 4); startIndex += 1) {
      for (let windowSize = Math.max(1, expectedWindowSize - 1); windowSize <= Math.min(expectedWindowSize + 1, newParagraphs.length - startIndex); windowSize += 1) {
        const endIndex = startIndex + windowSize - 1
        const candidateText = extractRangeText(
          newParagraphs,
          startIndex,
          endIndex,
          0,
          newParagraphs[endIndex].text.length,
        )
        const score = diceCoefficient(candidateText, selectedText)
        if (score <= bestScore) {
          continue
        }

        const startEntry = newIndex.entries.find((entry) => entry.paragraphId === newParagraphs[startIndex].id)
        const endEntry = newIndex.entries.find((entry) => entry.paragraphId === newParagraphs[endIndex].id)
        if (!startEntry || !endEntry) {
          continue
        }

        bestScore = score
        bestAnchor = toResolvedAnchor(
          newIndex,
          startEntry.start,
          endEntry.end,
          'approximate',
          score,
        )
      }
    }

    if (bestAnchor && bestScore >= 0.55) {
      return bestAnchor
    }
  }

  const startStableKey = annotation.startStableKey
  if (startStableKey) {
    const paragraphByStableKey = new Map(newParagraphs.map((paragraph) => [paragraph.stableKey, paragraph]))
    const exactParagraph = paragraphByStableKey.get(startStableKey)
    if (exactParagraph) {
      return {
        paragraphId: exactParagraph.id,
        endParagraphId: exactParagraph.id,
        startOffset: 0,
        endOffset: annotation.endOffset > 0 ? Math.min(annotation.endOffset, exactParagraph.text.length) : 0,
        startStableKey,
        endStableKey: exactParagraph.stableKey,
        anchorPrefix: annotation.anchorPrefix,
        anchorSuffix: annotation.anchorSuffix,
        anchorStatus: 'approximate',
        anchorScore: 0.6,
      }
    }
  }

  return null
}

function buildStaleAnchor(annotation: Annotation): ResolvedAnchor {
  return {
    paragraphId: null,
    endParagraphId: null,
    startOffset: annotation.startOffset,
    endOffset: annotation.endOffset,
    startStableKey: annotation.startStableKey,
    endStableKey: annotation.endStableKey,
    anchorPrefix: annotation.anchorPrefix,
    anchorSuffix: annotation.anchorSuffix,
    anchorStatus: 'stale',
    anchorScore: 0,
  }
}

export function resolveReboundAnchorForTesting(
  annotation: Pick<
    Annotation,
    | 'anchorPrefix'
    | 'anchorSuffix'
    | 'anchorScore'
    | 'anchorStatus'
    | 'endOffset'
    | 'endParagraphId'
    | 'endStableKey'
    | 'paragraphId'
    | 'selectedText'
    | 'startOffset'
    | 'startStableKey'
  >,
  previousParagraphs: Paragraph[],
  nextParagraphs: Paragraph[],
): ResolvedAnchor {
  const exactStableAnchor = resolveExactStableKeyAnchor(annotation as Annotation, previousParagraphs, nextParagraphs)
  if (exactStableAnchor && validateResolvedAnchor(nextParagraphs, annotation as Annotation, exactStableAnchor)) {
    return exactStableAnchor
  }

  const exactTextAnchor = resolveExactTextAnchor(annotation as Annotation, previousParagraphs, nextParagraphs)
  if (exactTextAnchor) {
    return exactTextAnchor
  }

  const approximateAnchor = resolveApproximateAnchor(annotation as Annotation, previousParagraphs, nextParagraphs)
  if (approximateAnchor) {
    return approximateAnchor
  }

  return buildStaleAnchor(annotation as Annotation)
}

async function rebindVariantAnnotations(
  store: RevisionStore,
  params: {
    variant: ChapterVariant
    previousHeadRevision: ChapterVariantRevision
    previousParagraphs: Paragraph[]
    nextHeadRevision: ChapterVariantRevision
    nextParagraphs: Paragraph[]
  },
): Promise<void> {
  const anchoredAnnotations = await store.annotation.findMany({
    where: {
      chapterVariantId: params.variant.id,
      status: 'active',
      OR: [
        { paragraphId: { not: null } },
        { startStableKey: { not: null } },
      ],
    },
  })

  for (const annotation of anchoredAnnotations) {
    const exactStableAnchor = resolveExactStableKeyAnchor(
      annotation,
      params.previousParagraphs,
      params.nextParagraphs,
    )
    const exactStableAnchorIsValid = exactStableAnchor
      ? validateResolvedAnchor(params.nextParagraphs, annotation, exactStableAnchor)
      : false
    const exactTextAnchor = exactStableAnchorIsValid
      ? exactStableAnchor
      : resolveExactTextAnchor(annotation, params.previousParagraphs, params.nextParagraphs)
    const approximateAnchor = exactTextAnchor
      ? exactTextAnchor
      : resolveApproximateAnchor(annotation, params.previousParagraphs, params.nextParagraphs)
    const resolvedAnchor = approximateAnchor || buildStaleAnchor(annotation)

    await store.annotation.update({
      where: { id: annotation.id },
      data: {
        sourceRevisionId: annotation.sourceRevisionId || params.previousHeadRevision.id,
        resolvedRevisionId: resolvedAnchor.anchorStatus === 'stale' ? null : params.nextHeadRevision.id,
        paragraphId: resolvedAnchor.paragraphId,
        endParagraphId: resolvedAnchor.endParagraphId,
        startOffset: resolvedAnchor.startOffset,
        endOffset: resolvedAnchor.endOffset,
        startStableKey: resolvedAnchor.startStableKey,
        endStableKey: resolvedAnchor.endStableKey,
        anchorPrefix: resolvedAnchor.anchorPrefix,
        anchorSuffix: resolvedAnchor.anchorSuffix,
        anchorStatus: resolvedAnchor.anchorStatus,
        anchorScore: resolvedAnchor.anchorScore,
      },
    })
  }
}

export async function saveChapterVariantRevision(
  store: RevisionStore,
  params: {
    chapterId: string
    variantType: string
    contentHtml: string
    editedByAuthor: boolean
    source: string
  },
): Promise<VariantRevisionSaveResult> {
  const existingVariant = await loadVariantForRevisionWrite(store, {
    chapterId: params.chapterId,
    variantType: params.variantType,
  })

  const variant = existingVariant ?? await store.chapterVariant.create({
    data: {
      chapterId: params.chapterId,
      variantType: params.variantType,
      contentHtml: '',
      editedByAuthor: params.editedByAuthor,
    },
  })

  const existingRevisionState = existingVariant
    ? await ensureHeadRevisionForVariant(store, variant)
    : null
  const previousHeadRevision = existingRevisionState?.headRevision || null
  const previousParagraphs = existingRevisionState?.paragraphs || []
  const nextParagraphInputs = assignParagraphStableKeys(previousParagraphs, buildParagraphInputsFromHtml(params.contentHtml))
  const nextRevision = await store.chapterVariantRevision.create({
    data: {
      chapterVariantId: variant.id,
      revisionNumber: previousHeadRevision ? previousHeadRevision.revisionNumber + 1 : 1,
      parentRevisionId: previousHeadRevision?.id || null,
      contentHtml: params.contentHtml,
      source: params.source,
    },
  })

  if (nextParagraphInputs.length > 0) {
    await store.chapterVariantRevisionParagraph.createMany({
      data: nextParagraphInputs.map((paragraph) => ({
        revisionId: nextRevision.id,
        stableKey: paragraph.stableKey,
        position: paragraph.position,
        text: paragraph.text,
      })),
    })
  }

  const persistedVariant = await store.chapterVariant.update({
    where: { id: variant.id },
    data: {
      contentHtml: params.contentHtml,
      editedByAuthor: params.editedByAuthor,
      headRevisionId: nextRevision.id,
    },
  })
  const nextParagraphs = await syncVariantParagraphs(store, variant.id, nextParagraphInputs)

  if (previousHeadRevision) {
    await rebindVariantAnnotations(store, {
      variant: persistedVariant,
      previousHeadRevision,
      previousParagraphs,
      nextHeadRevision: nextRevision,
      nextParagraphs,
    })
  }

  return {
    variant: persistedVariant,
    headRevision: nextRevision,
    paragraphs: nextParagraphs,
  }
}

export async function restoreChapterVariantRevision(
  store: RevisionStore,
  params: {
    chapterId: string
    variantType: string
    revisionId: string
  },
): Promise<VariantRevisionSaveResult> {
  const revision = await store.chapterVariantRevision.findUnique({
    where: { id: params.revisionId },
  })

  if (!revision) {
    throw new Error('Revision not found')
  }

  const variant = await loadVariantForRevisionWrite(store, {
    chapterId: params.chapterId,
    variantType: params.variantType,
  })

  if (!variant || variant.id !== revision.chapterVariantId) {
    throw new Error('Revision does not belong to requested variant')
  }

  return saveChapterVariantRevision(store, {
    chapterId: params.chapterId,
    variantType: params.variantType,
    contentHtml: revision.contentHtml,
    editedByAuthor: true,
    source: 'restore',
  })
}

export async function listVariantRevisionHistory(
  store: RevisionStore,
  params: { chapterId: string; variantType: string },
): Promise<ChapterVariantRevision[]> {
  const variant = await loadVariantForRevisionWrite(store, params)
  if (!variant) {
    return []
  }

  await ensureHeadRevisionForVariant(store, variant)

  return store.chapterVariantRevision.findMany({
    where: {
      chapterVariantId: variant.id,
    },
    orderBy: { revisionNumber: 'desc' },
  })
}

export async function getVariantRevisionDetails(
  store: RevisionStore,
  params: { chapterId: string; variantType: string; revisionId: string },
): Promise<(ChapterVariantRevision & { paragraphs: Array<{ stableKey: string; position: number; text: string }> }) | null> {
  const variant = await loadVariantForRevisionWrite(store, {
    chapterId: params.chapterId,
    variantType: params.variantType,
  })
  if (!variant) {
    return null
  }

  await ensureHeadRevisionForVariant(store, variant)

  return store.chapterVariantRevision.findFirst({
    where: {
      id: params.revisionId,
      chapterVariantId: variant.id,
    },
    include: {
      paragraphs: {
        select: {
          stableKey: true,
          position: true,
          text: true,
        },
        orderBy: { position: 'asc' },
      },
    },
  })
}

export async function resolveAnnotationVariantContext(
  store: RevisionStore,
  params: {
    chapterVariantId?: string | null
    chapterId?: string | null
    variantType?: string | null
  },
): Promise<(ChapterVariant & { paragraphs: Paragraph[] }) | null> {
  let variant: ChapterVariant | null = null

  if (params.chapterVariantId) {
    variant = await store.chapterVariant.findUnique({
      where: { id: params.chapterVariantId },
    })
  } else if (params.chapterId && params.variantType) {
    variant = await store.chapterVariant.findUnique({
      where: {
        chapterId_variantType: {
          chapterId: params.chapterId,
          variantType: params.variantType,
        },
      },
    })
  }

  if (!variant) {
    return null
  }

  await ensureHeadRevisionForVariant(store, variant)
  const paragraphs = await ensureVariantParagraphs(store, variant.id, variant.contentHtml)

  return {
    ...variant,
    paragraphs,
  }
}

export function buildAnnotationAnchorFromSelection(
  variant: ChapterVariant & { headRevisionId: string | null; paragraphs: Paragraph[] },
  rawSelection: Partial<{
    paragraphId: string | null
    endParagraphId: string | null
    startOffset: number | null
    endOffset: number | null
    selectedText: string | null
  }>,
): (ReturnType<typeof buildAnnotationSelection> & {
  sourceRevisionId: string | null
  resolvedRevisionId: string | null
  startStableKey: string | null
  endStableKey: string | null
  anchorPrefix: string | null
  anchorSuffix: string | null
  anchorStatus: AnnotationAnchorStatus
  anchorScore: number
}) {
  const selection = buildAnnotationSelection({
    paragraphId: rawSelection.paragraphId ?? undefined,
    endParagraphId: rawSelection.endParagraphId ?? undefined,
    startOffset: rawSelection.startOffset ?? undefined,
    endOffset: rawSelection.endOffset ?? undefined,
    selectedText: rawSelection.selectedText ?? undefined,
  })
  const startParagraph = variant.paragraphs.find((paragraph) => paragraph.id === selection.paragraphId) || null
  const endParagraph = variant.paragraphs.find((paragraph) => paragraph.id === selection.endParagraphId) || startParagraph
  const chapterIndex = buildChapterTextIndex(variant.paragraphs)
  const context = startParagraph && endParagraph
    ? buildSelectionContext(
        chapterIndex,
        startParagraph.id,
        endParagraph.id,
        selection.startOffset,
        selection.endOffset,
      )
    : null

  return {
    ...selection,
    selectedText: selection.selectedText || context?.selectedText || '',
    sourceRevisionId: variant.headRevisionId,
    resolvedRevisionId: variant.headRevisionId,
    startStableKey: startParagraph?.stableKey || null,
    endStableKey: endParagraph?.stableKey || startParagraph?.stableKey || null,
    anchorPrefix: context?.anchorPrefix || null,
    anchorSuffix: context?.anchorSuffix || null,
    anchorStatus: startParagraph ? 'exact' : 'stale',
    anchorScore: startParagraph ? 1 : 0,
  }
}
