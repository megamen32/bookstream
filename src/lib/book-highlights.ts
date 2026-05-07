export type BookHighlightsSectionKey = 'comments' | 'quotes' | 'toc'

/**
 * Returns the items that should be visible for a highlights section.
 *
 * Compact mode shows only a short preview. When the section is active, all
 * items are visible so the expand action actually reveals the full list.
 */
export function getVisibleBookHighlights<T>(
  items: readonly T[],
  activeSection: BookHighlightsSectionKey | null,
  section: BookHighlightsSectionKey,
  previewLimit: number = 3,
): T[] {
  if (activeSection === section) {
    return [...items]
  }

  return [...items].slice(0, previewLimit)
}
