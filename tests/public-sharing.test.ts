import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  buildMomentReaderHref,
  buildPublicBookPath,
  buildPublicMomentPath,
  truncateShareText,
} from '../src/lib/public-sharing.ts'
import { buildPublicBookMetadata, buildPublicMomentMetadata } from '../src/lib/public-metadata.ts'

describe('public sharing helpers', () => {
  it('builds canonical public paths for books and moments', () => {
    assert.equal(buildPublicBookPath('alex', 'chemistry'), '/alex/chemistry')
    assert.equal(
      buildPublicMomentPath('alex', 'chemistry', 'moment-123'),
      '/alex/chemistry/moments/moment-123',
    )
  })

  it('builds metadata for public book and reader share pages', () => {
    const metadata = buildPublicBookMetadata({
      id: 'book-1',
      slug: 'chemistry',
      title: 'Chemistry',
      description: 'Long description for the book share card',
      coverUrl: '/covers/chemistry.webp',
      author: {
        slug: 'alex',
        name: 'Alex',
      },
    })

    assert.equal(metadata.title, 'Книга «Chemistry»')
    assert.equal(metadata.alternates?.canonical, '/alex/chemistry')
    assert.equal(metadata.openGraph?.url, 'http://localhost:3000/alex/chemistry')
    assert.equal(
      typeof metadata.openGraph?.images?.[0] !== 'string'
        ? metadata.openGraph?.images?.[0]?.url
        : null,
      '/alex/chemistry/opengraph-image',
    )
    assert.equal(metadata.twitter?.card, 'summary_large_image')
  })

  it('builds metadata for a public quote card', () => {
    const metadata = buildPublicMomentMetadata({
      id: 'moment-123',
      authorSlug: 'alex',
      bookSlug: 'chemistry',
      bookId: 'book-1',
      chapterId: 'chapter-1',
      variantType: 'original',
      readingMode: 'feed',
      paragraphStart: 'paragraph-a',
      paragraphEnd: 'paragraph-b',
      startOffset: 28,
      endOffset: 0,
      quoteText: 'Короткая цитата',
      createdAt: '2026-05-11T00:00:00.000Z',
      chapter: {
        id: 'chapter-1',
        title: 'Chapter 1',
        position: 1,
      },
      book: {
        id: 'book-1',
        slug: 'chemistry',
        title: 'Chemistry',
        description: 'Long description',
        coverUrl: '/covers/chemistry.webp',
        author: {
          slug: 'alex',
          name: 'Alex',
        },
      },
    })

    assert.equal(metadata.title, 'Цитата из книги «Chemistry»')
    assert.equal(metadata.alternates?.canonical, '/alex/chemistry/moments/moment-123')
    assert.equal(metadata.openGraph?.url, 'http://localhost:3000/alex/chemistry/moments/moment-123')
    assert.equal(
      typeof metadata.openGraph?.images?.[0] !== 'string'
        ? metadata.openGraph?.images?.[0]?.url
        : null,
      '/alex/chemistry/moments/moment-123/opengraph-image',
    )
  })

  it('builds the internal reader href for a shared moment', () => {
    assert.equal(
      buildMomentReaderHref({
        authorSlug: 'alex',
        bookSlug: 'chemistry',
        chapterId: 'chapter-1',
        variantType: 'original',
        paragraphStart: 'paragraph-a',
        paragraphEnd: 'paragraph-b',
        startOffset: 28,
        endOffset: 0,
      }),
      '/alex/chemistry/read?chapter=chapter-1&variant=original&paragraph=paragraph-a&paragraphEnd=paragraph-b&startOffset=28&endOffset=0',
    )
  })

  it('truncates long share snippets without leaving trailing whitespace', () => {
    assert.equal(
      truncateShareText('  длинная    цитата из книги с лишними     пробелами  ', 40),
      'длинная цитата из книги с лишними…',
    )
  })
})
