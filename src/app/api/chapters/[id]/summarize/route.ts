import { NextRequest, NextResponse } from 'next/server'
import { ensureVariantParagraphs, syncVariantParagraphsFromHtml } from '@/lib/chapter-variants'
import { db } from '@/lib/db'
import { createChatCompletion } from '@/lib/llm'

async function callLLM(systemPrompt: string, userPrompt: string): Promise<string> {
  return createChatCompletion({
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
    temperature: 0.3,
    maxTokens: 4000,
  })
}

async function upsertVariant(
  chapterId: string,
  variantType: string,
  text: string
): Promise<{ variantId: string; paragraphCount: number } | null> {
  const paragraphs = text
    .split(/\n+/)
    .map((p) => p.trim())
    .filter((p) => p.length > 10)

  if (paragraphs.length === 0) return null

  const contentHtml = paragraphs.map((p) => `<p>${p}</p>`).join('\n')

  const variant = await db.chapterVariant.upsert({
    where: {
      chapterId_variantType: { chapterId, variantType },
    },
    update: { contentHtml },
    create: { chapterId, variantType, contentHtml },
  })

  const syncedParagraphs = await syncVariantParagraphsFromHtml(db, variant.id, variant.contentHtml)

  return { variantId: variant.id, paragraphCount: syncedParagraphs.length }
}

/**
 * POST /api/chapters/[id]/summarize
 *
 * Ways to invoke:
 *
 *  1. Default (no body): generates clean + essence using hardcoded prompts
 *  2. Custom variants:  { "variants": [{ "type": "slug", "prompt": "..." }] }
 *  3. From preset:       { "presetIds": ["preset-cuid-1", "preset-cuid-2"] }
 *     — uses systemPromptTemplate from VariantPreset, replacing {word_count}
 *
 * Query params:
 *   ?force=true  — regenerate even if variants already exist
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json().catch(() => ({}))

    // 1. Find original variant
    const original = await db.chapterVariant.findUnique({
      where: {
        chapterId_variantType: { chapterId: id, variantType: 'original' },
      },
      include: { paragraphs: { orderBy: { position: 'asc' } } },
    })

    if (!original) {
      return NextResponse.json(
        { error: 'Оригинальный текст не найден' },
        { status: 404 }
      )
    }

    const originalParagraphs = await ensureVariantParagraphs(db, original.id, original.contentHtml)
    const plainText = originalParagraphs.map((paragraph) => paragraph.text).join('\n\n')
    const wordCount = plainText.split(/\s+/).length

    if (plainText.length < 50) {
      return NextResponse.json(
        { error: 'Текст слишком короткий для обработки' },
        { status: 400 }
      )
    }

    // 2. Build list of variant definitions to generate
    const variantDefs: Array<{ type: string; prompt: string }> = []

    // Mode A: explicit preset IDs
    if (body.presetIds && Array.isArray(body.presetIds)) {
      const presets = await db.variantPreset.findMany({
        where: { id: { in: body.presetIds } },
        orderBy: { position: 'asc' },
      })
      for (const preset of presets) {
        let prompt = preset.systemPromptTemplate
        // Replace {word_count} only if targetSizePercent is set
        if (preset.targetSizePercent != null && prompt.includes('{word_count}')) {
          const targetWords = Math.round(wordCount * preset.targetSizePercent / 100)
          prompt = prompt.replace(/\{word_count\}/g, String(targetWords))
        }
        variantDefs.push({ type: preset.slug, prompt })
      }
    }

    // Mode B: explicit variants in body
    if (body.variants && Array.isArray(body.variants)) {
      for (const v of body.variants) {
        variantDefs.push({ type: v.type, prompt: v.prompt })
      }
    }

    // Mode C: default — fetch all presets from DB
    if (variantDefs.length === 0) {
      const presets = await db.variantPreset.findMany({
        orderBy: { position: 'asc' },
      })

      if (presets.length > 0) {
        for (const preset of presets) {
          let prompt = preset.systemPromptTemplate
          if (preset.targetSizePercent != null && prompt.includes('{word_count}')) {
            const targetWords = Math.round(wordCount * preset.targetSizePercent / 100)
            prompt = prompt.replace(/\{word_count\}/g, String(targetWords))
          }
          variantDefs.push({ type: preset.slug, prompt })
        }
      } else {
        // Fallback hardcoded prompts (if no presets seeded yet)
        const target50 = Math.round(wordCount * 0.5)
        const target20 = Math.round(wordCount * 0.2)

        variantDefs.push(
          {
            type: 'clean',
            prompt: `Сократи текст до примерно ${target50} слов (50%), сохрани нарратив. Чистый текст, без markdown.`,
          },
          {
            type: 'essence',
            prompt: `Выжми ядро — ${target20} слов (20%), дающих 80% смысла. Один абзац = одна мысль. Без markdown.`,
          },
        )
      }
    }

    // 3. Generate all in parallel
    const results = await Promise.all(
      variantDefs.map(async ({ type, prompt }) => {
        const result = await callLLM(prompt, `Вот исходный текст:\n\n${plainText}`)
        const saved = await upsertVariant(id, type, result)
        return { type, ...saved }
      })
    )

    return NextResponse.json({
      success: true,
      originalWordCount: wordCount,
      generated: results,
    })
  } catch (error) {
    console.error('Error generating variants:', error)
    return NextResponse.json(
      { error: 'Ошибка генерации: ' + (error instanceof Error ? error.message : String(error)) },
      { status: 500 }
    )
  }
}
