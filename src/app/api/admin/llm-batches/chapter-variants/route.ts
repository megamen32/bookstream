import { NextRequest, NextResponse } from 'next/server'
import { getAdminSessionReader } from '@/lib/admin-auth'
import { db } from '@/lib/db'
import { enqueueChapterVariantJob } from '@/lib/llm-queue'
import { checkBatchBudget, validatePayerAccess, type PayerRef } from '@/lib/llm-billing'

function plainFromHtml(html: string) {
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

export async function POST(request: NextRequest) {
  const reader = await getAdminSessionReader(request)
  if (!reader) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const body = await request.json().catch(() => ({})) as { authorId?: string; bookId?: string; variantTypes?: string[]; payerType?: 'reader'|'author'; payerId?: string }

  const payer: PayerRef = {
    payerType: body.payerType === 'author' ? 'author' : 'reader',
    payerId: body.payerId || reader.id,
  }
  try { await validatePayerAccess(reader.id, payer) }
  catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : 'Invalid payer' }, { status: 403 }) }

  const authorWhere = reader.isMainAdmin ? {} : { ownerReaderId: reader.id }
  const books = await db.book.findMany({
    where: {
      ...(body.bookId ? { id: body.bookId } : {}),
      ...(body.authorId ? { authorId: body.authorId } : {}),
      author: authorWhere,
    },
    select: {
      id: true,
      title: true,
      authorId: true,
      author: { select: { name: true } },
      chapters: {
        orderBy: { position: 'asc' },
        select: {
          id: true,
          title: true,
          variants: {
            select: {
              variantType: true,
              contentHtml: true,
              paragraphs: { orderBy: { position: 'asc' }, select: { text: true } },
            },
          },
        },
      },
    },
  })
  if (!books.length) return NextResponse.json({ error: 'Книги не найдены' }, { status: 404 })

  const presets = (await db.variantPreset.findMany({ orderBy: { position: 'asc' } }))
    .filter((preset) => preset.slug !== 'original' && (!body.variantTypes?.length || body.variantTypes.includes(preset.slug)))
  if (!presets.length) return NextResponse.json({ error: 'Нет пресетов для генерации' }, { status: 400 })

  const activeJobs = await db.llmJob.findMany({
    where: { readerId: reader.id, kind: 'chapter-variant', status: { in: ['queued', 'running'] } },
    select: { payloadJson: true },
  })
  const activeKeys = new Set<string>()
  for (const job of activeJobs) {
    try {
      const payload = JSON.parse(job.payloadJson) as { chapterId?: string; variantType?: string }
      if (payload.chapterId && payload.variantType) activeKeys.add(`${payload.chapterId}:${payload.variantType}`)
    } catch {}
  }

  const scopeTitle = body.bookId && books[0]
    ? `Варианты: ${books[0].title}`
    : body.authorId && books[0]
      ? `Варианты: ${books[0].author.name}`
      : 'Варианты для всех глав'
  const batch = await db.llmBatch.create({
    data: {
      readerId: reader.id,
      authorId: body.authorId || (body.bookId && books.length === 1 ? books[0].authorId : null),
      bookId: body.bookId || null,
      title: scopeTitle,
      kind: 'chapter-variants',
      payerType: payer.payerType,
      payerId: payer.payerId,
      status: 'preparing',
    },
  })

  let created = 0
  let skipped = 0
  const errors: string[] = []
  for (const book of books) {
    for (const chapter of book.chapters) {
      const original = chapter.variants.find((variant) => variant.variantType === 'original')
      if (!original) { skipped += presets.length; continue }
      const plainText = original.paragraphs.length
        ? original.paragraphs.map((paragraph) => paragraph.text).join('\n\n').trim()
        : plainFromHtml(original.contentHtml)
      if (!plainText) { skipped += presets.length; continue }
      const wordCount = plainText.split(/\s+/).filter(Boolean).length
      const existing = new Set(chapter.variants.map((variant) => variant.variantType))

      for (const preset of presets) {
        const key = `${chapter.id}:${preset.slug}`
        if (existing.has(preset.slug) || activeKeys.has(key)) { skipped += 1; continue }
        const targetWords = preset.targetSizePercent == null ? wordCount : Math.max(1, Math.round(wordCount * preset.targetSizePercent / 100))
        const systemPrompt = preset.systemPromptTemplate.replace(/\{word_count\}/g, String(targetWords))
        try {
          await enqueueChapterVariantJob({
            readerId: reader.id,
            batchId: batch.id,
            authorId: book.authorId,
            bookId: book.id,
            chapterId: chapter.id,
            variantType: preset.slug,
            systemPrompt,
            userPrompt: `Вот исходный текст:\n\n${plainText}`,
            maxOutputTokens: 4000,
            payerType: payer.payerType,
            payerId: payer.payerId,
          })
          activeKeys.add(key)
          created += 1
        } catch (error) {
          errors.push(`${book.title} / ${chapter.title} / ${preset.slug}: ${error instanceof Error ? error.message : String(error)}`)
        }
      }
    }
  }

  const estimate = await db.llmJob.aggregate({ where: { batchId: batch.id }, _sum: { estimatedCostUsd: true } })
  const estimatedCostUsd = estimate._sum.estimatedCostUsd || 0
  const budget = await checkBatchBudget(payer, estimatedCostUsd)
  const updated = await db.llmBatch.update({
    where: { id: batch.id },
    data: {
      totalJobs: created,
      budgetUsd: budget.policy.maxBatchBudgetUsd,
      ...(created === 0
        ? { status: 'completed', completedAt: new Date(), pauseReason: null }
        : budget.ok
          ? { status: 'running', pauseReason: null }
          : { status: 'paused-budget', pauseReason: budget.reason }),
    },
  })
  return NextResponse.json({ batch: updated, created, skipped, estimatedCostUsd, payer: budget.policy, budgetOk: budget.ok, errors: errors.slice(0, 20) }, { status: 201 })
}
