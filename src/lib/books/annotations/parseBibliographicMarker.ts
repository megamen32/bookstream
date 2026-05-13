/**
 * Parses a bibliographic marker like "[1, 3-5, 14]" into a sorted list of
 * unique source numbers.
 *
 * The parser accepts ASCII hyphen, en dash, and em dash as range separators and
 * degrades to an empty array for malformed input.
 *
 * @param marker Raw marker text including square brackets.
 * @returns Sorted unique source numbers.
 */
export function parseBibliographicMarker(marker: string): number[] {
  if (typeof marker !== 'string') {
    return []
  }

  const trimmed = marker.trim()
  if (!trimmed.startsWith('[') || !trimmed.endsWith(']')) {
    return []
  }

  const inner = trimmed.slice(1, -1).trim()
  if (!inner) {
    return []
  }

  const values = new Set<number>()
  const parts = inner.split(',').map((part) => part.trim()).filter(Boolean)

  for (const part of parts) {
    const rangeMatch = part.match(/^(\d+)\s*[-–—]\s*(\d+)$/)
    if (rangeMatch) {
      const start = Number.parseInt(rangeMatch[1], 10)
      const end = Number.parseInt(rangeMatch[2], 10)
      if (!Number.isFinite(start) || !Number.isFinite(end)) {
        continue
      }

      const from = Math.min(start, end)
      const to = Math.max(start, end)
      for (let number = from; number <= to; number += 1) {
        values.add(number)
      }
      continue
    }

    const singleMatch = part.match(/^(\d+)$/)
    if (!singleMatch) {
      continue
    }

    const value = Number.parseInt(singleMatch[1], 10)
    if (Number.isFinite(value)) {
      values.add(value)
    }
  }

  return Array.from(values).sort((left, right) => left - right)
}

