import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { buildNeighborVariantChapterIds } from '../src/lib/variant-preparation.ts'

describe('variant preparation', () => {
  it('prepares the previous and next readable chapters around a deep chapter', () => {
    assert.deepEqual(
      buildNeighborVariantChapterIds({
        chapters: [
          { id: 'chapter-1' },
          { id: 'chapter-7', isReadable: false },
          { id: 'chapter-8' },
          { id: 'chapter-9' },
          { id: 'chapter-10' },
        ],
        activeChapterId: 'chapter-8',
      }),
      ['chapter-1', 'chapter-9'],
    )
  })

  it('does not prepare anything for a missing or non-readable active chapter', () => {
    assert.deepEqual(
      buildNeighborVariantChapterIds({
        chapters: [{ id: 'chapter-1' }, { id: 'chapter-2', isReadable: false }],
        activeChapterId: 'chapter-2',
      }),
      [],
    )
  })
})
