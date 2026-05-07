import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

describe('reader store persistence', () => {
  it('persists the selected reading mode immediately', async () => {
    const storedValues = new Map<string, string>()
    const mockLocalStorage = {
      getItem(key: string): string | null {
        return storedValues.get(key) || null
      },
      setItem(key: string, value: string): void {
        storedValues.set(key, value)
      },
      removeItem(key: string): void {
        storedValues.delete(key)
      },
    }

    const originalWindow = (globalThis as typeof globalThis & { window?: unknown }).window
    const originalLocalStorage = (globalThis as typeof globalThis & { localStorage?: unknown }).localStorage
    ;(globalThis as typeof globalThis & { window?: { localStorage: typeof mockLocalStorage } }).window = {
      localStorage: mockLocalStorage,
    }
    ;(globalThis as typeof globalThis & { localStorage?: typeof mockLocalStorage }).localStorage = mockLocalStorage

    try {
      const { useReaderStore } = await import('../src/lib/store.ts')

      useReaderStore.getState().setReadingMode('book')

      const storedStateRaw = storedValues.get('bookstream-reader-state')
      assert.ok(storedStateRaw)

      const storedState = JSON.parse(storedStateRaw as string) as { readingMode?: string }
      assert.equal(storedState.readingMode, 'book')
    } finally {
      ;(globalThis as typeof globalThis & { window?: unknown }).window = originalWindow
      ;(globalThis as typeof globalThis & { localStorage?: unknown }).localStorage = originalLocalStorage
    }
  })
})
