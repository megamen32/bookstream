import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  buildBookUpdateData,
  BookUpdateValidationError,
} from '../src/lib/book-update.ts'

describe('book update payload normalization', () => {
  it('preserves explicit false and zero values so settings are not dropped on save', () => {
    const updateData = buildBookUpdateData({
      title: 'Философия Химии',
      description: 'Федеральный исследовательский центр',
      slug: 'filosofiya-himii',
      isPublic: false,
      readingModeDefault: 'feed',
      syntheticCommentsPerChapter: 0,
      syntheticQuotesPerChapter: 0,
      syntheticReactionsPerChapter: 0,
      syntheticCommentsUseLlm: false,
      allowReaderVariantsAtOwnerExpense: false,
      openStatsPublic: false,
    }, { canPublish: true })

    assert.deepEqual(updateData, {
      title: 'Философия Химии',
      description: 'Федеральный исследовательский центр',
      slug: 'filosofiya-himii',
      isPublic: false,
      readingModeDefault: 'feed',
      syntheticCommentsPerChapter: 0,
      syntheticQuotesPerChapter: 0,
      syntheticReactionsPerChapter: 0,
      syntheticCommentsUseLlm: false,
      allowReaderVariantsAtOwnerExpense: false,
      openStatsPublic: false,
    })
  })

  it('accepts stringified form values and clamps synthetic counts before persistence', () => {
    const updateData = buildBookUpdateData({
      isPublic: 'true',
      readingModeDefault: 'book',
      syntheticCommentsPerChapter: '27',
      syntheticQuotesPerChapter: '1.7',
      syntheticReactionsPerChapter: '-4',
      syntheticCommentsUseLlm: 'false',
      allowReaderVariantsAtOwnerExpense: '1',
      openStatsPublic: '0',
    }, { canPublish: true })

    assert.deepEqual(updateData, {
      isPublic: true,
      readingModeDefault: 'book',
      syntheticCommentsPerChapter: 20,
      syntheticQuotesPerChapter: 2,
      syntheticReactionsPerChapter: 0,
      syntheticCommentsUseLlm: false,
      allowReaderVariantsAtOwnerExpense: true,
      openStatsPublic: false,
    })
  })

  it('forces non-main users back to draft mode when publishing is disabled', () => {
    const updateData = buildBookUpdateData({
      isPublic: true,
      openStatsPublic: true,
    }, { canPublish: false })

    assert.equal(updateData.isPublic, false)
    assert.equal(updateData.openStatsPublic, true)
  })

  it('fails fast on unsupported reading modes instead of silently ignoring bad payloads', () => {
    assert.throws(
      () => buildBookUpdateData({ readingModeDefault: 'grid' }, { canPublish: true }),
      (error: unknown) => (
        error instanceof BookUpdateValidationError &&
        error.message === 'readingModeDefault must be "feed" or "book"'
      ),
    )
  })
})
