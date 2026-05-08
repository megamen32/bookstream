import { Prisma, type Paragraph } from '@prisma/client'
import { splitHtmlIntoParagraphs } from './file-parser.ts'

type ParagraphStore = Pick<Prisma.TransactionClient, 'paragraph'>

export interface SyncedParagraphInput {
  stableKey: string
  position: number
  text: string
  html: string
  textAlign: 'left' | 'center' | 'right' | 'justify' | null
  indentPx: number
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
      html: paragraph.html,
      textAlign: paragraph.textAlign,
      indentPx: paragraph.indentPx,
    }))
    .filter((paragraph) => paragraph.text.length > 0)
}

/**
 * Reconciles persisted paragraphs with the provided normalized paragraph list.
 * Existing paragraph ids are preserved when stable keys survive an edit.
 *
 * @param store Prisma client or transaction exposing paragraph operations.
 * @param variantId ChapterVariant id to rebuild.
 * @param paragraphInputs Normalized paragraph payloads with stable keys.
 * @returns Persisted paragraph list in reading order.
 */
export async function syncVariantParagraphs(
  store: ParagraphStore,
  variantId: string,
  paragraphInputs: SyncedParagraphInput[]
): Promise<Paragraph[]> {
  const normalizedInputs = paragraphInputs.map((paragraph) => ({
    chapterVariantId: variantId,
    stableKey: paragraph.stableKey,
    position: paragraph.position,
    text: paragraph.text,
  }))

  const existingParagraphs = await store.paragraph.findMany({
    where: { chapterVariantId: variantId },
    orderBy: { position: 'asc' },
  })

  const existingByStableKey = new Map(existingParagraphs.map((paragraph) => [paragraph.stableKey, paragraph]))
  const matchedParagraphIds = new Set<string>()

  for (const paragraph of normalizedInputs) {
    const existing = existingByStableKey.get(paragraph.stableKey)

    if (existing) {
      matchedParagraphIds.add(existing.id)
      await store.paragraph.update({
        where: { id: existing.id },
        data: {
          position: paragraph.position,
          text: paragraph.text,
        },
      })
      continue
    }

    await store.paragraph.create({
      data: paragraph,
    })
  }

  const staleParagraphIds = existingParagraphs
    .filter((paragraph) => !matchedParagraphIds.has(paragraph.id))
    .map((paragraph) => paragraph.id)

  if (staleParagraphIds.length > 0) {
    await store.paragraph.deleteMany({
      where: {
        id: { in: staleParagraphIds },
      },
    })
  }

  return store.paragraph.findMany({
    where: { chapterVariantId: variantId },
    orderBy: { position: 'asc' },
  })
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
  return syncVariantParagraphs(store, variantId, buildParagraphInputsFromHtml(contentHtml))
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
