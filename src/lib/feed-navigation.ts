export interface FeedSectionReference {
  chapter: {
    id: string
  }
  variant: {
    variantType: string
  }
}

/**
 * Determines whether the feed already has the exact chapter/variant pair in memory.
 *
 * When the target quote lives inside an already mounted feed slice, we can reuse
 * the existing sections instead of refetching the window and delaying the jump.
 *
 * @param sections Currently loaded feed sections.
 * @param chapterId Target chapter identifier.
 * @param variantType Target chapter variant.
 * @returns True when the active feed slice already contains the target section.
 */
export function shouldReuseLoadedFeedSection(
  sections: FeedSectionReference[],
  chapterId: string,
  variantType: string,
): boolean {
  return sections.some((section) => (
    section.chapter.id === chapterId && section.variant.variantType === variantType
  ))
}
