/**
 * Collects paragraph wrapper elements that belong to a selection or quote range.
 *
 * The reader keeps each paragraph in an `article[data-paragraph-id]` wrapper.
 * This helper returns the outer wrapper elements in DOM order so selection and
 * quote range highlighting can frame the entire block, not just the anchor
 * paragraph.
 */
export function collectParagraphRangeElements(
  container: ParentNode,
  startParagraphId: string,
  endParagraphId?: string | null,
): HTMLElement[] {
  const paragraphArticles = Array.from(
    container.querySelectorAll<HTMLElement>('[data-paragraph-id]'),
  )
  if (paragraphArticles.length === 0) {
    return []
  }

  const startIndex = paragraphArticles.findIndex(
    (element) => element.dataset.paragraphId === startParagraphId,
  )
  if (startIndex < 0) {
    return []
  }

  const resolvedEndParagraphId = endParagraphId || startParagraphId
  const endIndex = paragraphArticles.findIndex(
    (element) => element.dataset.paragraphId === resolvedEndParagraphId,
  )
  if (endIndex < 0) {
    return []
  }

  const [fromIndex, toIndex] =
    startIndex <= endIndex ? [startIndex, endIndex] : [endIndex, startIndex]

  return paragraphArticles.slice(fromIndex, toIndex + 1).map((article) => {
    const wrapper = article.parentElement
    return wrapper instanceof HTMLElement ? wrapper : article
  })
}
