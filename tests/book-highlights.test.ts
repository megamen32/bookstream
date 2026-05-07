import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { getVisibleBookHighlights } from '../src/lib/book-highlights.ts'

describe('book highlights visibility', () => {
  it('shows a compact preview when the section is collapsed', () => {
    const items = ['one', 'two', 'three', 'four']

    assert.deepEqual(getVisibleBookHighlights(items, null, 'comments'), ['one', 'two', 'three'])
    assert.deepEqual(getVisibleBookHighlights(items, null, 'quotes'), ['one', 'two', 'three'])
    assert.deepEqual(getVisibleBookHighlights(items, null, 'toc'), ['one', 'two', 'three'])
  })

  it('shows every item when the section is expanded', () => {
    const items = ['one', 'two', 'three', 'four']

    assert.deepEqual(getVisibleBookHighlights(items, 'comments', 'comments'), items)
    assert.deepEqual(getVisibleBookHighlights(items, 'quotes', 'quotes'), items)
    assert.deepEqual(getVisibleBookHighlights(items, 'toc', 'toc'), items)
  })
})
