import type { ReadingMode } from '@/lib/store'

export interface ResolveInitialReadingModeParams {
  bookDefaultMode: ReadingMode
  urlReadingMode: ReadingMode | null
  storedReadingMode: ReadingMode | null
  hasStoredReadingMode: boolean
  progressReadingMode?: ReadingMode | null
}

/**
 * Resolves the initial reader mode for a book load.
 *
 * A manually selected mode stored on the client wins over older server-side
 * progress, because it reflects the most recent explicit user choice.
 *
 * @param params Candidate sources for the initial mode.
 * @returns The mode that should be opened.
 */
export function resolveInitialReadingMode(params: ResolveInitialReadingModeParams): ReadingMode {
  if (params.urlReadingMode) {
    return params.urlReadingMode
  }

  if (params.hasStoredReadingMode && params.storedReadingMode) {
    return params.storedReadingMode
  }

  if (params.progressReadingMode) {
    return params.progressReadingMode
  }

  return params.bookDefaultMode
}
