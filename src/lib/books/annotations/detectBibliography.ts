import type {
  BibliographyDetectionResult,
  BibliographyItem,
  BibliographyDetectionConfidence,
} from './types'

const BIBLIOGRAPHY_HEADINGS = new Set([
  'литература',
  'список литературы',
  'использованная литература',
  'список использованной литературы',
  'библиография',
  'references',
  'bibliography',
  'works cited',
  'literature',
])

interface BlockSegment {
  index: number
  start: number
  end: number
  tagName: string
  id: string | null
  text: string
  html: string
}

interface DetectedSection {
  startBlockIndex: number
  endBlockIndex: number
  confidence: BibliographyDetectionConfidence
  bibliographySectionId?: string
}

/**
 * Detects a bibliography section and extracts numbered items from it.
 *
 * The detector prefers explicit headings, then falls back to a tail heuristic
 * that accepts a contiguous numbered block at the end of the document.
 *
 * @param html Full chapter or book HTML.
 * @returns Bibliography items and detection confidence.
 */
export function detectBibliography(html: string): BibliographyDetectionResult {
  const blocks = extractBlockSegments(html)
  const section = findBibliographySection(blocks)

  if (!section) {
    return {
      items: [],
      confidence: 'none',
    }
  }

  const items = extractBibliographyItems(blocks.slice(section.startBlockIndex, section.endBlockIndex + 1))

  return {
    items,
    bibliographySectionId: section.bibliographySectionId,
    confidence: section.confidence,
  }
}

function findBibliographySection(blocks: BlockSegment[]): DetectedSection | null {
  const headingIndex = blocks.findIndex((block) => isBibliographyHeading(block.text))
  if (headingIndex >= 0) {
    const trailingBlocks = blocks.slice(headingIndex + 1)
    const items = extractBibliographyItems(trailingBlocks)
    if (items.length >= 2) {
      return {
        startBlockIndex: headingIndex,
        endBlockIndex: blocks.length - 1,
        confidence: 'heading',
        bibliographySectionId: blocks[headingIndex]?.id || `bibliography-${headingIndex}`,
      }
    }
  }

  const tailCandidate = findTailBibliographyCandidate(blocks)
  return tailCandidate
}

function findTailBibliographyCandidate(blocks: BlockSegment[]): DetectedSection | null {
  let lastItemIndex = -1

  for (let index = blocks.length - 1; index >= 0; index -= 1) {
    if (parseBibliographyItemStart(blocks[index]?.text)) {
      lastItemIndex = index
      break
    }
  }

  if (lastItemIndex < 0) {
    return null
  }

  let startIndex = lastItemIndex
  while (startIndex > 0) {
    const previous = blocks[startIndex - 1]
    if (!previous) {
      break
    }

    if (previous.text.trim().length === 0) {
      startIndex -= 1
      continue
    }

    if (isBibliographyHeading(previous.text)) {
      startIndex -= 1
      break
    }

    if (parseBibliographyItemStart(previous.text)) {
      startIndex -= 1
      continue
    }

    break
  }

  const candidateBlocks = blocks.slice(startIndex)
  const items = extractBibliographyItems(candidateBlocks)
  if (items.length < 3) {
    return null
  }

  const consumedAllBlocks = candidateBlocks.every((block) => {
    const text = block.text.trim()
    return text.length === 0 || parseBibliographyItemStart(text) !== null
  })

  if (!consumedAllBlocks) {
    return null
  }

  return {
    startBlockIndex: startIndex,
    endBlockIndex: blocks.length - 1,
    confidence: 'tail-heuristic',
    bibliographySectionId: blocks[startIndex]?.id || `bibliography-${startIndex}`,
  }
}

function extractBibliographyItems(blocks: BlockSegment[]): BibliographyItem[] {
  const items: BibliographyItem[] = []
  let currentItem: BibliographyItem | null = null

  for (const block of blocks) {
    const text = normalizeWhitespace(block.text)
    if (!text) {
      continue
    }

    const itemMatch = parseBibliographyItemStart(text)
    if (itemMatch) {
      currentItem = {
        number: itemMatch.number,
        rawText: itemMatch.remainder,
        normalizedText: normalizeWhitespace(itemMatch.remainder),
      }
      items.push(currentItem)
      continue
    }

    if (!currentItem) {
      continue
    }

    currentItem.rawText = `${currentItem.rawText}\n${text}`.trim()
    currentItem.normalizedText = normalizeWhitespace(currentItem.rawText)
  }

  return dedupeItems(items)
}

function dedupeItems(items: BibliographyItem[]): BibliographyItem[] {
  const merged = new Map<number, BibliographyItem>()
  for (const item of items) {
    merged.set(item.number, item)
  }

  return Array.from(merged.values()).sort((left, right) => left.number - right.number)
}

function parseBibliographyItemStart(text: string): { number: number; remainder: string } | null {
  const match = text.match(/^(\d+)\s*[.)]?\s+([\s\S]+)$/)
  if (!match) {
    return null
  }

  const number = Number.parseInt(match[1], 10)
  if (!Number.isFinite(number)) {
    return null
  }

  return {
    number,
    remainder: match[2].trim(),
  }
}

export function isBibliographyHeading(text: string): boolean {
  const normalized = normalizeHeading(text)
  return normalized ? BIBLIOGRAPHY_HEADINGS.has(normalized) : false
}

function normalizeHeading(value: string): string {
  return normalizeWhitespace(value)
    .toLowerCase()
    .replace(/[.:;]+$/g, '')
}

function normalizeWhitespace(value: string): string {
  return value.replace(/\s+/g, ' ').trim()
}

function extractBlockSegments(html: string): BlockSegment[] {
  const blockPattern = /<(h[1-6]|p|div|li|blockquote)\b[^>]*>[\s\S]*?<\/\1>/gi
  const blocks: BlockSegment[] = []

  let match: RegExpExecArray | null
  let index = 0
  while ((match = blockPattern.exec(html)) !== null) {
    const raw = match[0]
    blocks.push({
      index,
      start: match.index,
      end: match.index + raw.length,
      tagName: match[1].toLowerCase(),
      id: extractId(raw),
      text: stripHtml(raw),
      html: raw,
    })
    index += 1
  }

  return blocks
}

function extractId(html: string): string | null {
  const match = html.match(/\sid=(["'])(.*?)\1/i)
  return match?.[2] || null
}

function stripHtml(value: string): string {
  return value
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(?:p|div|li|blockquote|h[1-6])>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim()
}
