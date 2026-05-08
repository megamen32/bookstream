export interface ReaderLocationQueryParams {
  paragraph: string | null
  paragraphEnd: string | null
  startOffsetRaw: string | null
  endOffsetRaw: string | null
}

export interface ReaderLocationState {
  chapterId: string
  variantType: string
  readingMode: string
  paragraphId: string | null
  paragraphEndId: string | null
  startOffset: number | null
  endOffset: number | null
}

/**
 * Builds the canonical reader query string from the current in-memory location.
 *
 * @param state Active reader location.
 * @returns Query string without the leading question mark.
 */
export function buildReaderLocationSearch(state: ReaderLocationState): string {
  const params = new URLSearchParams()
  params.set('chapter', state.chapterId)
  params.set('variant', state.variantType)
  params.set('mode', state.readingMode)
  const hasParagraphAnchor = Boolean(state.paragraphId || state.paragraphEndId)

  if (state.paragraphId) {
    params.set('paragraph', state.paragraphId)
  }

  if (state.paragraphEndId) {
    params.set('paragraphEnd', state.paragraphEndId)
  }

  if (hasParagraphAnchor && Number.isFinite(state.startOffset)) {
    params.set('startOffset', String(state.startOffset))
  }

  if (hasParagraphAnchor && Number.isFinite(state.endOffset)) {
    params.set('endOffset', String(state.endOffset))
  }

  return params.toString()
}

/**
 * Resolves which search string the reader should trust.
 *
 * Next's `useSearchParams()` can lag behind `window.history.replaceState()`.
 * When that happens, the real browser URL is the source of truth.
 *
 * @param hookSearch Query string returned by `useSearchParams()`.
 * @param windowSearch Current `window.location.search` value.
 * @returns Normalized query string without the leading question mark.
 */
export function resolveReaderLocationSearch(hookSearch: string, windowSearch: string): string {
  const normalizedWindowSearch = windowSearch.startsWith('?')
    ? windowSearch.slice(1)
    : windowSearch

  if (normalizedWindowSearch && normalizedWindowSearch !== hookSearch) {
    return normalizedWindowSearch
  }

  return hookSearch
}
