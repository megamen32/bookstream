/**
 * Builds the per-chapter storage key used by the book reader.
 */
export function getBookReaderPageStorageKey(chapterId: string): string {
  return `bookstream-page-${chapterId}`
}

/**
 * Stores the page for a chapter in the provided storage backend.
 */
export function setBookReaderPage(
  storage: Pick<Storage, 'setItem'>,
  chapterId: string,
  page: number,
): void {
  storage.setItem(getBookReaderPageStorageKey(chapterId), String(page))
}

/**
 * Resolves the page to open when a chapter is mounted.
 *
 * The reader should always start from page 1 when there is no saved
 * progress for the chapter, and saved values must be clamped to the
 * current page count.
 */
export function resolveBookReaderPage(savedPage: string | null, totalPages: number): number {
  const parsedPage = savedPage ? Number.parseInt(savedPage, 10) : 1
  if (Number.isNaN(parsedPage)) {
    return 1
  }

  return Math.max(1, Math.min(parsedPage, Math.max(1, totalPages)))
}
