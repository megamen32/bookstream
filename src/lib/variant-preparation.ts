export interface VariantChapterReference {
  id: string
  isReadable?: boolean
}

/**
 * Returns the nearest readable chapters that should be prepared for the
 * currently selected text variant.
 */
export function buildNeighborVariantChapterIds<T extends VariantChapterReference>(params: {
  chapters: T[]
  activeChapterId: string
}): string[] {
  const readable = params.chapters.filter((chapter) => chapter.isReadable !== false)
  const activeIndex = readable.findIndex((chapter) => chapter.id === params.activeChapterId)
  if (activeIndex < 0) {
    return []
  }

  return [readable[activeIndex - 1]?.id, readable[activeIndex + 1]?.id]
    .filter((chapterId): chapterId is string => Boolean(chapterId))
}
