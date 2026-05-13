import { randomUUID } from 'node:crypto'
import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import mammoth from 'mammoth'
import { marked } from 'marked'
import sharp from 'sharp'
import { resolveCoverDirectories } from './cover-storage.ts'
import { hasReadableHtmlContent } from './book-content.ts'
import { buildDocxImportOptions } from './docx-conversion.ts'
import {
  flattenImportedSections,
  normalizeImportedHtml,
  splitImportedHtmlIntoSections,
  type ImportedBookSection,
} from './imported-book-html.ts'

const SUPPORTED_BOOK_EXTENSIONS = ['.docx', '.md', '.txt'] as const
const CHAPTER_HEADING_PATTERN = /^(?:Глава\s+\d+|Chapter\s+\d+|Chapter\s+[IVXLCDM]+|CHAPTER\s+\d+)$/i
const MARKDOWN_FRONTMATTER_PATTERN = /^---\s*\n([\s\S]*?)\n---\s*(?:\n|$)/
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
  level: number
  isReadable?: boolean
}

/**
 * Reads a supported upload file and normalizes it into HTML, plain text,
 * and an optional extracted cover candidate.
 *
 * @param file Uploaded source file.
 * @returns Parsed content in normalized formats.
 * @throws Error When the file type is not supported.
 */
export async function readImportedBookFile(
  file: File,
  docxOverrides: Partial<Parameters<typeof mammoth.convertToHtml>[1]> = {},
): Promise<ImportedBookContent> {
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
  const htmlResult = await mammoth.convertToHtml({ buffer }, buildDocxImportOptions({
    ...docxOverrides,
    convertImage: docxOverrides.convertImage
      || mammoth.images.imgElement(async (image) => ({
        src: `data:${image.contentType};base64,${await image.read('base64')}`,
      })),
  }))
  const rawTextResult = await mammoth.extractRawText({ buffer })
  const html = normalizeImportedHtml(htmlResult.value)
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
  const sections = splitImportedHtmlIntoSections(html, fallbackTitle)
  const flattened = flattenImportedSections(sections)

  if (flattened.length === 0) {
    return [{ title: fallbackTitle, content: html, level: 1, isReadable: hasReadableHtmlContent(html) }]
  }

  return flattened.map((section) => ({
    title: section.title,
    content: section.contentHtml,
    level: section.level,
    isReadable: section.isReadable,
  }))
}

interface HeadingBoundary {
  index: number
  endIndex: number
  level: number
  title: string
}

function extractHeadingBoundaries(html: string): HeadingBoundary[] {
  const headingRegex = /<(h[1-6])[^>]*>([\s\S]*?)<\/\1>/gi
  const headings: HeadingBoundary[] = []

  let match: RegExpExecArray | null
  while ((match = headingRegex.exec(html)) !== null) {
    const cleanTitle = collapseWhitespace(stripHtml(match[2]))
    if (!cleanTitle) {
      continue
    }

    headings.push({
      index: match.index,
      endIndex: match.index + match[0].length,
      level: Number.parseInt(match[1].slice(1), 10),
      title: cleanTitle,
    })
  }

  return headings
}

function shouldSkipLeadingStructuralHeading(headings: HeadingBoundary[], html: string): boolean {
  if (headings.length < 2) {
    return false
  }

  const [firstHeading, secondHeading] = headings
  const topLevelHeadings = headings.filter((heading) => heading.level === firstHeading.level)
  if (firstHeading.level !== 1 || topLevelHeadings.length !== 1) {
    return false
  }

  if (!headings.some((heading) => heading.level > firstHeading.level)) {
    return false
  }

  const betweenHeadings = html.slice(firstHeading.endIndex, secondHeading.index)
  return !hasReadableBlockContent(betweenHeadings)
}

function selectTopLevelChapterHeadings(headings: HeadingBoundary[]): HeadingBoundary[] {
  if (headings.length === 0) {
    return []
  }

  const topLevel = headings.reduce(
    (minimumLevel, heading) => Math.min(minimumLevel, heading.level),
    headings[0].level
  )

  return headings.filter((heading) => heading.level === topLevel)
}

function removeDuplicateLeadingTitleBlock(content: string, title: string): string {
  const normalizedTitle = collapseWhitespace(title)
  if (!normalizedTitle || !content) {
    return content
  }

  const leadingBlockPattern = /^\s*(<(h[1-6]|p)[^>]*>[\s\S]*?<\/\2>)/
  const match = content.match(leadingBlockPattern)
  if (!match) {
    return content
  }

  const leadingBlockText = collapseWhitespace(stripHtml(match[1]))
  if (leadingBlockText !== normalizedTitle) {
    return content
  }

  const remainingContent = content.slice(match[0].length).trim()
  return hasReadableBlockContent(remainingContent) ? remainingContent : content
}

function hasReadableBlockContent(content: string): boolean {
  const normalizedText = collapseWhitespace(stripHtml(content))
  if (normalizedText.length > 0) {
    return true
  }

  return /<(img|table|blockquote|hr|ul|ol|pre)\b/i.test(content)
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

  const fileName = `${sanitizePathSegment(bookId)}-${sanitizePathSegment(bookSlug)}.webp`

  const optimizedCover = await sharp(coverBuffer)
    .rotate()
    .resize({ width: 1200, height: 1800, fit: 'inside', withoutEnlargement: true })
    .webp({ quality: 82 })
    .toBuffer()

  const coverDirectories = resolveCoverDirectories()
  for (const coverDirectory of coverDirectories) {
    const targetPath = path.join(coverDirectory, fileName)

    await mkdir(coverDirectory, { recursive: true })
    await writeFile(targetPath, optimizedCover)
  }

  return `/uploads/covers/${fileName}`
}

interface ImportedDocxImage {
  contentType: string
  read(format: 'base64'): Promise<string>
}

/**
 * Persists an image extracted from a DOCX file into the public book asset tree.
 *
 * @param params Book identity and source image payload.
 * @returns Public URL for the saved asset.
 */
export async function persistImportedBookImage(params: {
  bookId: string
  image: ImportedDocxImage
}): Promise<string> {
  const { bookId, image } = params
  const imageBuffer = Buffer.from(await image.read('base64'), 'base64')
  const extension = resolveImageExtension(image.contentType)
  const fileName = `${sanitizePathSegment(bookId)}-${randomUUID()}${extension}`
  const publicPath = `/uploads/books/${sanitizePathSegment(bookId)}/${fileName}`
  const assetDirectories = resolveImportedBookAssetDirectories()

  for (const assetDirectory of assetDirectories) {
    const targetDirectory = path.join(assetDirectory, sanitizePathSegment(bookId))
    const targetPath = path.join(targetDirectory, fileName)
    await mkdir(targetDirectory, { recursive: true })
    await writeFile(targetPath, imageBuffer)
  }

  return publicPath
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

function resolveImportedBookAssetDirectories(): string[] {
  const directories = new Set<string>()
  const configuredPublicDirectory = process.env.BOOKSTREAM_PUBLIC_DIR
  const currentWorkingDirectory = process.cwd()

  if (configuredPublicDirectory) {
    directories.add(path.resolve(configuredPublicDirectory))
  }

  directories.add(path.join(currentWorkingDirectory, 'public'))

  const entryScriptPath = process.argv[1]
  if (entryScriptPath) {
    const normalizedEntryDirectory = path.dirname(path.resolve(entryScriptPath))
    const standaloneSuffix = `${path.sep}.next${path.sep}standalone`

    if (normalizedEntryDirectory.endsWith(standaloneSuffix)) {
      directories.add(path.join(normalizedEntryDirectory, 'public'))
    }
  }

  return Array.from(directories).map((publicDirectory) => (
    path.join(publicDirectory, 'uploads', 'books')
  ))
}

function resolveImageExtension(contentType: string): string {
  if (contentType === 'image/jpeg') return '.jpg'
  if (contentType === 'image/png') return '.png'
  if (contentType === 'image/webp') return '.webp'
  if (contentType === 'image/avif') return '.avif'
  if (contentType === 'image/gif') return '.gif'
  return '.img'
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
