import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { shareQuoteSelection } from '../src/lib/quote-sharing.ts'

describe('quote sharing flow', () => {
  it('copies only the technical link when quote cards are disabled', async () => {
    const copiedValues: string[] = []
    let createCardCalls = 0

    const result = await shareQuoteSelection(
      {
        authorSlug: 'alex',
        bookSlug: 'chemistry',
        chapterId: 'chapter-1',
        variantType: 'original',
        paragraphStart: 'paragraph-a',
        paragraphEnd: 'paragraph-b',
        startOffset: 12,
        endOffset: 3,
        readingMode: 'feed',
        quoteText: 'Selected quote text',
        createQuoteCardsOnCopy: false,
      },
      {
        origin: 'https://books.bezrabotnyi.com',
        copyToClipboard: async (value: string) => {
          copiedValues.push(value)
        },
        createQuoteCard: async () => {
          createCardCalls += 1
          return { publicUrl: 'https://books.bezrabotnyi.com/alex/chemistry/moments/moment-1' }
        },
      },
    )

    assert.equal(createCardCalls, 0)
    assert.equal(result.createdQuoteCard, false)
    assert.equal(result.publicUrl, null)
    assert.deepEqual(copiedValues, [
      'https://books.bezrabotnyi.com/alex/chemistry/read?chapter=chapter-1&variant=original&paragraph=paragraph-a&paragraphEnd=paragraph-b&startOffset=12&endOffset=3',
    ])
  })

  it('creates a public card when quote cards are enabled', async () => {
    const copiedValues: string[] = []
    let createCardCalls = 0

    const result = await shareQuoteSelection(
      {
        authorSlug: 'alex',
        bookSlug: 'chemistry',
        chapterId: 'chapter-1',
        variantType: 'original',
        paragraphStart: 'paragraph-a',
        paragraphEnd: 'paragraph-b',
        startOffset: 12,
        endOffset: 3,
        readingMode: 'feed',
        quoteText: 'Selected quote text',
        createQuoteCardsOnCopy: true,
      },
      {
        origin: 'https://books.bezrabotnyi.com',
        copyToClipboard: async (value: string) => {
          copiedValues.push(value)
        },
        createQuoteCard: async () => {
          createCardCalls += 1
          return { publicUrl: 'https://books.bezrabotnyi.com/alex/chemistry/moments/moment-1' }
        },
      },
    )

    assert.equal(createCardCalls, 1)
    assert.equal(result.createdQuoteCard, true)
    assert.equal(result.publicUrl, 'https://books.bezrabotnyi.com/alex/chemistry/moments/moment-1')
    assert.deepEqual(copiedValues, [
      'https://books.bezrabotnyi.com/alex/chemistry/read?chapter=chapter-1&variant=original&paragraph=paragraph-a&paragraphEnd=paragraph-b&startOffset=12&endOffset=3',
      'https://books.bezrabotnyi.com/alex/chemistry/moments/moment-1',
    ])
  })
})
