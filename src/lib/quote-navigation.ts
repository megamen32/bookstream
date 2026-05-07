export interface QuoteReadTarget {
  chapterId: string
  variantType: string
  paragraphId?: string | null
}

/**
 * Builds a reader URL that opens the target chapter and anchors the quote paragraph.
 *
 * @param authorSlug Author slug used in the public book route.
 * @param bookSlug Book slug used in the public book route.
 * @param target Quote location inside the reader.
 * @returns Public reader URL with query params for chapter, variant, and paragraph focus.
 */
export function buildQuoteReadHref(authorSlug: string, bookSlug: string, target: QuoteReadTarget): string {
  const params = new URLSearchParams({
    chapter: target.chapterId,
    variant: target.variantType,
  })

  if (target.paragraphId) {
    params.set('paragraph', target.paragraphId)
  }

  return `/${authorSlug}/${bookSlug}/read?${params.toString()}`
}

/**
 * Finds a paragraph node by its stable DOM data attribute.
 *
 * @param container Reader scroll container.
 * @param paragraphId Database paragraph id.
 * @returns The matching article element, if present.
 */
export function findQuoteParagraphElement(
  container: ParentNode,
  paragraphId: string,
): HTMLElement | null {
  return container.querySelector(`[data-paragraph-id="${paragraphId}"]`)
}

/**
 * Scrolls a target paragraph into view with a centered, quote-friendly offset.
 *
 * @param container Reader scroll container.
 * @param target Target paragraph element.
 */
export function scrollQuoteTargetIntoView(container: HTMLElement, target: HTMLElement): void {
  const containerRect = container.getBoundingClientRect()
  const targetRect = target.getBoundingClientRect()
  const topOffset = targetRect.top - containerRect.top
  const destination = container.scrollTop + topOffset - container.clientHeight * 0.28
  const maxScrollTop = Math.max(0, container.scrollHeight - container.clientHeight)
  const nextScrollTop = Math.min(Math.max(0, destination), maxScrollTop)

  container.scrollTo({
    top: nextScrollTop,
    behavior: 'smooth',
  })
}
