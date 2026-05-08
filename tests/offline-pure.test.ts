import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  buildPureOfflineFeedWindow,
  pickLatestByUpdatedAt,
  summarizePureOfflineBook,
  type PureOfflineBookRecord,
} from '../src/lib/offline-pure.ts'

const RECORD: PureOfflineBookRecord = {
  key: 'author::book',
  book: {
    id: 'book-1',
    slug: 'book',
    title: 'Book',
    coverUrl: null,
    author: {
      slug: 'author',
      name: 'Author',
    },
  },
  chapters: [
    {
      id: 'chapter-1',
      title: 'One',
      position: 1,
      prevChapterId: null,
      nextChapterId: 'chapter-2',
      variants: [{ id: 'variant-1', variantType: 'original' }],
      preview: null,
      commentsPreview: [],
      commentCount: 0,
    },
    {
      id: 'chapter-2',
      title: 'Two',
      position: 2,
      prevChapterId: 'chapter-1',
      nextChapterId: 'chapter-3',
      variants: [{ id: 'variant-2', variantType: 'clean' }],
      preview: null,
      commentsPreview: [],
      commentCount: 0,
    },
    {
      id: 'chapter-3',
      title: 'Three',
      position: 3,
      prevChapterId: 'chapter-2',
      nextChapterId: null,
      variants: [{ id: 'variant-3', variantType: 'original' }],
      preview: null,
      commentsPreview: [],
      commentCount: 0,
    },
  ],
  variantPresets: {
    clean: {},
  },
  downloadedAt: '2026-05-08T10:00:00.000Z',
  estimatedSizeBytes: 2048,
}

describe('offline pure helpers', () => {
  it('builds a chapter window around the anchor', () => {
    const windowData = buildPureOfflineFeedWindow(RECORD, 'chapter-2', 1, 1, (chapter) => chapter.id)

    assert.ok(windowData)
    assert.deepEqual(windowData.sections, ['chapter-1', 'chapter-2', 'chapter-3'])
    assert.equal(windowData.hasPrev, false)
    assert.equal(windowData.hasNext, false)
  })

  it('prefers the latest progress by updatedAt', () => {
    const merged = pickLatestByUpdatedAt(
      { updatedAt: '2026-05-08T10:05:00.000Z' },
      { updatedAt: '2026-05-08T10:00:00.000Z' },
    )

    assert.ok(merged)
    assert.equal(merged.updatedAt, '2026-05-08T10:05:00.000Z')
  })

  it('summarizes pending and failed actions for the offline shelf', () => {
    const summary = summarizePureOfflineBook({
      record: RECORD,
      pendingActions: 1,
      failedActions: 2,
    })

    assert.equal(summary.pendingActions, 1)
    assert.equal(summary.failedActions, 2)
    assert.equal(summary.estimatedSizeBytes, 2048)
  })
})
