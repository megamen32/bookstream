import { buildQuoteReadHref } from './quote-navigation.ts'

export interface QuoteShareRequest {
  authorSlug: string
  bookSlug: string
  chapterId: string
  variantType: string
  paragraphStart: string
  paragraphEnd: string
  startOffset: number
  endOffset: number
  readingMode: string
  quoteText: string
  createQuoteCardsOnCopy: boolean
}

export interface QuoteCardPayload {
  authorSlug: string
  bookSlug: string
  chapterId: string
  variantType: string
  readingMode: string
  paragraphStart: string
  paragraphEnd: string | null
  startOffset: number
  endOffset: number
  quoteText: string
}

export interface QuoteCardCreationResult {
  publicUrl: string
}

export interface QuoteShareDependencies {
  origin: string
  copyToClipboard: (value: string) => Promise<void>
  createQuoteCard: (payload: QuoteCardPayload) => Promise<QuoteCardCreationResult>
}

export interface QuoteShareResult {
  technicalUrl: string
  publicUrl: string | null
  createdQuoteCard: boolean
}

function buildTechnicalQuoteUrl(request: QuoteShareRequest, origin: string): string {
  const href = buildQuoteReadHref(request.authorSlug, request.bookSlug, {
    chapterId: request.chapterId,
    variantType: request.variantType,
    paragraphId: request.paragraphStart,
    paragraphEndId: request.paragraphEnd,
    startOffset: request.startOffset,
    endOffset: request.endOffset,
  })

  return new URL(href, origin).toString()
}

/**
 * Copies a quote link and optionally creates a public share card.
 *
 * @param request Quote selection and user preference.
 * @param dependencies Clipboard and card-creation hooks.
 * @returns The technical URL and, when enabled, the public card URL.
 */
export async function shareQuoteSelection(
  request: QuoteShareRequest,
  dependencies: QuoteShareDependencies,
): Promise<QuoteShareResult> {
  const technicalUrl = buildTechnicalQuoteUrl(request, dependencies.origin)
  await dependencies.copyToClipboard(technicalUrl)

  if (!request.createQuoteCardsOnCopy) {
    return {
      technicalUrl,
      publicUrl: null,
      createdQuoteCard: false,
    }
  }

  const quoteCard = await dependencies.createQuoteCard({
    authorSlug: request.authorSlug,
    bookSlug: request.bookSlug,
    chapterId: request.chapterId,
    variantType: request.variantType,
    readingMode: request.readingMode,
    paragraphStart: request.paragraphStart,
    paragraphEnd: request.paragraphEnd || null,
    startOffset: request.startOffset,
    endOffset: request.endOffset,
    quoteText: request.quoteText,
  })

  await dependencies.copyToClipboard(quoteCard.publicUrl)

  return {
    technicalUrl,
    publicUrl: quoteCard.publicUrl,
    createdQuoteCard: true,
  }
}
