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
 * Stores a sentinel page value so the next mount opens the chapter on its last page.
 *
 * The reader clamps saved values to the available range, so a very large page
 * number is a deliberate signal to resume from the end of the chapter.
 */
export function setBookReaderPageToLastPage(
  storage: Pick<Storage, 'setItem'>,
  chapterId: string,
): void {
  storage.setItem(getBookReaderPageStorageKey(chapterId), String(Number.MAX_SAFE_INTEGER))
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

/**
 * Resolves the overall book progress as a percentage.
 *
 * The reader stores chapter progress independently, so the visible book-level
 * progress is derived from the current chapter index and the in-chapter fraction.
 */
export function resolveBookProgressPercent(
  chapterIndex: number,
  chapterProgress: number,
  totalChapters: number,
): number {
  if (!Number.isFinite(chapterIndex) || !Number.isFinite(chapterProgress) || !Number.isFinite(totalChapters)) {
    return 0
  }

  const safeTotalChapters = Math.max(1, Math.floor(totalChapters))
  const safeChapterIndex = Math.min(Math.max(0, Math.floor(chapterIndex)), safeTotalChapters - 1)
  const safeChapterProgress = Math.min(Math.max(chapterProgress, 0), 1)

  return Math.round(((safeChapterIndex + safeChapterProgress) / safeTotalChapters) * 100)
}
