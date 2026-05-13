import type React from 'react'
import { parseBibliographicMarker } from '@/lib/books/annotations'

const BIBLIOGRAPHY_INLINE_MARKER_PATTERN = /\[(\d[\d\s,–—-]*)\]/g

/**
 * Renders plain text while preserving bibliographic markers as interactive spans.
 *
 * @param text Source text that may contain inline citation markers.
 * @param keyPrefix Stable prefix for generated React keys.
 * @returns Mixed text and marker nodes ready for JSX rendering.
 */
export function renderTextWithBibliographyMarkers(text: string, keyPrefix: string): React.ReactNode[] {
  const nodes: React.ReactNode[] = []
  let lastIndex = 0
  let match: RegExpExecArray | null
  let markerIndex = 0
  BIBLIOGRAPHY_INLINE_MARKER_PATTERN.lastIndex = 0

  while ((match = BIBLIOGRAPHY_INLINE_MARKER_PATTERN.exec(text)) !== null) {
    const markerText = match[0]
    const numericPart = match[1]
    if (match.index > lastIndex) {
      nodes.push(text.slice(lastIndex, match.index))
    }

    const itemNumbers = parseBibliographicMarker(`[${numericPart}]`)
    if (itemNumbers.length > 0) {
      nodes.push(
        <span
          key={`${keyPrefix}-bib-${markerIndex}`}
          className="book-annotation-marker book-bibliography-marker"
          data-annotation-type="bibliography"
          data-marker-text={markerText}
          data-bibliography-items={itemNumbers.join(',')}
        >
          {markerText}
        </span>,
      )
      markerIndex += 1
    } else {
      nodes.push(markerText)
    }

    lastIndex = match.index + markerText.length
  }

  if (lastIndex < text.length) {
    nodes.push(text.slice(lastIndex))
  }

  return nodes
}

/**
 * Resolves the cited source numbers from a rendered marker element.
 *
 * @param element Marker DOM element.
 * @returns Parsed source numbers.
 */
export function resolveBibliographyMarkerNumbers(element: HTMLElement): number[] {
  const serialized = element.dataset.bibliographyItems?.trim()
  if (serialized) {
    return serialized
      .split(',')
      .map((part) => Number.parseInt(part.trim(), 10))
      .filter((value) => Number.isFinite(value))
  }

  const markerText = element.dataset.markerText || element.textContent || ''
  return parseBibliographicMarker(markerText)
}
