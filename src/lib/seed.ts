/**
 * Seed script for Bookstream.
 *
 * This version targets the current database contents:
 * - reuses existing books for author `alex`
 * - removes the two mistaken demo books created earlier
 * - generates comments, quote annotations, votes, and reactions
 *   on the existing books only
 */

import { db } from './db'

const AUTHOR_SLUG = 'alex'
const DEMO_BOOK_SLUGS = ['gospel-of-judas', 'metro-2033-review'] as const

const seedReaders = [
  { id: 'seed-current-1', username: 'читатель_мария' },
  { id: 'seed-current-2', username: 'booklover' },
  { id: 'seed-current-3', username: 'историк_иван' },
  { id: 'seed-current-4', username: 'метро_лена' },
  { id: 'seed-current-5', username: 'skeptik_oleg' },
  { id: 'seed-current-6', username: 'poetry_nika' },
] as const

type SeedReader = (typeof seedReaders)[number]

interface SeedParagraph {
  id: string
  text: string
  position: number
}

interface SeedChapterVariant {
  id: string
  variantType: string
  paragraphs: SeedParagraph[]
}

interface SeedChapter {
  id: string
  title: string
  position: number
  variants: SeedChapterVariant[]
}

interface SeedBook {
  id: string
  slug: string
  title: string
  chapters: SeedChapter[]
}

interface ParagraphTarget {
  chapter: SeedChapter
  variant: SeedChapterVariant
  paragraph: SeedParagraph
}

interface SeedCommentPlan {
  reader: SeedReader
  body: string
  target: ParagraphTarget
}

interface SeedReactionPlan {
  reader: SeedReader
  emoji: string
  target: ParagraphTarget
}

function normalizeText(text: string): string {
  return text.replace(/\s+/g, ' ').trim()
}

function snippet(text: string, maxLength: number): string {
  const normalized = normalizeText(text)
  if (normalized.length <= maxLength) {
    return normalized
  }

  const cut = normalized.slice(0, maxLength)
  const punctuationIndex = Math.max(
    cut.lastIndexOf('.'),
    cut.lastIndexOf('!'),
    cut.lastIndexOf('?'),
    cut.lastIndexOf('…'),
  )

  if (punctuationIndex >= 40) {
    return cut.slice(0, punctuationIndex + 1).trim()
  }

  return cut.replace(/\s+\S*$/, '').trim()
}

function buildCommentBody(bookTitle: string, chapterTitle: string, text: string, tone: string): string {
  return `${tone} В ${chapterTitle} у ${bookTitle} хорошо работает этот фрагмент: ${snippet(text, 110)}`
}

function buildQuoteText(text: string): string {
  return snippet(text, 140)
}

function pickOriginalVariant(chapter: SeedChapter): SeedChapterVariant | null {
  return chapter.variants.find((variant) => variant.variantType === 'original') ?? chapter.variants[0] ?? null
}

function buildParagraphTargets(book: SeedBook): ParagraphTarget[] {
  const selectedChapters = book.chapters.slice(0, 2)
  const targets: ParagraphTarget[] = []

  for (const chapter of selectedChapters) {
    const variant = pickOriginalVariant(chapter)
    if (!variant || variant.paragraphs.length === 0) continue

    const paragraphIndexes = [0, 1, 2, 3].filter((index) => index < variant.paragraphs.length)
    for (const paragraphIndex of paragraphIndexes) {
      targets.push({
        chapter,
        variant,
        paragraph: variant.paragraphs[paragraphIndex],
      })
    }
  }

  if (targets.length === 0) {
    for (const chapter of book.chapters) {
      const variant = pickOriginalVariant(chapter)
      if (!variant || variant.paragraphs.length === 0) continue
      targets.push({
        chapter,
        variant,
        paragraph: variant.paragraphs[0],
      })
      if (targets.length >= 4) break
    }
  }

  return targets
}

async function deleteBookGraph(bookId: string): Promise<void> {
  const chapters = await db.chapter.findMany({
    where: { bookId },
    select: { id: true },
  })
  const chapterIds = chapters.map((chapter) => chapter.id)

  const variants = chapterIds.length > 0
    ? await db.chapterVariant.findMany({
        where: { chapterId: { in: chapterIds } },
        select: { id: true },
      })
    : []
  const variantIds = variants.map((variant) => variant.id)

  const paragraphs = variantIds.length > 0
    ? await db.paragraph.findMany({
        where: { chapterVariantId: { in: variantIds } },
        select: { id: true },
      })
    : []
  const paragraphIds = paragraphs.map((paragraph) => paragraph.id)

  await db.reaction.deleteMany({
    where: { paragraphId: { in: paragraphIds } },
  })
  await db.paragraph.deleteMany({
    where: { id: { in: paragraphIds } },
  })
  await db.chapterVariant.deleteMany({
    where: { id: { in: variantIds } },
  })
  await db.chapter.deleteMany({
    where: { id: { in: chapterIds } },
  })
  await db.readingProgress.deleteMany({
    where: { bookId },
  })
  await db.annotationVote.deleteMany({
    where: { annotation: { bookId } },
  })
  await db.annotation.deleteMany({
    where: { bookId },
  })
  await db.book.delete({
    where: { id: bookId },
  })
}

async function cleanupMistakenDemoBooks(): Promise<void> {
  const demoBooks = await db.book.findMany({
    where: {
      slug: { in: [...DEMO_BOOK_SLUGS] },
    },
    select: { id: true, slug: true },
  })

  for (const book of demoBooks) {
    await deleteBookGraph(book.id)
    console.log(`   🧹 removed demo book: ${book.slug}`)
  }
}

async function loadCurrentBooks(): Promise<SeedBook[]> {
  const books = await db.book.findMany({
    where: {
      author: { slug: AUTHOR_SLUG },
      slug: { notIn: [...DEMO_BOOK_SLUGS] },
    },
    select: {
      id: true,
      slug: true,
      title: true,
      chapters: {
        orderBy: { position: 'asc' },
        select: {
          id: true,
          title: true,
          position: true,
          variants: {
            orderBy: { variantType: 'asc' },
            select: {
              id: true,
              variantType: true,
              paragraphs: {
                orderBy: { position: 'asc' },
                select: {
                  id: true,
                  text: true,
                  position: true,
                },
              },
            },
          },
        },
      },
    },
  })

  return books
}

async function seedReadersIfNeeded(): Promise<void> {
  for (const reader of seedReaders) {
    await db.reader.upsert({
      where: { id: reader.id },
      update: { currentUsername: reader.username },
      create: {
        id: reader.id,
        currentUsername: reader.username,
      },
    })
  }
}

async function clearSeedData(bookIds: string[]): Promise<void> {
  const readerIds = seedReaders.map((reader) => reader.id)

  await db.annotationVote.deleteMany({
    where: {
      readerId: { in: readerIds },
      annotation: {
        bookId: { in: bookIds },
      },
    },
  })

  await db.annotation.deleteMany({
    where: {
      bookId: { in: bookIds },
      readerId: { in: readerIds },
      kind: { in: ['comment', 'quote'] },
    },
  })

  await db.reaction.deleteMany({
    where: {
      readerId: { in: readerIds },
      chapterVariant: {
        chapter: {
          bookId: { in: bookIds },
        },
      },
    },
  })
}

async function seedBook(book: SeedBook, index: number): Promise<{
  comments: number
  quoteVotes: number
  reactions: number
}> {
  const targets = buildParagraphTargets(book)
  if (targets.length === 0) {
    console.log(`   ⚠️  skipping "${book.title}" - no paragraph targets found`)
    return { comments: 0, quoteVotes: 0, reactions: 0 }
  }

  const commentPlans: SeedCommentPlan[] = targets.slice(0, 4).map((target, targetIndex) => ({
    reader: seedReaders[(index * 2 + targetIndex) % seedReaders.length],
    target,
    body: buildCommentBody(
      book.title,
      target.chapter.title,
      target.paragraph.text,
      targetIndex % 2 === 0 ? 'Хороший ритм текста.' : 'Сильный смысловой узел.',
    ),
  }))

  const quoteTarget = targets[0]
  const quoteReader = seedReaders[(index + 4) % seedReaders.length]
  const quoteText = buildQuoteText(quoteTarget.paragraph.text)
  const quoteComment = await db.annotation.create({
    data: {
      bookId: book.id,
      chapterId: quoteTarget.chapter.id,
      chapterVariantId: quoteTarget.variant.id,
      variantType: quoteTarget.variant.variantType,
      readerId: quoteReader.id,
      username: quoteReader.username,
      kind: 'comment',
      body: buildCommentBody(
        book.title,
        quoteTarget.chapter.title,
        quoteTarget.paragraph.text,
        'Это место лучше всего тянет на цитату.',
      ),
      status: 'active',
      selectedText: quoteText,
      paragraphId: quoteTarget.paragraph.id,
      endParagraphId: quoteTarget.paragraph.id,
      startOffset: 0,
      endOffset: quoteText.length,
    },
  })

  const quote = await db.annotation.create({
    data: {
      bookId: book.id,
      chapterId: quoteTarget.chapter.id,
      chapterVariantId: quoteTarget.variant.id,
      variantType: quoteTarget.variant.variantType,
      readerId: quoteReader.id,
      username: quoteReader.username,
      kind: 'quote',
      status: 'active',
      body: quoteComment.body,
      paragraphId: quoteTarget.paragraph.id,
      endParagraphId: quoteTarget.paragraph.id,
      selectedText: quoteText,
      startOffset: 0,
      endOffset: quoteText.length,
    },
  })

  const quoteVoteReaders = [
    seedReaders[(index + 1) % seedReaders.length],
    seedReaders[(index + 2) % seedReaders.length],
  ]

  for (const voter of quoteVoteReaders) {
    await db.annotationVote.create({
      data: {
        annotationId: quote.id,
        readerId: voter.id,
      },
    })
  }

  const reactionEmojis = ['🔥', '💡', '❤️', '👏']
  let reactionsCreated = 0
  for (const [reactionIndex, target] of targets.slice(0, 4).entries()) {
    const reader = seedReaders[(index + reactionIndex) % seedReaders.length]
    const selectedText = buildQuoteText(target.paragraph.text)
    await db.reaction.create({
      data: {
        paragraphId: target.paragraph.id,
        chapterVariantId: target.variant.id,
        readerId: reader.id,
        emoji: reactionEmojis[reactionIndex % reactionEmojis.length],
        selectedText,
        startOffset: 0,
        endOffset: selectedText.length,
      },
    })
    reactionsCreated += 1
  }

  for (const plan of commentPlans) {
    const selectedText = buildQuoteText(plan.target.paragraph.text)
    await db.annotation.create({
      data: {
        bookId: book.id,
        chapterId: plan.target.chapter.id,
        chapterVariantId: plan.target.variant.id,
        variantType: plan.target.variant.variantType,
        readerId: plan.reader.id,
        username: plan.reader.username,
        kind: 'comment',
        body: plan.body,
        status: 'active',
        selectedText,
        paragraphId: plan.target.paragraph.id,
        endParagraphId: plan.target.paragraph.id,
        startOffset: 0,
        endOffset: selectedText.length,
      },
    })
  }

  return {
    comments: commentPlans.length + 1,
    quoteVotes: quoteVoteReaders.length,
    reactions: reactionsCreated,
  }
}

async function main(): Promise<void> {
  console.log('🌱 Seeding current Bookstream database...\n')

  await cleanupMistakenDemoBooks()

  const books = await loadCurrentBooks()
  if (books.length === 0) {
    throw new Error(`No books found for author slug "${AUTHOR_SLUG}"`)
  }

  const bookIds = books.map((book) => book.id)
  await clearSeedData(bookIds)
  await seedReadersIfNeeded()

  let totalComments = 0
  let totalQuoteVotes = 0
  let totalReactions = 0

  for (const [index, book] of books.entries()) {
    const result = await seedBook(book, index)
    totalComments += result.comments
    totalQuoteVotes += result.quoteVotes
    totalReactions += result.reactions
    console.log(`   ✅ ${book.title}`)
  }

  console.log('\n✅ Seeding complete!')
  console.log('\n📊 Summary:')
  console.log(`   Books: ${books.length}`)
  console.log(`   Comments: ${totalComments}`)
  console.log(`   Quote votes: ${totalQuoteVotes}`)
  console.log(`   Reactions: ${totalReactions}`)
}

main()
  .catch((error: unknown) => {
    console.error('❌ Seed failed:', error)
    process.exit(1)
  })
  .finally(async () => {
    await db.$disconnect()
  })
