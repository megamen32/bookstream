/**
 * Returns real items plus only as many synthetic items as needed to reach the requested minimum.
 *
 * @param items Items for one chapter.
 * @param minimumVisible Target minimum visible count.
 * @returns Filtered list with real items first preserved and synthetic items trimmed.
 */
export function limitSyntheticItems<T extends { isSynthetic: boolean }>(
  items: T[],
  minimumVisible: number,
): T[] {
  const realItems = items.filter((item) => !item.isSynthetic)
  if (realItems.length >= minimumVisible) {
    return realItems
  }

  const missing = Math.max(0, minimumVisible - realItems.length)
  const syntheticItems = items.filter((item) => item.isSynthetic).slice(0, missing)
  return [...realItems, ...syntheticItems]
}
