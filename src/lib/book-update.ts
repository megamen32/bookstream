import type { Prisma } from '@prisma/client'

export class BookUpdateValidationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'BookUpdateValidationError'
  }
}

interface BuildBookUpdateDataOptions {
  canPublish: boolean
}

interface RawBookUpdatePayload {
  title?: unknown
  description?: unknown
  slug?: unknown
  isPublic?: unknown
  readingModeDefault?: unknown
  syntheticCommentsPerChapter?: unknown
  syntheticQuotesPerChapter?: unknown
  syntheticReactionsPerChapter?: unknown
  syntheticCommentsUseLlm?: unknown
  openStatsPublic?: unknown
  allowReaderVariantsAtOwnerExpense?: unknown
}

function expectRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new BookUpdateValidationError('Book update payload must be a JSON object')
  }

  return value as Record<string, unknown>
}

function parseOptionalString(value: unknown, fieldName: string): string | undefined {
  if (value === undefined) {
    return undefined
  }

  if (typeof value !== 'string') {
    throw new BookUpdateValidationError(`${fieldName} must be a string`)
  }

  return value
}

function parseOptionalBoolean(value: unknown, fieldName: string): boolean | undefined {
  if (value === undefined) {
    return undefined
  }

  if (typeof value === 'boolean') {
    return value
  }

  if (value === 'true' || value === '1' || value === 1) {
    return true
  }

  if (value === 'false' || value === '0' || value === 0) {
    return false
  }

  throw new BookUpdateValidationError(`${fieldName} must be a boolean`)
}

function parseOptionalReadingMode(value: unknown): 'feed' | 'book' | undefined {
  if (value === undefined) {
    return undefined
  }

  if (value === 'feed' || value === 'book') {
    return value
  }

  throw new BookUpdateValidationError('readingModeDefault must be "feed" or "book"')
}

function parseOptionalSyntheticCount(value: unknown, fieldName: string): number | undefined {
  if (value === undefined) {
    return undefined
  }

  const numericValue = typeof value === 'string' && value.trim() !== ''
    ? Number(value)
    : value

  if (!Number.isFinite(numericValue)) {
    throw new BookUpdateValidationError(`${fieldName} must be a finite number`)
  }

  return Math.max(0, Math.min(20, Math.round(Number(numericValue))))
}

/**
 * Normalizes and validates the admin book settings payload before persistence.
 *
 * @param payload Raw request body.
 * @param options Access-dependent update options.
 * @returns Prisma-ready update data that preserves explicit `false` and `0` values.
 * @throws BookUpdateValidationError When a payload field has an invalid type or value.
 */
export function buildBookUpdateData(
  payload: unknown,
  options: BuildBookUpdateDataOptions,
): Prisma.BookUpdateInput {
  const raw = expectRecord(payload) as RawBookUpdatePayload

  const title = parseOptionalString(raw.title, 'title')
  const description = parseOptionalString(raw.description, 'description')
  const slug = parseOptionalString(raw.slug, 'slug')
  const isPublic = parseOptionalBoolean(raw.isPublic, 'isPublic')
  const readingModeDefault = parseOptionalReadingMode(raw.readingModeDefault)
  const syntheticCommentsPerChapter = parseOptionalSyntheticCount(
    raw.syntheticCommentsPerChapter,
    'syntheticCommentsPerChapter',
  )
  const syntheticQuotesPerChapter = parseOptionalSyntheticCount(
    raw.syntheticQuotesPerChapter,
    'syntheticQuotesPerChapter',
  )
  const syntheticReactionsPerChapter = parseOptionalSyntheticCount(
    raw.syntheticReactionsPerChapter,
    'syntheticReactionsPerChapter',
  )
  const syntheticCommentsUseLlm = parseOptionalBoolean(
    raw.syntheticCommentsUseLlm,
    'syntheticCommentsUseLlm',
  )
  const openStatsPublic = parseOptionalBoolean(raw.openStatsPublic, 'openStatsPublic')
  const allowReaderVariantsAtOwnerExpense = parseOptionalBoolean(
    raw.allowReaderVariantsAtOwnerExpense,
    'allowReaderVariantsAtOwnerExpense',
  )

  const updateData: Prisma.BookUpdateInput = {}

  if (title !== undefined) {
    updateData.title = title
  }
  if (description !== undefined) {
    updateData.description = description
  }
  if (slug !== undefined) {
    updateData.slug = slug
  }
  if (isPublic !== undefined) {
    updateData.isPublic = options.canPublish ? isPublic : false
  }
  if (readingModeDefault !== undefined) {
    updateData.readingModeDefault = readingModeDefault
  }
  if (syntheticCommentsPerChapter !== undefined) {
    updateData.syntheticCommentsPerChapter = syntheticCommentsPerChapter
  }
  if (syntheticQuotesPerChapter !== undefined) {
    updateData.syntheticQuotesPerChapter = syntheticQuotesPerChapter
  }
  if (syntheticReactionsPerChapter !== undefined) {
    updateData.syntheticReactionsPerChapter = syntheticReactionsPerChapter
  }
  if (syntheticCommentsUseLlm !== undefined) {
    updateData.syntheticCommentsUseLlm = syntheticCommentsUseLlm
  }
  if (openStatsPublic !== undefined) {
    updateData.openStatsPublic = openStatsPublic
  }
  if (allowReaderVariantsAtOwnerExpense !== undefined) {
    updateData.allowReaderVariantsAtOwnerExpense = allowReaderVariantsAtOwnerExpense
  }

  return updateData
}
