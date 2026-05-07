import { Prisma, type Paragraph } from '@prisma/client'
import { splitHtmlIntoParagraphs } from '@/lib/file-parser'

type ParagraphStore = Pick<Prisma.TransactionClient, 'paragraph'>

export interface SyncedParagraphInput {
  stableKey: string
  position: number
  text: string
}

/**
 * Converts stored chapter HTML into normalized paragraph records for the reader.
 *
 * @param contentHtml HTML saved for a chapter variant.
 * @returns Paragraph payloads ready for persistence.
 */
export function buildParagraphInputsFromHtml(contentHtml: string): SyncedParagraphInput[] {
  return splitHtmlIntoParagraphs(contentHtml)
    .map((paragraph, index) => ({
      stableKey: paragraph.stableKey || `p-${index}`,
      position: index,
      text: paragraph.text.trim(),
    }))
    .filter((paragraph) => paragraph.text.length > 0)
}

/**
 * Replaces all paragraphs for a chapter variant with rows derived from its HTML.
 *
 * @param store Prisma client or transaction exposing paragraph operations.
 * @param variantId ChapterVariant id to rebuild.
 * @param contentHtml HTML source of truth for the variant.
 * @returns Persisted paragraph list in reading order.
 */
export async function syncVariantParagraphsFromHtml(
  store: ParagraphStore,
  variantId: string,
  contentHtml: string
): Promise<Paragraph[]> {
  const paragraphInputs = buildParagraphInputsFromHtml(contentHtml).map((paragraph) => ({
    chapterVariantId: variantId,
    stableKey: paragraph.stableKey,
    position: paragraph.position,
    text: paragraph.text,
  }))

  await store.paragraph.deleteMany({
    where: { chapterVariantId: variantId },
  })

  if (paragraphInputs.length > 0) {
    await store.paragraph.createMany({
      data: paragraphInputs,
    })
  }

  return store.paragraph.findMany({
    where: { chapterVariantId: variantId },
    orderBy: { position: 'asc' },
  })
}

/**
 * Backfills missing paragraphs for legacy variants that only have contentHtml.
 *
 * @param store Prisma client or transaction exposing paragraph operations.
 * @param variantId ChapterVariant id to inspect.
 * @param contentHtml HTML source of truth for the variant.
 * @returns Existing or newly created paragraph list in reading order.
 */
export async function ensureVariantParagraphs(
  store: ParagraphStore,
  variantId: string,
  contentHtml: string
): Promise<Paragraph[]> {
  const existingParagraphs = await store.paragraph.findMany({
    where: { chapterVariantId: variantId },
    orderBy: { position: 'asc' },
  })

  if (existingParagraphs.length > 0 || !contentHtml.trim()) {
    return existingParagraphs
  }

  return syncVariantParagraphsFromHtml(store, variantId, contentHtml)
}
