import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  buildReaderLocationSearch,
  resolveReaderLocationSearch,
} from '../src/lib/reader-location.ts'

describe('reader location helpers', () => {
  it('builds a clean next-chapter URL without stale quote params', () => {
    assert.equal(
      buildReaderLocationSearch({
        chapterId: 'chapter-2',
        variantType: 'original',
        readingMode: 'feed',
        paragraphId: null,
        paragraphEndId: null,
        startOffset: null,
        endOffset: null,
      }),
      'chapter=chapter-2&variant=original&mode=feed',
      )
  })

  it('drops bare offsets when there is no paragraph anchor', () => {
    assert.equal(
      buildReaderLocationSearch({
        chapterId: 'chapter-2',
        variantType: 'original',
        readingMode: 'feed',
        paragraphId: null,
        paragraphEndId: null,
        startOffset: 0,
        endOffset: 0,
      }),
      'chapter=chapter-2&variant=original&mode=feed',
    )
  })

  it('keeps offsets when a paragraph anchor exists', () => {
    assert.equal(
      buildReaderLocationSearch({
        chapterId: 'chapter-2',
        variantType: 'original',
        readingMode: 'feed',
        paragraphId: 'p-1',
        paragraphEndId: null,
        startOffset: 0,
        endOffset: 94,
      }),
      'chapter=chapter-2&variant=original&mode=feed&paragraph=p-1&startOffset=0&endOffset=94',
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
