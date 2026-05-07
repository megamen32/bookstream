import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function tableExists(tableName) {
  const rows = await prisma.$queryRawUnsafe(
    "SELECT name FROM sqlite_master WHERE type = 'table' AND name = ? LIMIT 1",
    tableName,
  )
  return Array.isArray(rows) && rows.length > 0
}

function buildLegacyCommentAnnotationId(commentId) {
  return `legacy-comment-${commentId}`
}

function buildLegacyQuoteAnnotationId(quoteId) {
  return `legacy-quote-${quoteId}`
}

function normalizeText(value) {
  return typeof value === 'string' ? value.trim() : ''
}

async function loadVariantIdsByChapterAndType() {
  const rows = await prisma.chapterVariant.findMany({
    select: {
      id: true,
      chapterId: true,
      variantType: true,
    },
  })

  return new Map(rows.map((row) => [`${row.chapterId}:${row.variantType}`, row.id]))
}

async function migrateLegacyComments() {
  const hasComments = await tableExists('Comment')
  const hasCommentQuotes = await tableExists('CommentQuote')
  const hasQuoteUpvotes = await tableExists('QuoteUpvote')

  if (!hasComments || !hasCommentQuotes || !hasQuoteUpvotes) {
    console.log('[legacy-annotations] legacy tables not found, skipping')
    return
  }

  const variantIds = await loadVariantIdsByChapterAndType()

  const commentRows = await prisma.$queryRawUnsafe(`
    SELECT
      c.id,
      c.bookId,
      c.chapterId,
      c.readerId,
      c.username,
      c.body,
      c.status,
      c.createdAt,
      c.updatedAt,
      q.id AS quoteId,
      q.variantType,
      q.paragraphId,
      q.endParagraphId,
      q.selectedText,
      q.startOffset,
      q.endOffset,
      q.createdAt AS quoteCreatedAt
    FROM Comment c
    LEFT JOIN CommentQuote q ON q.commentId = c.id
    ORDER BY c.createdAt ASC, q.createdAt ASC
  `)

  const commentsById = new Map()

  for (const row of commentRows) {
    if (!commentsById.has(row.id)) {
      commentsById.set(row.id, {
        id: row.id,
        bookId: row.bookId,
        chapterId: row.chapterId,
        readerId: row.readerId,
        username: row.username,
        body: row.body,
        status: row.status,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
        quotes: [],
      })
    }

    if (row.quoteId) {
      commentsById.get(row.id).quotes.push({
        id: row.quoteId,
        variantType: row.variantType || 'original',
        paragraphId: row.paragraphId,
        endParagraphId: row.endParagraphId,
        selectedText: row.selectedText,
        startOffset: Number(row.startOffset || 0),
        endOffset: Number(row.endOffset || 0),
        createdAt: row.quoteCreatedAt,
      })
    }
  }

  let migratedComments = 0
  let migratedQuotes = 0
  let migratedVotes = 0

  for (const comment of commentsById.values()) {
    const firstQuote = comment.quotes[0] || null
    const chapterVariantId = firstQuote
      ? variantIds.get(`${comment.chapterId}:${firstQuote.variantType}`) || null
      : null

    await prisma.annotation.upsert({
      where: { id: buildLegacyCommentAnnotationId(comment.id) },
      update: {
        bookId: comment.bookId,
        chapterId: comment.chapterId,
        chapterVariantId,
        variantType: firstQuote?.variantType || 'original',
        readerId: comment.readerId,
        username: comment.username,
        kind: 'comment',
        status: comment.status || 'active',
        body: normalizeText(comment.body) || null,
        emoji: null,
        selectedText: normalizeText(firstQuote?.selectedText) || null,
        paragraphId: firstQuote?.paragraphId || null,
        endParagraphId: firstQuote?.endParagraphId || null,
        startOffset: firstQuote?.startOffset || 0,
        endOffset: firstQuote?.endOffset || 0,
        createdAt: new Date(comment.createdAt),
        updatedAt: new Date(comment.updatedAt || comment.createdAt),
      },
      create: {
        id: buildLegacyCommentAnnotationId(comment.id),
        bookId: comment.bookId,
        chapterId: comment.chapterId,
        chapterVariantId,
        variantType: firstQuote?.variantType || 'original',
        readerId: comment.readerId,
        username: comment.username,
        kind: 'comment',
        status: comment.status || 'active',
        body: normalizeText(comment.body) || null,
        emoji: null,
        selectedText: normalizeText(firstQuote?.selectedText) || null,
        paragraphId: firstQuote?.paragraphId || null,
        endParagraphId: firstQuote?.endParagraphId || null,
        startOffset: firstQuote?.startOffset || 0,
        endOffset: firstQuote?.endOffset || 0,
        createdAt: new Date(comment.createdAt),
        updatedAt: new Date(comment.updatedAt || comment.createdAt),
      },
    })
    migratedComments += 1

    for (const quote of comment.quotes) {
      const quoteAnnotationId = buildLegacyQuoteAnnotationId(quote.id)
      const quoteVariantId = variantIds.get(`${comment.chapterId}:${quote.variantType}`) || null

      await prisma.annotation.upsert({
        where: { id: quoteAnnotationId },
        update: {
          bookId: comment.bookId,
          chapterId: comment.chapterId,
          chapterVariantId: quoteVariantId,
          variantType: quote.variantType,
          readerId: comment.readerId,
          username: comment.username,
          kind: 'quote',
          status: comment.status || 'active',
          body: normalizeText(comment.body) || null,
          emoji: null,
          selectedText: normalizeText(quote.selectedText),
          paragraphId: quote.paragraphId,
          endParagraphId: quote.endParagraphId,
          startOffset: quote.startOffset || 0,
          endOffset: quote.endOffset || 0,
          createdAt: new Date(quote.createdAt || comment.createdAt),
          updatedAt: new Date(comment.updatedAt || quote.createdAt || comment.createdAt),
        },
        create: {
          id: quoteAnnotationId,
          bookId: comment.bookId,
          chapterId: comment.chapterId,
          chapterVariantId: quoteVariantId,
          variantType: quote.variantType,
          readerId: comment.readerId,
          username: comment.username,
          kind: 'quote',
          status: comment.status || 'active',
          body: normalizeText(comment.body) || null,
          emoji: null,
          selectedText: normalizeText(quote.selectedText),
          paragraphId: quote.paragraphId,
          endParagraphId: quote.endParagraphId,
          startOffset: quote.startOffset || 0,
          endOffset: quote.endOffset || 0,
          createdAt: new Date(quote.createdAt || comment.createdAt),
          updatedAt: new Date(comment.updatedAt || quote.createdAt || comment.createdAt),
        },
      })
      migratedQuotes += 1

      const votes = await prisma.$queryRawUnsafe(
        'SELECT readerId FROM QuoteUpvote WHERE commentQuoteId = ? ORDER BY createdAt ASC',
        quote.id,
      )
      const seenReaders = new Set()

      for (const vote of votes) {
        const readerId = normalizeText(vote.readerId)
        if (!readerId || seenReaders.has(readerId)) {
          continue
        }

        seenReaders.add(readerId)
        await prisma.annotationVote.upsert({
          where: {
            annotationId_readerId: {
              annotationId: quoteAnnotationId,
              readerId,
            },
          },
          update: {},
          create: {
            annotationId: quoteAnnotationId,
            readerId,
          },
        })
        migratedVotes += 1
      }
    }
  }

  console.log(`[legacy-annotations] comments migrated: ${migratedComments}`)
  console.log(`[legacy-annotations] quotes migrated: ${migratedQuotes}`)
  console.log(`[legacy-annotations] votes migrated: ${migratedVotes}`)
}

try {
  await migrateLegacyComments()
} catch (error) {
  console.error('[legacy-annotations] migration failed')
  console.error(error)
  process.exitCode = 1
} finally {
  await prisma.$disconnect()
}
