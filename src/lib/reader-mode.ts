import type { ReadingMode } from '@/lib/store'

export interface ResolveInitialReadingModeParams {
  bookDefaultMode: ReadingMode
  storedReadingMode: ReadingMode | null
  hasStoredReadingMode: boolean
  progressReadingMode?: ReadingMode | null
  forceBookMode?: boolean
}

/**
 * Resolves the initial reader mode for a book load.
 *
 * A manually selected mode stored on the client wins over older server-side
 * progress, because it reflects the most recent explicit user choice.
 * Quote-target links still force book mode.
 *
 * @param params Candidate sources for the initial mode.
 * @returns The mode that should be opened.
 */
export function resolveInitialReadingMode(params: ResolveInitialReadingModeParams): ReadingMode {
  if (params.forceBookMode) {
    return 'book'
  }

  if (params.hasStoredReadingMode && params.storedReadingMode) {
    return params.storedReadingMode
  }

  if (params.progressReadingMode) {
    return params.progressReadingMode
  }

  return params.bookDefaultMode
}
