import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { shouldReuseLoadedFeedSection } from '../src/lib/feed-navigation.ts'

describe('feed navigation helpers', () => {
  it('reuses an already loaded chapter variant instead of refetching', () => {
    const sections = [
      { chapter: { id: 'chapter-1' }, variant: { variantType: 'original' } },
      { chapter: { id: 'chapter-2' }, variant: { variantType: 'feed' } },
    ]

    assert.equal(shouldReuseLoadedFeedSection(sections, 'chapter-2', 'feed'), true)
  })

  it('refetches when the requested chapter variant is not mounted', () => {
    const sections = [
      { chapter: { id: 'chapter-1' }, variant: { variantType: 'original' } },
      { chapter: { id: 'chapter-2' }, variant: { variantType: 'original' } },
    ]

    assert.equal(shouldReuseLoadedFeedSection(sections, 'chapter-2', 'feed'), false)
  })
})
