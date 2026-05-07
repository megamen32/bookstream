import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  getBookReaderPageStorageKey,
  resolveBookProgressPercent,
  resolveBookReaderPage,
  setBookReaderPage,
} from '../src/lib/book-reader-progress.ts'

describe('book reader progress helpers', () => {
  it('builds stable per-chapter storage keys', () => {
    assert.equal(getBookReaderPageStorageKey('chapter-42'), 'bookstream-page-chapter-42')
  })

  it('resolves saved pages and clamps them to the available range', () => {
    assert.equal(resolveBookReaderPage(null, 8), 1)
    assert.equal(resolveBookReaderPage('abc', 8), 1)
    assert.equal(resolveBookReaderPage('0', 8), 1)
    assert.equal(resolveBookReaderPage('4', 8), 4)
    assert.equal(resolveBookReaderPage('18', 8), 8)
  })

  it('stores the requested page for a chapter', () => {
    const values = new Map<string, string>()
    const storage = {
      setItem(key: string, value: string) {
        values.set(key, value)
      },
    }

    setBookReaderPage(storage, 'chapter-42', 1)

    assert.equal(values.get('bookstream-page-chapter-42'), '1')
  })

  it('derives overall book progress from chapter position and local progress', () => {
    assert.equal(resolveBookProgressPercent(0, 0, 10), 0)
    assert.equal(resolveBookProgressPercent(0, 0.5, 10), 5)
    assert.equal(resolveBookProgressPercent(3, 0.25, 10), 33)
    assert.equal(resolveBookProgressPercent(9, 1, 10), 100)
    assert.equal(resolveBookProgressPercent(12, 0.8, 10), 98)
  })
})
