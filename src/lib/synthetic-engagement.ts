import { createChatCompletion } from '@/lib/llm'

interface SyntheticReaderProfile {
  readerId: string
  username: string
}

interface SyntheticParagraph {
  id: string
  text: string
  position: number
}

interface SyntheticChapterVariant {
  id: string
  variantType: string
  paragraphs: SyntheticParagraph[]
}

interface SyntheticChapter {
  id: string
  title: string
  position: number
  variants: SyntheticChapterVariant[]
}

interface SyntheticBookSettings {
  title: string
  syntheticCommentsPerChapter: number
  syntheticQuotesPerChapter: number
  syntheticReactionsPerChapter: number
}

export interface SyntheticChapterPlanItem {
  chapterId: string
  chapterTitle: string
  commentCount: number
  quoteCount: number
  reactionCount: number
}

interface LlmSyntheticCommentPayload {
  comments: string[]
  reactions: string[]
}

interface SyntheticTarget {
  paragraph: SyntheticParagraph
  chapterVariant: SyntheticChapterVariant
}

const SYNTHETIC_READER_PROFILES: SyntheticReaderProfile[] = [
  { readerId: 'synthetic-reader-1', username: 'тихий_читатель' },
  { readerId: 'synthetic-reader-2', username: 'nota_bene' },
  { readerId: 'synthetic-reader-3', username: 'chapter_glow' },
  { readerId: 'synthetic-reader-4', username: 'внимательный_гость' },
  { readerId: 'synthetic-reader-5', username: 'line_keeper' },
  { readerId: 'synthetic-reader-6', username: 'reader_signal' },
  { readerId: 'synthetic-reader-7', username: 'текст_рядом' },
  { readerId: 'synthetic-reader-8', username: 'soft_margin' },
] as const

const REACTION_EMOJIS = ['🔥', '💡', '❤️', '👏', '🖋️', '🤍', '⚡️'] as const

function normalizeText(text: string): string {
  return text.replace(/\s+/g, ' ').trim()
}

function clampCount(value: number, fallback: number): number {
  if (!Number.isFinite(value)) {
    return fallback
  }

  return Math.max(0, Math.min(20, Math.round(value)))
}

function snippet(text: string, maxLength: number): string {
  const normalized = normalizeText(text)
  if (normalized.length <= maxLength) {
    return normalized
  }

  const sliced = normalized.slice(0, maxLength)
  const cutPoint = Math.max(
    sliced.lastIndexOf('.'),
    sliced.lastIndexOf('!'),
    sliced.lastIndexOf('?'),
    sliced.lastIndexOf('…'),
    sliced.lastIndexOf(','),
    sliced.lastIndexOf(';'),
  )

  if (cutPoint >= Math.floor(maxLength * 0.45)) {
    return sliced.slice(0, cutPoint + 1).trim()
  }

  return sliced.replace(/\s+\S*$/, '').trim()
}

function pickOriginalVariant(chapter: SyntheticChapter): SyntheticChapterVariant | null {
  return chapter.variants.find((variant) => variant.variantType === 'original') ?? chapter.variants[0] ?? null
}

function buildTargets(chapter: SyntheticChapter): SyntheticTarget[] {
  const originalVariant = pickOriginalVariant(chapter)
  if (!originalVariant || originalVariant.paragraphs.length === 0) {
    return []
  }

  const firstIndexes = [0, 1, 2, 3, 4].filter((index) => index < originalVariant.paragraphs.length)
  return firstIndexes.map((index) => ({
    chapterVariant: originalVariant,
    paragraph: originalVariant.paragraphs[index],
  }))
}

function stripCodeFence(text: string): string {
  return text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim()
}

function pickReader(chapterPosition: number, itemIndex: number): SyntheticReaderProfile {
  return SYNTHETIC_READER_PROFILES[(chapterPosition + itemIndex) % SYNTHETIC_READER_PROFILES.length]!
}

function buildCommentBody(params: {
  bookTitle: string
  chapterTitle: string
  paragraphText: string
  index: number
}): string {
  const leadPhrases = [
    'Хорошо держится интонация.',
    'Сильный заход в главу.',
    'Здесь текст звучит особенно собранно.',
    'Этот кусок хорошо цепляет ритмом.',
    'Тут удачно работает образ.',
  ] as const

  const lead = leadPhrases[params.index % leadPhrases.length]
  return `${lead} В главе «${params.chapterTitle}» у «${params.bookTitle}» особенно заметен этот фрагмент: ${snippet(params.paragraphText, 120)}`
}

function buildQuoteText(paragraphText: string, index: number): string {
  const normalized = normalizeText(paragraphText)
  if (normalized.length <= 42) {
    return normalized
  }

  const preferredLength = 88 + (index % 3) * 18
  return snippet(normalized, preferredLength)
}

/**
 * Builds per-chapter synthetic engagement targets based on book settings.
 *
 * @param book Book metadata with synthetic thresholds.
 * @param chapters Chapters with original paragraphs.
 * @returns Structured plan describing what should exist for each chapter.
 */
export function buildSyntheticChapterPlan(
  book: SyntheticBookSettings,
  chapters: SyntheticChapter[],
): SyntheticChapterPlanItem[] {
  const commentTarget = clampCount(book.syntheticCommentsPerChapter, 3)
  const quoteTarget = clampCount(book.syntheticQuotesPerChapter, 1)
  const reactionTarget = clampCount(book.syntheticReactionsPerChapter, 5)

  return chapters.map((chapter) => ({
    chapterId: chapter.id,
    chapterTitle: chapter.title,
    commentCount: buildTargets(chapter).length > 0 ? commentTarget : 0,
    quoteCount: buildTargets(chapter).length > 0 ? quoteTarget : 0,
    reactionCount: buildTargets(chapter).length > 0 ? reactionTarget : 0,
  }))
}

/**
 * Produces deterministic synthetic comment payloads for a chapter.
 *
 * @param bookTitle Book title used in generated text.
 * @param chapter Current chapter with variants and paragraphs.
 * @param count Number of comments to create.
 * @returns Comment rows ready for insertion.
 */
export function buildSyntheticComments(
  bookTitle: string,
  chapter: SyntheticChapter,
  count: number,
): Array<{
  readerId: string
  username: string
  chapterVariantId: string
  variantType: string
  body: string
  selectedText: string
  paragraphId: string
  endParagraphId: string
  startOffset: number
  endOffset: number
}> {
  const targets = buildTargets(chapter)
  if (targets.length === 0) {
    return []
  }

  const safeCount = clampCount(count, 0)

  return Array.from({ length: safeCount }, (_, index) => {
    const target = targets[index % targets.length]!
    const reader = pickReader(chapter.position, index)
    const selectedText = buildQuoteText(target.paragraph.text, index)

    return {
      readerId: reader.readerId,
      username: reader.username,
      chapterVariantId: target.chapterVariant.id,
      variantType: target.chapterVariant.variantType,
      body: buildCommentBody({
        bookTitle,
        chapterTitle: chapter.title,
        paragraphText: target.paragraph.text,
        index,
      }),
      selectedText,
      paragraphId: target.paragraph.id,
      endParagraphId: target.paragraph.id,
      startOffset: 0,
      endOffset: selectedText.length,
    }
  })
}

/**
 * Produces deterministic synthetic quote payloads for a chapter.
 *
 * @param chapter Current chapter with variants and paragraphs.
 * @param count Number of quotes to create.
 * @returns Quote rows ready for insertion.
 */
export function buildSyntheticQuotes(
  chapter: SyntheticChapter,
  count: number,
): Array<{
  readerId: string
  username: string
  chapterVariantId: string
  variantType: string
  selectedText: string
  paragraphId: string
  endParagraphId: string
  startOffset: number
  endOffset: number
}> {
  const targets = buildTargets(chapter)
  if (targets.length === 0) {
    return []
  }

  const safeCount = clampCount(count, 0)

  return Array.from({ length: safeCount }, (_, index) => {
    const target = targets[(index + 1) % targets.length]!
    const reader = pickReader(chapter.position + 3, index)
    const selectedText = buildQuoteText(target.paragraph.text, index + 5)

    return {
      readerId: reader.readerId,
      username: reader.username,
      chapterVariantId: target.chapterVariant.id,
      variantType: target.chapterVariant.variantType,
      selectedText,
      paragraphId: target.paragraph.id,
      endParagraphId: target.paragraph.id,
      startOffset: 0,
      endOffset: selectedText.length,
    }
  })
}

/**
 * Produces deterministic synthetic reaction payloads for a chapter.
 *
 * @param chapter Current chapter with variants and paragraphs.
 * @param count Number of reactions to create.
 * @returns Reaction annotation rows ready for insertion.
 */
export function buildSyntheticReactions(
  chapter: SyntheticChapter,
  count: number,
): Array<{
  readerId: string
  username: string
  chapterVariantId: string
  variantType: string
  emoji: string
  selectedText: string
  paragraphId: string
  endParagraphId: string
  startOffset: number
  endOffset: number
}> {
  const targets = buildTargets(chapter)
  if (targets.length === 0) {
    return []
  }

  const safeCount = clampCount(count, 0)

  return Array.from({ length: safeCount }, (_, index) => {
    const target = targets[index % targets.length]!
    const reader = pickReader(chapter.position + 6, index)
    const selectedText = buildQuoteText(target.paragraph.text, index + 11)

    return {
      readerId: reader.readerId,
      username: reader.username,
      chapterVariantId: target.chapterVariant.id,
      variantType: target.chapterVariant.variantType,
      emoji: REACTION_EMOJIS[index % REACTION_EMOJIS.length]!,
      selectedText,
      paragraphId: target.paragraph.id,
      endParagraphId: target.paragraph.id,
      startOffset: 0,
      endOffset: selectedText.length,
    }
  })
}

/**
 * Generates synthetic comment bodies and optional reaction emoji suggestions via the configured LLM.
 *
 * @param bookTitle Book title for context.
 * @param chapter Current chapter context.
 * @param commentCount Number of comment bodies required.
 * @param reactionCount Number of emoji suggestions required.
 * @returns Structured generated content matching requested lengths.
 * @throws Error when the LLM payload is malformed or incomplete.
 */
export async function buildLlmSyntheticCommentPayload(params: {
  bookTitle: string
  chapter: SyntheticChapter
  commentCount: number
  reactionCount: number
}): Promise<LlmSyntheticCommentPayload> {
  const targets = buildTargets(params.chapter)
  if (targets.length === 0) {
    return { comments: [], reactions: [] }
  }

  const promptParagraphs = targets.map((target, index) => (
    `${index + 1}. ${snippet(target.paragraph.text, 220)}`
  )).join('\n')

  const completion = await createChatCompletion({
    temperature: 0.8,
    maxTokens: 1200,
    messages: [
      {
        role: 'system',
        content: 'Ты пишешь короткие живые комментарии читателей для книги. Верни строго JSON без пояснений.',
      },
      {
        role: 'user',
        content: [
          `Книга: ${params.bookTitle}`,
          `Глава: ${params.chapter.title}`,
          `Нужно комментариев: ${params.commentCount}`,
          `Нужно эмодзи-реакций: ${params.reactionCount}`,
          'Комментарии должны быть на русском, 1-2 предложения, без упоминания того, что они сгенерированы.',
          'Эмодзи должны быть одиночными и подходить к читательской реакции на текст.',
          'Опирайся только на эти фрагменты главы:',
          promptParagraphs,
          'Верни JSON вида {"comments":["..."],"reactions":["🔥","💡"]}.',
        ].join('\n'),
      },
    ],
  })

  const parsed = JSON.parse(stripCodeFence(completion)) as Partial<LlmSyntheticCommentPayload>
  const comments = Array.isArray(parsed.comments)
    ? parsed.comments
        .map((item) => (typeof item === 'string' ? normalizeText(item) : ''))
        .filter((item) => item.length > 0)
        .slice(0, params.commentCount)
    : []
  const reactions = Array.isArray(parsed.reactions)
    ? parsed.reactions
        .map((item) => (typeof item === 'string' ? item.trim() : ''))
        .filter((item) => item.length > 0)
        .slice(0, params.reactionCount)
    : []

  if (comments.length !== params.commentCount) {
    throw new Error('LLM returned an incomplete comment payload')
  }

  return {
    comments,
    reactions,
  }
}
