import { buildQuoteReadHref } from './quote-navigation.ts'
import { buildAbsoluteUrl } from './site-url.ts'

export interface BookMomentRecord {
  id: string
  authorSlug: string
  bookSlug: string
  bookId: string
  chapterId: string
  variantType: string
  readingMode: string
  paragraphStart: string
  paragraphEnd: string | null
  startOffset: number
  endOffset: number
  quoteText: string
  createdAt: Date | string
}

export interface PublicBookMoment extends Omit<BookMomentRecord, 'createdAt'> {
  createdAt: string
}

/**
 * Builds the canonical public path for a book.
 *
 * @param authorSlug Public author slug.
 * @param bookSlug Public book slug.
 * @returns Canonical public book path.
 */
export function buildPublicBookPath(authorSlug: string, bookSlug: string): string {
  return `/${authorSlug}/${bookSlug}`
}

/**
 * Builds the canonical public path for a moment.
 *
 * @param authorSlug Public author slug.
 * @param bookSlug Public book slug.
 * @param momentId Stable moment id.
 * @returns Canonical public moment path.
 */
export function buildPublicMomentPath(authorSlug: string, bookSlug: string, momentId: string): string {
  return `${buildPublicBookPath(authorSlug, bookSlug)}/moments/${momentId}`
}

/**
 * Resolves the absolute canonical URL for a book.
 *
 * @param authorSlug Public author slug.
 * @param bookSlug Public book slug.
 * @returns Absolute public book URL.
 */
export function buildPublicBookUrl(authorSlug: string, bookSlug: string): string {
  return buildAbsoluteUrl(buildPublicBookPath(authorSlug, bookSlug))
}

/**
 * Resolves the absolute canonical URL for a moment.
 *
 * @param authorSlug Public author slug.
 * @param bookSlug Public book slug.
 * @param momentId Stable moment id.
 * @returns Absolute public moment URL.
 */
export function buildPublicMomentUrl(authorSlug: string, bookSlug: string, momentId: string): string {
  return buildAbsoluteUrl(buildPublicMomentPath(authorSlug, bookSlug, momentId))
}

/**
 * Normalizes whitespace for shareable quote snippets.
 *
 * @param text Raw text selected by the reader.
 * @returns Condensed text without leading or trailing whitespace.
 */
export function normalizeShareText(text: string): string {
  return text.replace(/\s+/g, ' ').trim()
}

/**
 * Truncates a share snippet without cutting the sentence mid-word when possible.
 *
 * @param text Source text.
 * @param maxLength Maximum number of characters to keep.
 * @returns Truncated snippet with an ellipsis when needed.
 */
export function truncateShareText(text: string, maxLength: number): string {
  const normalized = normalizeShareText(text)
  if (normalized.length <= maxLength) {
    return normalized
  }

  const clipped = normalized.slice(0, maxLength).replace(/\s+\S*$/, '').trim()
  return `${clipped || normalized.slice(0, maxLength).trim()}…`
}

/**
 * Builds the internal reader href that opens a moment at its exact fragment.
 *
 * @param moment Public moment data.
 * @returns Internal reader URL used by the "Read in book" action.
 */
export function buildMomentReaderHref(moment: Pick<BookMomentRecord, 'authorSlug' | 'bookSlug' | 'chapterId' | 'variantType' | 'paragraphStart' | 'paragraphEnd' | 'startOffset' | 'endOffset'>): string {
  return buildQuoteReadHref(moment.authorSlug, moment.bookSlug, {
    chapterId: moment.chapterId,
    variantType: moment.variantType,
    paragraphId: moment.paragraphStart,
    paragraphEndId: moment.paragraphEnd || undefined,
    startOffset: moment.startOffset,
    endOffset: moment.endOffset,
  })
}

/**
 * Converts a stored moment row into a JSON-safe response payload.
 *
 * @param moment Database moment row.
 * @returns Serializable public moment object.
 */
export function serializeBookMoment(moment: BookMomentRecord): PublicBookMoment {
  return {
    ...moment,
    paragraphEnd: moment.paragraphEnd,
    createdAt: moment.createdAt instanceof Date
      ? moment.createdAt.toISOString()
      : moment.createdAt,
  }
}
