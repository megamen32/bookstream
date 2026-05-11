import { db } from './db.ts'
import type { BookMomentRecord, PublicBookMoment } from './public-sharing.ts'
import { normalizeShareText } from './public-sharing.ts'

export interface PublicBookAuthor {
  slug: string
  name: string
}

export interface PublicBookRecord {
  id: string
  slug: string
  title: string
  description: string | null
  coverUrl: string | null
  author: PublicBookAuthor
}

export interface PublicBookMomentRecord extends BookMomentRecord {
  chapter: {
    id: string
    title: string
    position: number
  }
  book: PublicBookRecord
}

export interface CreateBookMomentInput {
  bookId: string
  authorSlug: string
  bookSlug: string
  chapterId: string
  variantType: string
  readingMode: string
  paragraphStart: string
  paragraphEnd?: string | null
  startOffset: number
  endOffset: number
  quoteText: string
}

export class BookMomentValidationError extends Error {}

/**
 * Loads a public book by author and book slug.
 *
 * @param authorSlug Public author slug.
 * @param bookSlug Public book slug.
 * @returns Public book record or null when the book is not available.
 */
export async function getPublicBookBySlugs(
  authorSlug: string,
  bookSlug: string,
): Promise<PublicBookRecord | null> {
  const book = await db.book.findFirst({
    where: {
      slug: bookSlug,
      isPublic: true,
      author: {
        slug: authorSlug,
      },
    },
    select: {
      id: true,
      slug: true,
      title: true,
      description: true,
      coverUrl: true,
      author: {
        select: {
          slug: true,
          name: true,
        },
      },
    },
  })

  return book || null
}

/**
 * Loads a public moment together with its book and chapter context.
 *
 * @param momentId Stable moment id.
 * @returns Public moment record or null when it does not exist.
 */
export async function getPublicBookMomentById(momentId: string): Promise<PublicBookMomentRecord | null> {
  const moment = await db.bookMoment.findUnique({
    where: {
      id: momentId,
    },
    select: {
      id: true,
      authorSlug: true,
      bookSlug: true,
      bookId: true,
      chapterId: true,
      variantType: true,
      readingMode: true,
      paragraphStart: true,
      paragraphEnd: true,
      startOffset: true,
      endOffset: true,
      quoteText: true,
      createdAt: true,
      chapter: {
        select: {
          id: true,
          title: true,
          position: true,
        },
      },
      book: {
        select: {
          id: true,
          slug: true,
          title: true,
          description: true,
          coverUrl: true,
          isPublic: true,
          author: {
            select: {
              slug: true,
              name: true,
            },
          },
        },
      },
    },
  })

  if (!moment || !moment.book.isPublic) {
    return null
  }

  return {
    ...moment,
    createdAt: moment.createdAt,
  }
}

/**
 * Creates a public moment row from the current reader selection.
 *
 * @param input Normalized reader selection payload.
 * @returns Serializable public moment payload.
 */
export async function createBookMoment(input: CreateBookMomentInput): Promise<PublicBookMoment> {
  const book = await db.book.findUnique({
    where: {
      id: input.bookId,
    },
    select: {
      id: true,
      slug: true,
      isPublic: true,
      author: {
        select: {
          slug: true,
        },
      },
    },
  })

  if (!book || !book.isPublic) {
    throw new BookMomentValidationError('Книга не найдена')
  }

  if (book.slug !== input.bookSlug || book.author.slug !== input.authorSlug) {
    throw new BookMomentValidationError('Публичный путь книги не совпадает с каноническим')
  }

  const chapter = await db.chapter.findFirst({
    where: {
      id: input.chapterId,
      bookId: input.bookId,
    },
    select: {
      id: true,
    },
  })

  if (!chapter) {
    throw new BookMomentValidationError('Глава не найдена')
  }

  const normalizedQuoteText = normalizeShareText(input.quoteText)
  if (!normalizedQuoteText) {
    throw new BookMomentValidationError('Пустую цитату нельзя сохранить')
  }

  if (!input.paragraphStart.trim()) {
    throw new BookMomentValidationError('paragraphStart is required')
  }

  if (!Number.isFinite(input.startOffset) || !Number.isFinite(input.endOffset)) {
    throw new BookMomentValidationError('Offsets must be finite numbers')
  }

  const moment = await db.bookMoment.create({
    data: {
      authorSlug: book.author.slug,
      bookSlug: book.slug,
      bookId: book.id,
      chapterId: input.chapterId,
      variantType: input.variantType,
      readingMode: input.readingMode,
      paragraphStart: input.paragraphStart,
      paragraphEnd: input.paragraphEnd && input.paragraphEnd !== input.paragraphStart
        ? input.paragraphEnd
        : null,
      startOffset: Math.max(0, Math.trunc(input.startOffset)),
      endOffset: Math.max(0, Math.trunc(input.endOffset)),
      quoteText: normalizedQuoteText,
    },
  })

  return {
    id: moment.id,
    authorSlug: moment.authorSlug,
    bookSlug: moment.bookSlug,
    bookId: moment.bookId,
    chapterId: moment.chapterId,
    variantType: moment.variantType,
    readingMode: moment.readingMode,
    paragraphStart: moment.paragraphStart,
    paragraphEnd: moment.paragraphEnd,
    startOffset: moment.startOffset,
    endOffset: moment.endOffset,
    quoteText: moment.quoteText,
    createdAt: moment.createdAt.toISOString(),
  }
}
