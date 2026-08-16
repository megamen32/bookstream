import { randomUUID } from 'node:crypto'
import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import JSZip from 'jszip'
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
const MAX_METADATA_EXCERPT_LENGTH = 12000

export interface ImportedBookImageCandidate {
  dataUrl: string
  index: number
  width: number | null
  height: number | null
  alt: string | null
  source: 'docx' | 'markdown'
}

export interface ImportedBookMetadata {
  title: string | null
  description: string | null
  coverDataUrl: string | null
}

export interface ImportedBookContent {
  html: string
  text: string
  coverDataUrl: string | null
  imageCandidates: ImportedBookImageCandidate[]
  metadata: ImportedBookMetadata
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

export interface ImportedBookMetadataSuggestionContext {
  excerpt: string
  imageCandidates: Array<Pick<ImportedBookImageCandidate, 'index' | 'width' | 'height' | 'alt'>>
}

export interface ImportedBookMetadataSuggestion {
  title?: string | null
  description?: string | null
  coverIndex?: number | null
}

export interface BuildImportedBookPreviewOptions {
  suggestMetadata?: (
    context: ImportedBookMetadataSuggestionContext,
  ) => Promise<ImportedBookMetadataSuggestion | string | null>
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
      imageCandidates: [],
      metadata: { title: null, description: null, coverDataUrl: null },
    }
  }

  if (extension === '.md') {
    const text = normalizeText(await file.text())
    const renderedHtml = await marked(stripMarkdownFrontmatter(text))
    const html = normalizeImportedHtml(typeof renderedHtml === 'string' ? renderedHtml : '')
    const explicitCover = extractFrontmatterCover(text)
    const imageCandidates = await buildImageCandidates(html, 'markdown')
    const coverDataUrl = explicitCover || selectCoverCandidate(imageCandidates)?.dataUrl || null
    return {
      html: typeof html === 'string' ? html : '',
      text,
      coverDataUrl,
      imageCandidates,
      metadata: {
        title: extractFrontmatterValue(text, 'title'),
        description: extractFrontmatterValue(text, 'description'),
        coverDataUrl: explicitCover,
      },
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
  const metadata = await readDocxMetadata(buffer)
  const imageCandidates = await buildImageCandidates(html, 'docx')
  const coverDataUrl = metadata.coverDataUrl || selectCoverCandidate(imageCandidates)?.dataUrl || null

  return {
    html,
    text,
    coverDataUrl,
    imageCandidates,
    metadata,
  }
}

/**
 * Builds non-destructive metadata suggestions from an uploaded book file.
 *
 * @param file Uploaded source file.
 * @returns Best-effort title, description, and cover preview.
 */
export async function buildImportedBookPreview(
  file: File,
  options: BuildImportedBookPreviewOptions = {},
): Promise<ImportedBookPreview> {
  const content = await readImportedBookFile(file)
  const fallbackTitle = inferBookTitle(file.name, content)
  const fallbackDescription = inferBookDescription(content, fallbackTitle)
  const explicitTitle = content.metadata.title
  const explicitDescription = content.metadata.description
  let title = explicitTitle || fallbackTitle
  let description = explicitDescription || fallbackDescription

  if (options.suggestMetadata && (!explicitTitle || !explicitDescription)) {
    try {
      const suggestion = await options.suggestMetadata({
        excerpt: buildMetadataExcerpt(content),
        imageCandidates: content.imageCandidates.map(({ index, width, height, alt }) => ({
          index,
          width,
          height,
          alt,
        })),
      })
      const parsedSuggestion = parseMetadataSuggestion(suggestion)
      if (!explicitTitle && parsedSuggestion.title) {
        title = parsedSuggestion.title
      }
      if (!explicitDescription && parsedSuggestion.description) {
        description = parsedSuggestion.description
      }
      if (!content.metadata.coverDataUrl && parsedSuggestion.coverIndex !== null && parsedSuggestion.coverIndex !== undefined) {
        const suggestedCover = content.imageCandidates[parsedSuggestion.coverIndex]
        if (suggestedCover) {
          content.coverDataUrl = suggestedCover.dataUrl
        }
      }
    } catch {
      // Metadata AI is an optional enhancement; deterministic import must survive provider failures.
    }
  }

  return {
    title,
    description,
    coverDataUrl: content.coverDataUrl ? await optimizeCoverDataUrl(content.coverDataUrl) : null,
  }
}

/**
 * Extracts and validates the small JSON contract returned by metadata AI.
 * Providers sometimes wrap JSON in markdown fences, so those are accepted too.
 */
export function parseMetadataSuggestion(
  suggestion: ImportedBookMetadataSuggestion | string | null,
): ImportedBookMetadataSuggestion {
  if (!suggestion) {
    return {}
  }

  const value = typeof suggestion === 'string'
    ? parseJsonSuggestion(suggestion)
    : suggestion
  if (!value || typeof value !== 'object') {
    return {}
  }

  return {
    title: normalizeSuggestedTitle(value.title),
    description: normalizeSuggestedDescription(value.description),
    coverIndex: normalizeCoverIndex(value.coverIndex),
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

function stripMarkdownFrontmatter(text: string): string {
  return text.replace(MARKDOWN_FRONTMATTER_PATTERN, '').trim()
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
  return extractImageDataUrls(html)[0] || null
}

function extractMarkdownCover(text: string): string | null {
  const markdownImageMatch = text.match(/!\[[^\]]*]\((data:image\/[^)]+)\)/i)
  if (markdownImageMatch) {
    return markdownImageMatch[1]
  }

  const htmlImageMatch = text.match(/<img[^>]+src=["'](data:image\/[^"']+)["'][^>]*>/i)
  return htmlImageMatch?.[1] ?? null
}

function extractFrontmatterCover(text: string): string | null {
  const match = text.match(MARKDOWN_FRONTMATTER_PATTERN)
  if (!match) return null
  const coverMatch = match[1].match(/^(?:cover|cover_url|image):\s*(.+)$/im)
  const value = coverMatch ? cleanupQuotedMetadata(coverMatch[1]) : null
  return value?.startsWith('data:image/') ? value : null
}

function extractImageDataUrls(html: string): string[] {
  return [...html.matchAll(/<img\b[^>]*\bsrc=["'](data:image\/[^"']+)["'][^>]*>/gi)].map((match) => match[1])
}

async function buildImageCandidates(html: string, source: ImportedBookImageCandidate['source']): Promise<ImportedBookImageCandidate[]> {
  const candidates: ImportedBookImageCandidate[] = []
  for (const imageTag of html.matchAll(/<img\b([^>]*)>/gi)) {
    const attributes = imageTag[1] || ''
    const src = attributes.match(/\bsrc=["'](data:image\/[^"']+)["']/i)?.[1]
    if (!src) continue
    let width: number | null = null
    let height: number | null = null
    try {
      const metadata = await sharp(parseDataUrlImage(src) || Buffer.alloc(0)).metadata()
      width = metadata.width || null
      height = metadata.height || null
    } catch {
      // Invalid image remains readable content but is not a cover candidate.
    }
    candidates.push({ dataUrl: src, index: candidates.length, width, height, alt: attributes.match(/\balt=["']([^"']*)["']/i)?.[1]?.trim() || null, source })
  }
  return candidates
}

export function selectCoverCandidate(candidates: ImportedBookImageCandidate[]): ImportedBookImageCandidate | null {
  if (candidates.length === 0) return null
  const portraits = candidates.filter((candidate) => Boolean(candidate.width && candidate.height) && (candidate.height as number) / (candidate.width as number) >= 1.05)
  if (portraits.length === 0 && candidates.every((candidate) => candidate.width && candidate.height)) {
    return null
  }
  const pool = portraits.length > 0 ? portraits : candidates
  return pool.slice().sort((left, right) => coverCandidateScore(right) - coverCandidateScore(left) || left.index - right.index)[0] || null
}

function coverCandidateScore(candidate: ImportedBookImageCandidate): number {
  const width = candidate.width || 0
  const height = candidate.height || 0
  const ratio = width > 0 ? height / width : 0
  const semanticBonus = /cover|облож|title|титул/.test(candidate.alt?.toLowerCase() || '') ? 100000000 : 0
  const portraitBonus = ratio >= 1.05 ? 10000000 : 0
  return semanticBonus + portraitBonus + width * height
}

async function readDocxMetadata(buffer: Buffer): Promise<ImportedBookMetadata> {
  try {
    const zip = await JSZip.loadAsync(buffer)
    const coreXml = await zip.file('docProps/core.xml')?.async('string')
    if (!coreXml) return { title: null, description: null, coverDataUrl: null }
    return {
      title: extractXmlText(coreXml, 'title'),
      description: extractXmlText(coreXml, 'description') || extractXmlText(coreXml, 'subject'),
      coverDataUrl: null,
    }
  } catch {
    return { title: null, description: null, coverDataUrl: null }
  }
}

function extractXmlText(xml: string, localName: string): string | null {
  const pattern = '<[^>]*:' + localName + '\\b[^>]*>([\\s\\S]*?)<\\/[^>]*:' + localName + '>'
  const match = xml.match(new RegExp(pattern, 'i'))
  if (!match) return null
  const decoded = match[1].replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, '&')
  return cleanupQuotedMetadata(decoded)
}

function buildMetadataExcerpt(content: ImportedBookContent): string {
  const sections = flattenImportedSections(splitImportedHtmlIntoSections(content.html, 'Глава 1'))
  const excerpt = sections.slice(0, 2)
    .map((section) => section.title + '\n' + collapseWhitespace(stripHtml(section.contentHtml)))
    .join('\n\n')
  return (excerpt || content.text).slice(0, MAX_METADATA_EXCERPT_LENGTH)
}

function parseJsonSuggestion(value: string): ImportedBookMetadataSuggestion | null {
  const fencedMatch = value.match(/\`\`\`(?:json)?\s*([\s\S]*?)\s*\`\`\`/i)
  const fenced = fencedMatch ? fencedMatch[1] : null
  const jsonMatch = value.match(/\{[\s\S]*\}/)
  const candidate = fenced || (jsonMatch ? jsonMatch[0] : null)
  if (!candidate) return null
  try {
    return JSON.parse(candidate) as ImportedBookMetadataSuggestion
  } catch {
    return null
  }
}

function normalizeSuggestedTitle(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const normalized = collapseWhitespace(value)
  return looksLikeDocumentTitle(normalized) ? normalized : null
}

function normalizeSuggestedDescription(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const normalized = collapseWhitespace(value)
  return normalized.length >= 40 && normalized.length <= 600 ? normalized : null
}

function normalizeCoverIndex(value: unknown): number | null {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0 ? value : null
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
