import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { db } from '../src/lib/db.ts'
import { createBookMoment } from '../src/lib/public-books.ts'

function createGuardedDelegate(modelName: string): object {
  return new Proxy({}, {
    get() {
      throw new Error(`${modelName} should not be touched by createBookMoment`)
    },
  })
}

describe('public book moment creation', () => {
  it('creates only a BookMoment and leaves annotation-related tables untouched', async () => {
    const originalDelegates = {
      book: db.book,
      chapter: db.chapter,
      bookMoment: db.bookMoment,
      annotation: db.annotation,
      chapterVariant: db.chapterVariant,
      chapterVariantRevision: db.chapterVariantRevision,
      readingProgress: db.readingProgress,
    }

    let bookFindUniqueCalls = 0
    let chapterFindFirstCalls = 0
    let bookMomentCreateCalls = 0

    const now = new Date('2026-05-11T12:00:00.000Z')

    db.book = {
      findUnique: async () => {
        bookFindUniqueCalls += 1
        return {
          id: 'book-1',
          slug: 'chemistry',
          isPublic: true,
          author: {
            slug: 'alex',
          },
        }
      },
    } as typeof db.book

    db.chapter = {
      findFirst: async () => {
        chapterFindFirstCalls += 1
        return { id: 'chapter-1' }
      },
    } as typeof db.chapter

    db.bookMoment = {
      create: async ({ data }: { data: Record<string, unknown> }) => {
        bookMomentCreateCalls += 1
        assert.equal(data.authorSlug, 'alex')
        assert.equal(data.bookSlug, 'chemistry')
        assert.equal(data.bookId, 'book-1')
        assert.equal(data.chapterId, 'chapter-1')
        assert.equal(data.variantType, 'original')
        assert.equal(data.readingMode, 'feed')
        assert.equal(data.paragraphStart, 'paragraph-a')
        assert.equal(data.paragraphEnd, 'paragraph-b')
        assert.equal(data.startOffset, 12)
        assert.equal(data.endOffset, 3)
        assert.equal(data.quoteText, 'Selected quote text')
        return {
          id: 'moment-1',
          authorSlug: 'alex',
          bookSlug: 'chemistry',
          bookId: 'book-1',
          chapterId: 'chapter-1',
          variantType: 'original',
          readingMode: 'feed',
          paragraphStart: 'paragraph-a',
          paragraphEnd: 'paragraph-b',
          startOffset: 12,
          endOffset: 3,
          quoteText: 'Selected quote text',
          createdAt: now,
        }
      },
    } as typeof db.bookMoment

    db.annotation = createGuardedDelegate('annotation') as typeof db.annotation
    db.chapterVariant = createGuardedDelegate('chapterVariant') as typeof db.chapterVariant
    db.chapterVariantRevision = createGuardedDelegate('chapterVariantRevision') as typeof db.chapterVariantRevision
    db.readingProgress = createGuardedDelegate('readingProgress') as typeof db.readingProgress

    try {
      const moment = await createBookMoment({
        bookId: 'book-1',
        authorSlug: 'alex',
        bookSlug: 'chemistry',
        chapterId: 'chapter-1',
        variantType: 'original',
        readingMode: 'feed',
        paragraphStart: 'paragraph-a',
        paragraphEnd: 'paragraph-b',
        startOffset: 12,
        endOffset: 3,
        quoteText: '  Selected   quote text  ',
      })

      assert.equal(bookFindUniqueCalls, 1)
      assert.equal(chapterFindFirstCalls, 1)
      assert.equal(bookMomentCreateCalls, 1)
      assert.equal(moment.id, 'moment-1')
      assert.equal(moment.createdAt, '2026-05-11T12:00:00.000Z')
    } finally {
      db.book = originalDelegates.book
      db.chapter = originalDelegates.chapter
      db.bookMoment = originalDelegates.bookMoment
      db.annotation = originalDelegates.annotation
      db.chapterVariant = originalDelegates.chapterVariant
      db.chapterVariantRevision = originalDelegates.chapterVariantRevision
      db.readingProgress = originalDelegates.readingProgress
    }
  })
})
