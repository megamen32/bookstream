import { detectBibliography, isBibliographyHeading } from './detectBibliography'
import { parseBibliographicMarker } from './parseBibliographicMarker'
import type {
  BibliographicAnnotationDiagnostics,
  BibliographicAnnotationMarker,
  BibliographyItem,
  TransformBibliographicAnnotationsResult,
} from './types'

interface HtmlTokenContext {
  tagName: string | null
  skipMarkerParsing: boolean
}

const BIBLIOGRAPHY_MARKER_PATTERN = /\[(\d[\d\s,–—-]*)\]/g
const SKIPPED_TAGS = new Set(['a', 'code', 'pre', 'script', 'style', 'textarea'])

/**
 * Detects bibliography items, removes the bibliography tail from the visible
 * HTML, and wraps inline citation markers with interactive spans.
 *
 * @param html Chapter HTML to transform.
 * @returns Transformed HTML, extracted bibliography items, and diagnostics.
 */
export function transformBibliographicAnnotations(html: string): TransformBibliographicAnnotationsResult {
  const detection = detectBibliography(html)
  const strippedHtml = detection.items.length > 0 && detection.bibliographySectionId
    ? stripBibliographySection(html, detection.bibliographySectionId, detection.items)
    : html

  const markerState = {
    annotations: [] as BibliographicAnnotationMarker[],
    unresolvedMarkersCount: 0,
  }
  const transformedHtml = detection.items.length > 0
    ? wrapBibliographicMarkers(strippedHtml, detection.items, markerState)
    : strippedHtml

  const diagnostics: BibliographicAnnotationDiagnostics = {
    bibliographyDetected: detection.items.length > 0,
    detectionMethod: detection.confidence,
    bibliographyItemsCount: detection.items.length,
    annotationMarkersCount: markerState.annotations.length,
    unresolvedMarkersCount: markerState.unresolvedMarkersCount,
  }

  return {
    html: transformedHtml,
    items: detection.items,
    bibliographySectionId: detection.bibliographySectionId,
    annotations: markerState.annotations,
    diagnostics,
  }
}

/**
 * Extracts citation markers from HTML without changing the content.
 *
 * @param html HTML fragment to inspect.
 * @returns Ordered marker number lists extracted from inline markers.
 */
export function extractBibliographicMarkerNumbers(html: string): number[][] {
  const markers: number[][] = []
  const tokens = html.match(/<!--[\s\S]*?-->|<\/?[a-zA-Z][^>]*>|[^<]+/g) || []
  const stack: HtmlTokenContext[] = []

  for (const token of tokens) {
    if (token.startsWith('<!--')) {
      continue
    }

    if (token.startsWith('</')) {
      const tagName = token.match(/^<\/\s*([a-zA-Z0-9-]+)/)?.[1]?.toLowerCase() || null
      while (stack.length > 0) {
        const top = stack.pop()
        if (top?.tagName === tagName) {
          break
        }
      }
      continue
    }

    if (token.startsWith('<')) {
      const tagName = token.match(/^<\s*([a-zA-Z0-9-]+)/)?.[1]?.toLowerCase() || null
      const selfClosing = /\/\s*>$/.test(token)
      const skipMarkerParsing = Boolean(
        tagName && (
          SKIPPED_TAGS.has(tagName)
          || isBibliographyMarkerSpan(token)
        ),
      )

      if (!selfClosing) {
        stack.push({ tagName, skipMarkerParsing })
      }
      continue
    }

    if (stack.some((entry) => entry.skipMarkerParsing)) {
      continue
    }

    token.replace(BIBLIOGRAPHY_MARKER_PATTERN, (markerText, numericPart: string) => {
      const itemNumbers = parseBibliographicMarker(`[${numericPart}]`)
      if (itemNumbers.length > 0) {
        markers.push(itemNumbers)
      }
      return markerText
    })
  }

  return markers
}

function stripBibliographySection(
  html: string,
  bibliographySectionId: string,
  items: BibliographyItem[],
): string {
  if (items.length === 0) {
    return html
  }

  const blockPattern = /<(h[1-6]|p|div|li|blockquote)\b[^>]*>[\s\S]*?<\/\1>/gi
  const blocks: Array<{ start: number; end: number; html: string; text: string; id: string | null }> = []

  let match: RegExpExecArray | null
  while ((match = blockPattern.exec(html)) !== null) {
    const raw = match[0]
    blocks.push({
      start: match.index,
      end: match.index + raw.length,
      html: raw,
      text: stripHtml(raw),
      id: extractId(raw),
    })
  }

  const headingIndex = blocks.findIndex((block) => block.id === bibliographySectionId || isBibliographyHeading(block.text))
  const itemStartIndex = headingIndex >= 0 ? headingIndex : findFirstBibliographyItemBlockIndex(blocks)
  if (itemStartIndex < 0) {
    return html
  }

  const start = blocks[Math.min(headingIndex >= 0 ? headingIndex : itemStartIndex, itemStartIndex)]?.start
  if (typeof start !== 'number') {
    return html
  }

  return html.slice(0, start).trimEnd()
}

function findFirstBibliographyItemBlockIndex(
  blocks: Array<{ text: string }>,
): number {
  for (let index = 0; index < blocks.length; index += 1) {
    if (/^\s*\d+\s*[.)]?\s+/.test(blocks[index].text)) {
      return index
    }
  }

  return -1
}

function wrapBibliographicMarkers(
  html: string,
  bibliographyItems: BibliographyItem[],
  state: { annotations: BibliographicAnnotationMarker[]; unresolvedMarkersCount: number },
): string {
  const itemNumbersByMarker = new Map<number, BibliographyItem>()
  for (const item of bibliographyItems) {
    itemNumbersByMarker.set(item.number, item)
  }

  const tokens = html.match(/<!--[\s\S]*?-->|<\/?[a-zA-Z][^>]*>|[^<]+/g) || []
  const stack: HtmlTokenContext[] = []
  const rendered: string[] = []
  let markerIndex = 0

  for (const token of tokens) {
    if (token.startsWith('<!--')) {
      rendered.push(token)
      continue
    }

    if (token.startsWith('</')) {
      const tagName = token.match(/^<\/\s*([a-zA-Z0-9-]+)/)?.[1]?.toLowerCase() || null
      while (stack.length > 0) {
        const top = stack.pop()
        if (top?.tagName === tagName) {
          break
        }
      }
      rendered.push(token)
      continue
    }

    if (token.startsWith('<')) {
      const tagName = token.match(/^<\s*([a-zA-Z0-9-]+)/)?.[1]?.toLowerCase() || null
      const selfClosing = /\/\s*>$/.test(token)
      const skipMarkerParsing = Boolean(
        tagName && (
          SKIPPED_TAGS.has(tagName)
          || isBibliographyMarkerSpan(token)
        ),
      )

      if (!selfClosing) {
        stack.push({ tagName, skipMarkerParsing })
      }

      rendered.push(token)
      continue
    }

    const currentSkip = stack.some((entry) => entry.skipMarkerParsing)
    if (currentSkip) {
      rendered.push(token)
      continue
    }

    rendered.push(
      token.replace(BIBLIOGRAPHY_MARKER_PATTERN, (markerText, numericPart: string) => {
        const itemNumbers = parseBibliographicMarker(`[${numericPart}]`)
        if (itemNumbers.length === 0) {
          return markerText
        }

        const missingNumbers = itemNumbers.filter((number) => !itemNumbersByMarker.has(number))
        if (missingNumbers.length > 0) {
          state.unresolvedMarkersCount += 1
        }

        const annotationId = `bibliography-marker-${markerIndex += 1}`
        state.annotations.push({
          id: annotationId,
          markerText,
          itemNumbers,
        })

        return createMarkerSpan(markerText, itemNumbers, annotationId)
      }),
    )
  }

  return rendered.join('')
}

function createMarkerSpan(markerText: string, itemNumbers: number[], annotationId: string): string {
  return [
    '<span',
    ' class="book-annotation-marker book-bibliography-marker"',
    ' data-annotation-type="bibliography"',
    ` data-annotation-id="${escapeAttribute(annotationId)}"`,
    ` data-marker-text="${escapeAttribute(markerText)}"`,
    ` data-bibliography-items="${escapeAttribute(itemNumbers.join(','))}"`,
    '>',
    markerText,
    '</span>',
  ].join('')
}

function isBibliographyMarkerSpan(token: string): boolean {
  return /data-annotation-type\s*=\s*["']bibliography["']/i.test(token)
    || /book-bibliography-marker/i.test(token)
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

function escapeAttribute(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}
