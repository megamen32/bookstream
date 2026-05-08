import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { resolveInitialReadingMode } from '../src/lib/reader-mode.ts'

describe('reader mode selection', () => {
  it('prefers the mode encoded in the URL', () => {
    assert.equal(
      resolveInitialReadingMode({
        bookDefaultMode: 'feed',
        urlReadingMode: 'feed',
        storedReadingMode: 'book',
        hasStoredReadingMode: true,
        progressReadingMode: 'book',
      }),
      'feed',
    )
  })

  it('keeps the mode encoded in the URL even for quote-target params', () => {
    assert.equal(
      resolveInitialReadingMode({
        bookDefaultMode: 'feed',
        urlReadingMode: 'feed',
        storedReadingMode: 'book',
        hasStoredReadingMode: true,
        progressReadingMode: 'book',
      }),
      'feed',
    )
  })

  it('prefers the locally stored mode over stale server progress', () => {
    assert.equal(
      resolveInitialReadingMode({
        bookDefaultMode: 'feed',
        urlReadingMode: null,
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
        urlReadingMode: null,
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
        urlReadingMode: null,
        storedReadingMode: null,
        hasStoredReadingMode: false,
        progressReadingMode: null,
      }),
      'feed',
    )
  })

})
