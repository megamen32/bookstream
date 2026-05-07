import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { resolveInitialReadingMode } from '../src/lib/reader-mode.ts'

describe('reader mode selection', () => {
  it('prefers the locally stored mode over stale server progress', () => {
    assert.equal(
      resolveInitialReadingMode({
        bookDefaultMode: 'feed',
        storedReadingMode: 'feed',
        hasStoredReadingMode: true,
        progressReadingMode: 'book',
      }),
      'feed',
    )
  })

  it('uses the server progress when no local mode was stored', () => {
    assert.equal(
      resolveInitialReadingMode({
        bookDefaultMode: 'feed',
        storedReadingMode: null,
        hasStoredReadingMode: false,
        progressReadingMode: 'book',
      }),
      'book',
    )
  })

  it('falls back to the book default when no saved mode exists', () => {
    assert.equal(
      resolveInitialReadingMode({
        bookDefaultMode: 'feed',
        storedReadingMode: null,
        hasStoredReadingMode: false,
        progressReadingMode: null,
      }),
      'feed',
    )
  })

  it('forces book mode for quote-target links', () => {
    assert.equal(
      resolveInitialReadingMode({
        bookDefaultMode: 'feed',
        storedReadingMode: 'feed',
        hasStoredReadingMode: true,
        progressReadingMode: 'feed',
        forceBookMode: true,
      }),
      'book',
    )
  })
})
