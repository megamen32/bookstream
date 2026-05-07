import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import mammoth from 'mammoth'
import { marked } from 'marked'
import sharp from 'sharp'

const SUPPORTED_BOOK_EXTENSIONS = ['.docx', '.md', '.txt'] as const
const CHAPTER_HEADING_PATTERN = /^(?:Глава\s+\d+|Chapter\s+\d+|Chapter\s+[IVXLCDM]+|CHAPTER\s+\d+)$/i
const MARKDOWN_FRONTMATTER_PATTERN = /^---\s*\n([\s\S]*?)\n---\s*(?:\n|$)/
const BOOK_COVER_DIRECTORY = path.join(process.cwd(), 'public', 'uploads', 'covers')

export interface ImportedBookContent {
  html: string
  text: string
  coverDataUrl: string | null
}

export interface ImportedBookPreview {
  title: string | null
  description: string | null
  coverDataUrl: string | null
}

export interface ImportedChapter {
  title: string
  content: string
}

/**
 * Reads a supported upload file and normalizes it into HTML, plain text,
 * and an optional extracted cover candidate.
 *
 * @param file Uploaded source file.
 * @returns Parsed content in normalized formats.
 * @throws Error When the file type is not supported.
 */
export async function readImportedBookFile(file: File): Promise<ImportedBookContent> {
  const extension = getFileExtension(file.name)

  if (!SUPPORTED_BOOK_EXTENSIONS.includes(extension)) {
    throw new Error('Неподдерживаемый формат файла')
  }

  if (extension === '.txt') {
    const text = normalizeText(await file.text())
    return {
      html: plainTextToHtml(text),
      text,
      coverDataUrl: null,
    }
  }

  if (extension === '.md') {
    const text = normalizeText(await file.text())
    const html = await marked(text)
    return {
      html: typeof html === 'string' ? html : '',
      text,
      coverDataUrl: extractMarkdownCover(text),
    }
  }

  const buffer = Buffer.from(await file.arrayBuffer())
  const htmlResult = await mammoth.convertToHtml(
    { buffer },
    {
      convertImage: mammoth.images.imgElement(async (image) => ({
        src: `data:${image.contentType};base64,${await image.read('base64')}`,
      })),
    }
  )
  const rawTextResult = await mammoth.extractRawText({ buffer })
  const html = htmlResult.value
  const text = normalizeText(rawTextResult.value)

  return {
    html,
    text,
    coverDataUrl: extractFirstImageDataUrl(html),
  }
}

/**
 * Builds non-destructive metadata suggestions from an uploaded book file.
 *
 * @param file Uploaded source file.
 * @returns Best-effort title, description, and cover preview.
 */
export async function buildImportedBookPreview(file: File): Promise<ImportedBookPreview> {
  const content = await readImportedBookFile(file)
  const title = inferBookTitle(file.name, content)
  const description = inferBookDescription(content, title)

  return {
    title,
    description,
    coverDataUrl: content.coverDataUrl ? await optimizeCoverDataUrl(content.coverDataUrl) : null,
  }
}

/**
 * Splits normalized HTML into chapter chunks.
 *
 * @param html Full imported HTML body.
 * @returns Chapter list with titles and content.
 */
export function splitImportedHtmlIntoChapters(html: string): ImportedChapter[] {
  return splitImportedHtmlIntoChaptersWithFallbackTitle(html)
}

/**
 * Splits normalized HTML into chapter chunks and preserves pre-heading content
 * as the first chapter instead of dropping it.
 *
 * @param html Full imported HTML body.
 * @param fallbackTitle Optional title for unnamed first chapter.
 * @returns Chapter list with titles and content.
 */
export function splitImportedHtmlIntoChaptersWithFallbackTitle(
  html: string,
  fallbackTitle = 'Глава 1'
): ImportedChapter[] {
  const headingRegex = /<(h[1-3])[^>]*>(.*?)<\/\1>/gi
  const matches: Array<{ index: number; title: string }> = []

  let match: RegExpExecArray | null
  while ((match = headingRegex.exec(html)) !== null) {
    const cleanTitle = collapseWhitespace(stripHtml(match[2]))
    if (cleanTitle) {
      matches.push({ index: match.index, title: cleanTitle })
    }
  }

  if (matches.length > 0) {
    const chapters: ImportedChapter[] = []

    const leadingContent = html.slice(0, matches[0].index).trim()
    if (leadingContent) {
      chapters.push({
        title: fallbackTitle,
        content: leadingContent,
      })
    }

    for (let index = 0; index < matches.length; index += 1) {
      const start = matches[index].index
      const end = index + 1 < matches.length ? matches[index + 1].index : html.length
      chapters.push({
        title: matches[index].title,
        content: html.slice(start, end).trim(),
      })
    }
    return chapters
  }

  const paragraphs = html.split(/<\/p>/i).filter((paragraph) => paragraph.trim())
  const chapters: ImportedChapter[] = []
  const chunkSize = 10

  for (let index = 0; index < paragraphs.length; index += chunkSize) {
    const chunk = paragraphs.slice(index, index + chunkSize)
    chapters.push({
      title: `Глава ${chapters.length + 1}`,
      content: `${chunk.join('</p>').trim()}</p>`,
    })
  }

  return chapters.length > 0 ? chapters : [{ title: fallbackTitle, content: html }]
}

/**
 * Saves an uploaded or auto-detected cover image and returns its public URL.
 * Manual cover upload always wins over an inferred cover.
 *
 * @param params Parameters for cover persistence.
 * @returns Public URL for the saved cover, or null when no cover is available.
 */
export async function persistImportedBookCover(params: {
  bookId: string
  bookSlug: string
  coverFile: File | null
  suggestedCoverDataUrl: string | null
}): Promise<string | null> {
  const { bookId, bookSlug, coverFile, suggestedCoverDataUrl } = params

  const coverBuffer = coverFile
    ? Buffer.from(await coverFile.arrayBuffer())
    : suggestedCoverDataUrl
      ? parseDataUrlImage(suggestedCoverDataUrl)
      : null

  if (!coverBuffer) {
    return null
  }

  await mkdir(BOOK_COVER_DIRECTORY, { recursive: true })

  const fileName = `${sanitizePathSegment(bookId)}-${sanitizePathSegment(bookSlug)}.webp`
  const targetPath = path.join(BOOK_COVER_DIRECTORY, fileName)

  const optimizedCover = await sharp(coverBuffer)
    .rotate()
    .resize({ width: 1200, height: 1800, fit: 'inside', withoutEnlargement: true })
    .webp({ quality: 82 })
    .toBuffer()

  await writeFile(targetPath, optimizedCover)

  return `/uploads/covers/${fileName}`
}

function inferBookTitle(fileName: string, content: ImportedBookContent): string | null {
  const titleFromFrontmatter = extractFrontmatterValue(content.text, 'title')
  if (titleFromFrontmatter) {
    return titleFromFrontmatter
  }

  const titleFromHeading = extractTitleFromHtmlHeading(content.html)
  if (titleFromHeading) {
    return titleFromHeading
  }

  const titleFromText = extractTitleFromLeadingLines(content.text)
  if (titleFromText) {
    return titleFromText
  }

  return inferTitleFromFileName(fileName)
}

function inferBookDescription(content: ImportedBookContent, inferredTitle: string | null): string | null {
  const descriptionFromFrontmatter = extractFrontmatterValue(content.text, 'description')
  if (descriptionFromFrontmatter) {
    return descriptionFromFrontmatter
  }

  const paragraphs = extractParagraphCandidates(content.html, content.text)

  for (const paragraph of paragraphs) {
    const normalizedParagraph = collapseWhitespace(stripHtml(paragraph))
    if (!normalizedParagraph) {
      continue
    }
    if (inferredTitle && normalizedParagraph === collapseWhitespace(inferredTitle)) {
      continue
    }
    if (looksLikeChapterHeading(normalizedParagraph)) {
      continue
    }
    if (normalizedParagraph.length < 40) {
      continue
    }
    return normalizedParagraph
  }

  return null
}

function extractFrontmatterValue(text: string, key: 'title' | 'description'): string | null {
  const match = text.match(MARKDOWN_FRONTMATTER_PATTERN)
  if (!match) {
    return null
  }

  const keyRegex = new RegExp(`^${key}:\\s*(.+)$`, 'im')
  const valueMatch = match[1].match(keyRegex)
  if (!valueMatch) {
    return null
  }

  return cleanupQuotedMetadata(valueMatch[1])
}

function cleanupQuotedMetadata(value: string): string | null {
  const trimmed = value.trim().replace(/^["']|["']$/g, '')
  return trimmed ? trimmed : null
}

function extractTitleFromHtmlHeading(html: string): string | null {
  const headingMatch = html.match(/<h[1-2][^>]*>(.*?)<\/h[1-2]>/i)
  if (!headingMatch) {
    return null
  }

  const title = collapseWhitespace(stripHtml(headingMatch[1]))
  return looksLikeDocumentTitle(title) ? title : null
}

function extractTitleFromLeadingLines(text: string): string | null {
  const lines = text
    .split('\n')
    .map((line) => collapseWhitespace(line))
    .filter(Boolean)
    .slice(0, 8)

  for (const line of lines) {
    if (looksLikeDocumentTitle(line)) {
      return line
    }
  }

  return null
}

function inferTitleFromFileName(fileName: string): string | null {
  const extension = path.extname(fileName)
  const baseName = fileName.slice(0, fileName.length - extension.length)
  const normalized = collapseWhitespace(
    baseName
      .replace(/[_-]+/g, ' ')
      .replace(/\s*\([^)]*\)\s*$/g, ' ')
      .replace(/\s*\[[^\]]*\]\s*$/g, ' ')
  )

  if (!normalized) {
    return null
  }

  return normalized
    .split(' ')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
}

function looksLikeDocumentTitle(value: string): boolean {
  const normalized = collapseWhitespace(value)
  if (!normalized || normalized.length < 3 || normalized.length > 120) {
    return false
  }
  if (looksLikeChapterHeading(normalized)) {
    return false
  }
  if (/[.!?]$/.test(normalized)) {
    return false
  }

  const digitCount = (normalized.match(/\d/g) || []).length
  return digitCount <= Math.ceil(normalized.length / 5)
}

function looksLikeChapterHeading(value: string): boolean {
  return CHAPTER_HEADING_PATTERN.test(value.trim())
}

function extractParagraphCandidates(html: string, text: string): string[] {
  const htmlParagraphMatches = [...html.matchAll(/<p[^>]*>(.*?)<\/p>/gi)]
  const htmlParagraphs = htmlParagraphMatches
    .map((match) => collapseWhitespace(stripHtml(match[1])))
    .filter(Boolean)

  if (htmlParagraphs.length > 0) {
    return htmlParagraphs
  }

  return text
    .split(/\n\s*\n+/)
    .map((paragraph) => collapseWhitespace(paragraph))
    .filter(Boolean)
}

function extractFirstImageDataUrl(html: string): string | null {
  const imageMatch = html.match(/<img[^>]+src="(data:image\/[^"]+)"[^>]*>/i)
  return imageMatch?.[1] ?? null
}

function extractMarkdownCover(text: string): string | null {
  const markdownImageMatch = text.match(/!\[[^\]]*]\((data:image\/[^)]+)\)/i)
  if (markdownImageMatch) {
    return markdownImageMatch[1]
  }

  const htmlImageMatch = text.match(/<img[^>]+src=["'](data:image\/[^"']+)["'][^>]*>/i)
  return htmlImageMatch?.[1] ?? null
}

async function optimizeCoverDataUrl(dataUrl: string): Promise<string | null> {
  const buffer = parseDataUrlImage(dataUrl)
  if (!buffer) {
    return null
  }

  const optimizedBuffer = await sharp(buffer)
    .rotate()
    .resize({ width: 600, height: 900, fit: 'inside', withoutEnlargement: true })
    .webp({ quality: 78 })
    .toBuffer()

  return `data:image/webp;base64,${optimizedBuffer.toString('base64')}`
}

function parseDataUrlImage(dataUrl: string): Buffer | null {
  const match = dataUrl.match(/^data:image\/[a-zA-Z0-9.+-]+;base64,(.+)$/)
  if (!match) {
    return null
  }

  return Buffer.from(match[1], 'base64')
}

function plainTextToHtml(text: string): string {
  return text
    .split(/\n\s*\n+/)
    .map((paragraph) => `<p>${escapeHtml(paragraph).replace(/\n/g, '<br/>')}</p>`)
    .join('')
}

function stripHtml(value: string): string {
  return value.replace(/<[^>]+>/g, ' ')
}

function normalizeText(value: string): string {
  return value.replace(/\r\n/g, '\n').trim()
}

function collapseWhitespace(value: string): string {
  return value.replace(/\s+/g, ' ').trim()
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function getFileExtension(fileName: string): typeof SUPPORTED_BOOK_EXTENSIONS[number] {
  return path.extname(fileName).toLowerCase() as typeof SUPPORTED_BOOK_EXTENSIONS[number]
}

function sanitizePathSegment(value: string): string {
  return value.replace(/[^a-zA-Z0-9_-]/g, '-')
}
