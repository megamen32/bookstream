import type { Metadata } from 'next'
import type { PublicBookMomentRecord, PublicBookRecord } from './public-books.ts'
import { buildPublicBookPath, buildPublicBookUrl, buildPublicMomentPath, buildPublicMomentUrl, truncateShareText } from './public-sharing.ts'

/**
 * Builds metadata for a public book page or a reader share route for the same book.
 *
 * @param book Public book record.
 * @returns Next.js metadata object with canonical, Open Graph, and Twitter fields.
 */
export function buildPublicBookMetadata(book: PublicBookRecord): Metadata {
  const description = book.description
    ? truncateShareText(book.description, 180)
    : `Книга «${book.title}» автора ${book.author.name}`

  return {
    title: `Книга «${book.title}»`,
    description,
    alternates: {
      canonical: buildPublicBookPath(book.author.slug, book.slug),
    },
    openGraph: {
      title: `Книга «${book.title}»`,
      description,
      url: buildPublicBookUrl(book.author.slug, book.slug),
      siteName: 'Bookstream',
      type: 'book',
      locale: 'ru_RU',
      images: [
        {
          url: `${buildPublicBookPath(book.author.slug, book.slug)}/opengraph-image`,
          width: 1200,
          height: 630,
          alt: `Книга «${book.title}»`,
        },
      ],
    },
    twitter: {
      card: 'summary_large_image',
      creator: '@bookstream',
      title: `Книга «${book.title}»`,
      description,
      images: [`${buildPublicBookPath(book.author.slug, book.slug)}/opengraph-image`],
    },
  }
}

/**
 * Builds metadata for a public quote page.
 *
 * @param moment Public quote record with book context.
 * @returns Next.js metadata object with canonical, Open Graph, and Twitter fields.
 */
export function buildPublicMomentMetadata(moment: PublicBookMomentRecord): Metadata {
  const description = truncateShareText(moment.quoteText, 180)
  const canonicalPath = buildPublicMomentPath(moment.authorSlug, moment.bookSlug, moment.id)

  return {
    title: `Цитата из книги «${moment.book.title}»`,
    description,
    alternates: {
      canonical: canonicalPath,
    },
    openGraph: {
      title: `Цитата из книги «${moment.book.title}»`,
      description,
      url: buildPublicMomentUrl(moment.authorSlug, moment.bookSlug, moment.id),
      siteName: 'Bookstream',
      type: 'article',
      locale: 'ru_RU',
      images: [
        {
          url: `${canonicalPath}/opengraph-image`,
          width: 1200,
          height: 630,
          alt: `Цитата из книги «${moment.book.title}»`,
        },
      ],
    },
    twitter: {
      card: 'summary_large_image',
      creator: '@bookstream',
      title: `Цитата из книги «${moment.book.title}»`,
      description,
      images: [`${canonicalPath}/opengraph-image`],
    },
  }
}
