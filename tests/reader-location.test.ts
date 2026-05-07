import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  buildReaderLocationSearch,
  resolveReaderLocationSearch,
  shouldForceBookModeFromQuoteTarget,
} from '../src/lib/reader-location.ts'

describe('reader location helpers', () => {
  it('forces book mode for quote-target URLs', () => {
    assert.equal(
      shouldForceBookModeFromQuoteTarget({
        paragraph: 'paragraph-1',
        paragraphEnd: null,
        startOffsetRaw: '0',
        endOffsetRaw: '94',
      }),
      true,
    )
  })

  it('keeps the current mode for plain chapter URLs', () => {
    assert.equal(
      shouldForceBookModeFromQuoteTarget({
        paragraph: null,
        paragraphEnd: null,
        startOffsetRaw: null,
        endOffsetRaw: null,
      }),
      false,
    )
  })

  it('builds a clean next-chapter URL without stale quote params', () => {
    assert.equal(
      buildReaderLocationSearch({
        chapterId: 'chapter-2',
        variantType: 'original',
        paragraphId: null,
        paragraphEndId: null,
        startOffset: null,
        endOffset: null,
      }),
      'chapter=chapter-2&variant=original',
    )
  })

  it('prefers the real browser search when the hook still exposes stale params', () => {
    assert.equal(
      resolveReaderLocationSearch(
        'chapter=chapter-1&variant=original&paragraph=p-1&startOffset=0&endOffset=94',
        '?chapter=chapter-2&variant=original',
      ),
      'chapter=chapter-2&variant=original',
    )
  })
})
