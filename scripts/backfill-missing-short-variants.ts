import { db } from '../src/lib/db.ts'
import { createChatCompletion, getEnvironmentLlmConfig } from '../src/lib/llm.ts'
import { saveChapterVariantRevision } from '../src/lib/chapter-revisions.ts'

const concurrency = Math.max(1, Number(process.env.BACKFILL_CONCURRENCY || 4))
const limit = Number(process.env.BACKFILL_LIMIT || 0)

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

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function resultToHtml(text: string) {
  const paragraphs = text.split(/\n+/).map((p) => p.trim()).filter(Boolean)
  if (!paragraphs.length) throw new Error('Model returned no usable paragraphs')
  return paragraphs.map((p) => `<p>${escapeHtml(p)}</p>`).join('\n')
}

async function main() {
  const llm = getEnvironmentLlmConfig()
  if (!llm) throw new Error('LLM environment configuration is missing')
  const llmConfig = llm

  const presets = await db.variantPreset.findMany({ orderBy: { position: 'asc' } })
  const shortPresets = presets.filter((preset) => preset.slug !== 'original')
  if (!shortPresets.length) throw new Error('No short variant presets configured')

  const chapters = await db.chapter.findMany({
    orderBy: [{ bookId: 'asc' }, { position: 'asc' }],
    include: {
      book: { select: { title: true } },
      variants: {
        select: { id: true, variantType: true, contentHtml: true, paragraphs: { orderBy: { position: 'asc' }, select: { text: true } } },
      },
    },
  })

  const jobs: Array<{
    chapterId: string
    chapterTitle: string
    bookTitle: string
    variantType: string
    systemPrompt: string
    plainText: string
  }> = []

  for (const chapter of chapters) {
    const original = chapter.variants.find((variant) => variant.variantType === 'original')
    if (!original) continue
    const plainText = original.paragraphs.length
      ? original.paragraphs.map((paragraph) => paragraph.text).join('\n\n').trim()
      : plainFromHtml(original.contentHtml)
    if (!plainText) continue
    const wordCount = plainText.split(/\s+/).filter(Boolean).length
    const existingTypes = new Set(chapter.variants.map((variant) => variant.variantType))

    for (const preset of shortPresets) {
      if (existingTypes.has(preset.slug)) continue
      const targetWords = preset.targetSizePercent == null
        ? wordCount
        : Math.max(1, Math.round((wordCount * preset.targetSizePercent) / 100))
      const systemPrompt = preset.systemPromptTemplate.replace(/\{word_count\}/g, String(targetWords))
      jobs.push({
        chapterId: chapter.id,
        chapterTitle: chapter.title,
        bookTitle: chapter.book.title,
        variantType: preset.slug,
        systemPrompt,
        plainText,
      })
    }
  }

  const queue = limit > 0 ? jobs.slice(0, limit) : jobs
  console.log(`BACKFILL_PLAN jobs=${queue.length} total_missing=${jobs.length} concurrency=${concurrency}`)
  const failures: Array<{ chapterId: string; variantType: string; error: string }> = []
  let cursor = 0
  let completed = 0

  async function worker(workerId: number) {
    while (true) {
      const index = cursor++
      if (index >= queue.length) return
      const job = queue[index]
      try {
        const text = await createChatCompletion({
          messages: [
            { role: 'system', content: job.systemPrompt },
            { role: 'user', content: `Вот исходный текст:\n\n${job.plainText}` },
          ],
          temperature: 0.3,
          maxTokens: 4000,
        }, llmConfig)
        const contentHtml = resultToHtml(text)

        const stillMissing = await db.chapterVariant.findUnique({
          where: { chapterId_variantType: { chapterId: job.chapterId, variantType: job.variantType } },
          select: { id: true },
        })
        if (!stillMissing) {
          await db.$transaction((tx) => saveChapterVariantRevision(tx, {
            chapterId: job.chapterId,
            variantType: job.variantType,
            contentHtml,
            editedByAuthor: false,
            source: 'ai',
          }))
        }
        completed += 1
        console.log(`OK ${completed}/${queue.length} worker=${workerId} variant=${job.variantType} book=${JSON.stringify(job.bookTitle)} chapter=${JSON.stringify(job.chapterTitle)}`)
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        failures.push({ chapterId: job.chapterId, variantType: job.variantType, error: message })
        console.error(`FAIL worker=${workerId} variant=${job.variantType} chapter=${job.chapterId} error=${JSON.stringify(message)}`)
      }
    }
  }

  await Promise.all(Array.from({ length: Math.min(concurrency, Math.max(queue.length, 1)) }, (_, i) => worker(i + 1)))
  console.log(`BACKFILL_DONE completed=${completed} failed=${failures.length} planned=${queue.length}`)
  if (failures.length) {
    console.log(`BACKFILL_FAILURES ${JSON.stringify(failures)}`)
    process.exitCode = 2
  }
}

main().finally(async () => {
  await db.$disconnect()
})
