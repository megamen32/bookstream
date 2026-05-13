/**
 * Checks whether an HTML fragment contains content the reader can actually open.
 *
 * Empty structural headings should not be treated as readable chapters, but
 * embedded media and list/table blocks still count as readable content.
 *
 * @param contentHtml Imported chapter HTML.
 * @returns `true` when the fragment has readable content.
 */
export function hasReadableHtmlContent(contentHtml: string): boolean {
  const normalizedText = contentHtml
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  if (normalizedText.length > 0) {
    return true
  }

  return /<(img|table|blockquote|hr|ul|ol|pre|video|iframe)\b/i.test(contentHtml)
}
