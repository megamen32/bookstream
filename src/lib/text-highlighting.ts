export interface TextRange {
  start: number
  end: number
}

export interface TextSegment {
  text: string
  highlighted: boolean
}

/**
 * Merges overlapping or touching ranges so the renderer can paint one clean
 * highlight per visual fragment.
 */
export function mergeTextRanges(ranges: TextRange[]): TextRange[] {
  const normalized = ranges
    .map((range) => ({
      start: Math.max(0, Math.min(range.start, range.end)),
      end: Math.max(0, Math.max(range.start, range.end)),
    }))
    .filter((range) => range.end > range.start)
    .sort((a, b) => a.start - b.start || a.end - b.end)

  const merged: TextRange[] = []
  for (const range of normalized) {
    const last = merged[merged.length - 1]
    if (!last || range.start > last.end) {
      merged.push({ ...range })
      continue
    }
    last.end = Math.max(last.end, range.end)
  }

  return merged
}

/**
 * Splits a paragraph string into highlighted and plain segments.
 */
export function splitTextByRanges(text: string, ranges: TextRange[]): TextSegment[] {
  if (text.length === 0 || ranges.length === 0) {
    return [{ text, highlighted: false }]
  }

  const merged = mergeTextRanges(ranges)
  const segments: TextSegment[] = []
  let cursor = 0

  for (const range of merged) {
    const start = Math.max(0, Math.min(range.start, text.length))
    const end = Math.max(0, Math.min(range.end, text.length))

    if (start > cursor) {
      segments.push({ text: text.slice(cursor, start), highlighted: false })
    }

    if (end > start) {
      segments.push({ text: text.slice(start, end), highlighted: true })
    }

    cursor = Math.max(cursor, end)
  }

  if (cursor < text.length) {
    segments.push({ text: text.slice(cursor), highlighted: false })
  }

  return segments.length > 0 ? segments : [{ text, highlighted: false }]
}
