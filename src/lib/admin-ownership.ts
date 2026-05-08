import type { Prisma } from '@prisma/client'
import { db } from '@/lib/db'
import { slugify } from '@/lib/slugify'

/**
 * Generates a globally unique author slug derived from the provided name.
 *
 * @param sourceName Human-readable reader or author name.
 * @returns Unique slug safe for `Author.slug`.
 */
export async function generateUniqueAuthorSlug(sourceName: string): Promise<string> {
  const baseSlug = slugify(sourceName) || 'author'

  for (let suffix = 0; suffix < 1000; suffix += 1) {
    const candidate = suffix === 0 ? baseSlug : `${baseSlug}-${suffix + 1}`
    const existing = await db.author.findUnique({
      where: { slug: candidate },
      select: { id: true },
    })

    if (!existing) {
      return candidate
    }
  }

  throw new Error('Failed to allocate a unique author slug')
}

/**
 * Ensures that a reader has at least one owned author profile for admin usage.
 *
 * @param readerId Owner reader id.
 * @param readerName Current reader display name.
 * @returns Existing or newly created owned author.
 */
export async function ensureReaderAuthorProfile(readerId: string, readerName: string): Promise<{
  id: string
  slug: string
  name: string
  bio: string | null
}> {
  const existingAuthor = await db.author.findFirst({
    where: { ownerReaderId: readerId },
    orderBy: { createdAt: 'asc' },
    select: {
      id: true,
      slug: true,
      name: true,
      bio: true,
    },
  })

  if (existingAuthor) {
    return existingAuthor
  }

  const slug = await generateUniqueAuthorSlug(readerName)
  return await db.author.create({
    data: {
      ownerReaderId: readerId,
      name: readerName,
      slug,
    },
    select: {
      id: true,
      slug: true,
      name: true,
      bio: true,
    },
  })
}

/**
 * Loads a book only when it belongs to the given reader through its author.
 *
 * @param readerId Owner reader id.
 * @param bookId Book id.
 * @returns Owned book metadata or `null`.
 */
export async function getOwnedBook(readerId: string, bookId: string): Promise<{
  id: string
  slug: string
  authorId: string
} | null> {
  const book = await db.book.findFirst({
    where: {
      id: bookId,
      author: {
        ownerReaderId: readerId,
      },
    },
    select: {
      id: true,
      slug: true,
      authorId: true,
    },
  })

  return book
}

/**
 * Loads a chapter only when it belongs to a book owned by the given reader.
 *
 * @param readerId Owner reader id.
 * @param chapterId Chapter id.
 * @returns Owned chapter metadata or `null`.
 */
export async function getOwnedChapter(readerId: string, chapterId: string): Promise<{
  id: string
  bookId: string
} | null> {
  const chapter = await db.chapter.findFirst({
    where: {
      id: chapterId,
      book: {
        author: {
          ownerReaderId: readerId,
        },
      },
    },
    select: {
      id: true,
      bookId: true,
    },
  })

  return chapter
}

/**
 * Prisma filter for selecting books owned by a reader via the author relation.
 *
 * @param readerId Owner reader id.
 * @returns Book filter snippet for Prisma queries.
 */
export function buildOwnedBookWhere(readerId: string): Prisma.BookWhereInput {
  return {
    author: {
      ownerReaderId: readerId,
    },
  }
}
